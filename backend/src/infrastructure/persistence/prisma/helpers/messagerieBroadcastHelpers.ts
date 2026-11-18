import type { Prisma, PrismaClient } from '@prisma/client';
import type { ContactResult } from '@domain/ports/repositories/MessagerieRepository';
import { whereProfilesParClasse, whereProfilesParClasses } from '@application/shared/studentEnrollment';

export interface ParticipantFormat {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  staffTitle: string | null;
}

export const USER_PARTICIPANT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  role: true,
  staffProfile: { select: { title: true } },
} as const;

export interface UserWithStaffSelect {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  staffProfile: { title: string | null } | null;
}

export function toParticipantFormat(user: UserWithStaffSelect): ParticipantFormat {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    staffTitle: user.staffProfile?.title ?? null,
  };
}

export async function trouverMembresDirectionOp(
  prisma: PrismaClient,
  schoolId: string,
): Promise<ParticipantFormat[]> {
  const [admins, staff] = await Promise.all([
    prisma.user.findMany({ where: { schoolId, role: 'ADMIN', isActive: true }, select: USER_PARTICIPANT_SELECT }),
    prisma.user.findMany({ where: { schoolId, role: 'STAFF', isActive: true }, select: USER_PARTICIPANT_SELECT }),
  ]);

  const directionStaff = staff.filter((s) => {
    const title = (s.staffProfile?.title || '').toLowerCase();
    const isCenseur = /censeur|vice[- ]?principal|dean.*studies/i.test(title);
    const isOrientation = /orientation|counselor|conseill/i.test(title);
    return isCenseur || isOrientation;
  });

  const uniqueMap = new Map<string, ParticipantFormat>();
  for (const u of [...admins, ...directionStaff]) {
    uniqueMap.set(u.id, {
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      staffTitle: u.staffProfile?.title ?? (u.role === 'ADMIN' ? 'Administrateur' : null),
    });
  }
  return Array.from(uniqueMap.values());
}

export async function getClassIdActuelEleveOp(prisma: PrismaClient, userId: string): Promise<string | null> {
  const row = await prisma.enrollment.findFirst({
    where: { student: { userId }, status: 'ACTIVE', academicYear: { isCurrent: true } },
    select: { classId: true },
  });
  return row?.classId ?? null;
}

export async function classIdsPertinentsOp(prisma: PrismaClient, userId: string, role: string): Promise<string[]> {
  const upperRole = role.toUpperCase();

  if (upperRole === 'TEACHER') {
    const [assignments, classesPp] = await Promise.all([
      prisma.teachingAssignment.findMany({ where: { teacherId: userId }, select: { classId: true } }),
      prisma.class.findMany({ where: { professorPrincipalId: userId }, select: { id: true } }),
    ]);
    return Array.from(new Set([...assignments.map((a) => a.classId), ...classesPp.map((c) => c.id)]));
  }

  if (upperRole === 'STUDENT') {
    const classId = await getClassIdActuelEleveOp(prisma, userId);
    return classId ? [classId] : [];
  }

  if (upperRole === 'PARENT') {
    const children = await prisma.parentStudent.findMany({
      where: { parentProfile: { userId } },
      select: {
        studentProfile: {
          select: {
            enrollmentsYearScoped: {
              where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
              select: { classId: true },
              take: 1,
            },
          },
        },
      },
    });
    return Array.from(new Set(
      children
        .map((c) => c.studentProfile?.enrollmentsYearScoped?.[0]?.classId)
        .filter((id: string | null | undefined): id is string => !!id),
    ));
  }

  return [];
}

export async function destinatairesAutorisesOp(
  prisma: PrismaClient,
  schoolId: string,
  appelantId: string,
  appelantRole: string,
): Promise<Set<string> | null> {
  const role = appelantRole.toUpperCase();
  if (role === 'STUDENT') return new Set<string>();
  if (role === 'ADMIN' || role === 'STAFF') return null;

  const classIds = await classIdsPertinentsOp(prisma, appelantId, role);

  if (role === 'TEACHER') {
    const [parentsLinks, students, colleagues, staffEtAdmin] = await Promise.all([
      classIds.length
        ? prisma.parentStudent.findMany({
            where: { studentProfile: whereProfilesParClasses(classIds) },
            select: { parentProfile: { select: { userId: true } } },
          })
        : Promise.resolve([]),
      classIds.length
        ? prisma.studentProfile.findMany({
            where: { ...whereProfilesParClasses(classIds) },
            select: { userId: true },
          })
        : Promise.resolve([]),
      prisma.user.findMany({ where: { schoolId, role: 'TEACHER', isActive: true, id: { not: appelantId } }, select: { id: true } }),
      prisma.user.findMany({ where: { schoolId, role: { in: ['STAFF', 'ADMIN'] }, isActive: true }, select: { id: true } }),
    ]);
    return new Set<string>([
      ...parentsLinks.map((p) => p.parentProfile.userId),
      ...students.map((s) => s.userId),
      ...colleagues.map((u) => u.id),
      ...staffEtAdmin.map((u) => u.id),
    ]);
  }

  const [assignments, classesPp, staffEtAdmin] = await Promise.all([
    classIds.length
      ? prisma.teachingAssignment.findMany({ where: { classId: { in: classIds } }, select: { teacherId: true } })
      : Promise.resolve([]),
    classIds.length
      ? prisma.class.findMany({ where: { id: { in: classIds }, professorPrincipalId: { not: null } }, select: { professorPrincipalId: true } })
      : Promise.resolve([]),
    prisma.user.findMany({ where: { schoolId, role: { in: ['STAFF', 'ADMIN'] }, isActive: true }, select: { id: true } }),
  ]);

  return new Set<string>([
    ...assignments.map((a) => a.teacherId),
    ...classesPp.map((c) => c.professorPrincipalId as string),
    ...staffEtAdmin.map((u) => u.id),
  ]);
}

export async function niveauxPertinentsOp(
  prisma: PrismaClient,
  userId: string,
  role: string,
  schoolId: string,
): Promise<string[]> {
  const upperRole = role.toUpperCase();
  if (upperRole === 'ADMIN' || upperRole === 'STAFF') {
    const classes = await prisma.class.findMany({ where: { schoolId }, select: { level: true, name: true } });
    return Array.from(new Set(classes.map((c) => (c.level?.trim() || c.name.split(' ')[0]).trim()))).filter(Boolean);
  }
  if (upperRole === 'STUDENT') return [];
  const classIds = await classIdsPertinentsOp(prisma, userId, role);
  if (!classIds.length) return [];
  const classes = await prisma.class.findMany({ where: { id: { in: classIds } }, select: { level: true, name: true } });
  return Array.from(new Set(classes.map((c) => (c.level?.trim() || c.name.split(' ')[0]).trim()))).filter(Boolean);
}

export async function estEnseignantDuNiveauOp(
  prisma: PrismaClient,
  userId: string,
  schoolId: string,
  level: string,
): Promise<boolean> {
  const classes = await prisma.class.findMany({
    where: { schoolId, OR: [{ level }, { name: { startsWith: level } }] },
    select: { id: true, professorPrincipalId: true },
  });
  const classIds = classes.map((c) => c.id);
  if (!classIds.length) return false;

  const [assignment, isPp] = await Promise.all([
    prisma.teachingAssignment.findFirst({ where: { classId: { in: classIds }, teacherId: userId }, select: { id: true } }),
    classes.some((c) => c.professorPrincipalId === userId),
  ]);
  return Boolean(assignment || isPp);
}

export async function estParentDUnEleveDuNiveauOp(
  prisma: PrismaClient,
  userId: string,
  schoolId: string,
  level: string,
): Promise<boolean> {
  const classes = await prisma.class.findMany({
    where: { schoolId, OR: [{ level }, { name: { startsWith: level } }] },
    select: { id: true },
  });
  const classIds = classes.map((c) => c.id);
  if (!classIds.length) return false;

  const count = await prisma.parentStudent.count({
    where: {
      parentProfile: { userId },
      studentProfile: { enrollmentsYearScoped: { some: { classId: { in: classIds }, status: 'ACTIVE' } } },
    },
  });
  return count > 0;
}

export async function estEnseignantDeLaClasseOp(prisma: PrismaClient, userId: string, classId: string): Promise<boolean> {
  const teacherProfile = await prisma.teacherProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!teacherProfile) return false;

  const [assignment, classeCommePp] = await Promise.all([
    prisma.teachingAssignment.findFirst({ where: { classId, teacherId: userId }, select: { id: true } }),
    prisma.class.findFirst({ where: { id: classId, professorPrincipalId: userId }, select: { id: true } }),
  ]);
  return Boolean(assignment || classeCommePp);
}

export async function estEleveDeLaClasseOp(prisma: PrismaClient, userId: string, classId: string): Promise<boolean> {
  return (await getClassIdActuelEleveOp(prisma, userId)) === classId;
}

export async function estParentDUnEleveDeLaClasseOp(prisma: PrismaClient, userId: string, classId: string): Promise<boolean> {
  const count = await prisma.parentStudent.count({
    where: { parentProfile: { userId }, studentProfile: whereProfilesParClasse(classId) },
  });
  return count > 0;
}

export async function listerElevesClasseOp(prisma: PrismaClient, classId: string): Promise<string[]> {
  const students = await prisma.studentProfile.findMany({
    where: { ...whereProfilesParClasse(classId) },
    select: { userId: true },
  });
  return students.map((s) => s.userId);
}

export async function listerParentsClasseOp(prisma: PrismaClient, classId: string): Promise<string[]> {
  const parentsLinks = await prisma.parentStudent.findMany({
    where: { studentProfile: whereProfilesParClasse(classId) },
    select: { parentProfile: { select: { userId: true } } },
  });
  return parentsLinks.map((p) => p.parentProfile.userId);
}

async function getProfIdsPourClasse(prisma: PrismaClient, classId: string): Promise<string[]> {
  const [assignments, classePp] = await Promise.all([
    prisma.teachingAssignment.findMany({ where: { classId }, select: { teacherId: true } }),
    prisma.class.findUnique({ where: { id: classId }, select: { professorPrincipalId: true } }),
  ]);
  return [
    ...assignments.map((a) => a.teacherId),
    ...(classePp?.professorPrincipalId ? [classePp.professorPrincipalId] : []),
  ];
}

export async function listerParticipantsConversationOp(
  prisma: PrismaClient,
  conversationId: string,
  excludeUserId: string,
): Promise<string[]> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { type: true, classId: true, level: true, schoolId: true },
  });
  if (!conversation) return [];

  const directionUserIds = (await trouverMembresDirectionOp(prisma, conversation.schoolId)).map((m) => m.id);

  if (conversation.type === 'CLASS_CHANNEL' && conversation.classId) {
    const [profIds, studentIds] = await Promise.all([
      getProfIdsPourClasse(prisma, conversation.classId),
      listerElevesClasseOp(prisma, conversation.classId),
    ]);
    return Array.from(new Set([...directionUserIds, ...profIds, ...studentIds])).filter((id) => id !== excludeUserId);
  }

  if (conversation.type === 'PARENT_CHANNEL') {
    let profIds: string[] = [];
    let parentIds: string[] = [];

    if (conversation.level) {
      const classesDuNiveau = await prisma.class.findMany({
        where: {
          schoolId: conversation.schoolId,
          OR: [{ level: conversation.level }, { name: { startsWith: conversation.level } }],
        },
        select: { id: true, professorPrincipalId: true },
      });
      const classIds = classesDuNiveau.map((c) => c.id);
      const [assignments, parentLinks] = await Promise.all([
        prisma.teachingAssignment.findMany({ where: { classId: { in: classIds } }, select: { teacherId: true } }),
        prisma.parentStudent.findMany({
          where: { studentProfile: { enrollmentsYearScoped: { some: { classId: { in: classIds }, status: 'ACTIVE' } } } },
          select: { parentProfile: { select: { userId: true } } },
        }),
      ]);
      profIds = [
        ...assignments.map((a) => a.teacherId),
        ...classesDuNiveau.map((c) => c.professorPrincipalId).filter((id): id is string => Boolean(id)),
      ];
      parentIds = parentLinks.map((pl) => pl.parentProfile?.userId).filter((id): id is string => Boolean(id));
    } else if (conversation.classId) {
      [profIds, parentIds] = await Promise.all([
        getProfIdsPourClasse(prisma, conversation.classId),
        listerParentsClasseOp(prisma, conversation.classId),
      ]);
    }

    return Array.from(new Set([...directionUserIds, ...profIds, ...parentIds])).filter((id) => id !== excludeUserId);
  }

  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId, userId: { not: excludeUserId } },
    select: { userId: true },
  });
  return participants.map((p) => p.userId);
}

export async function rechercherContactsOp(
  prisma: PrismaClient,
  cmd: { schoolId: string; appelantId: string; appelantRole: string; recherche: string; limite?: number },
): Promise<ContactResult[]> {
  const role = cmd.appelantRole.toUpperCase();
  const limite = cmd.limite ?? 20;
  const recherche = cmd.recherche.trim();

  if (role === 'STUDENT' || recherche.length < 2) return [];

  const termes = recherche.toLowerCase().split(/\s+/).filter(Boolean);
  const autorises = await destinatairesAutorisesOp(prisma, cmd.schoolId, cmd.appelantId, cmd.appelantRole);

  const where: Prisma.UserWhereInput = {
    schoolId: cmd.schoolId,
    isActive: true,
    id: { not: cmd.appelantId },
    AND: termes.map((terme) => ({
      OR: [
        { firstName: { contains: terme, mode: 'insensitive' } },
        { lastName: { contains: terme, mode: 'insensitive' } },
      ],
    })),
  };

  if (autorises !== null) {
    const idsArray = Array.from(autorises);
    if (idsArray.length === 0) return [];
    where.id = { not: cmd.appelantId, in: idsArray };
  }

  const users = await prisma.user.findMany({
    where,
    select: USER_PARTICIPANT_SELECT,
    orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
    take: limite,
  });
  return users.map(toParticipantFormat);
}
