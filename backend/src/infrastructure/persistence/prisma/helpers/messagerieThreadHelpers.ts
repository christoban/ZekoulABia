import type { Prisma, PrismaClient } from '@prisma/client';
import type { ConversationRef, VerifierAppartenanceParams } from '@domain/ports/repositories/MessagerieRepository';
import {
  USER_PARTICIPANT_SELECT,
  estEleveDeLaClasseOp,
  estEnseignantDeLaClasseOp,
  estEnseignantDuNiveauOp,
  estParentDUnEleveDeLaClasseOp,
  estParentDUnEleveDuNiveauOp,
  niveauxPertinentsOp,
  toParticipantFormat,
  trouverMembresDirectionOp,
  type ParticipantFormat,
} from './messagerieBroadcastHelpers';

const dernieresVerificationsCanaux = new Map<string, number>();

function ajouterParticipantUnique(
  map: Map<string, ParticipantFormat[]>,
  key: string,
  participant: ParticipantFormat,
): void {
  const list = map.get(key) ?? [];
  if (!list.some((u) => u.id === participant.id)) {
    list.push(participant);
    map.set(key, list);
  }
}

export async function verifierAppartenanceConversationOp(
  prisma: PrismaClient,
  params: VerifierAppartenanceParams,
): Promise<ConversationRef> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: params.conversationId, schoolId: params.schoolId },
    select: { id: true, type: true, classId: true, level: true, schoolId: true, announcementsOnly: true },
  });
  if (!conversation) throw new Error('Conversation introuvable.');

  const role = params.role.toUpperCase();

  if (conversation.type === 'PRIVATE') {
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: conversation.id, userId: params.userId } },
    });
    if (!participant) throw new Error('Vous ne faites pas partie de cette conversation.');
    return conversation;
  }

  if (role === 'ADMIN' || role === 'STAFF') return conversation;

  if (conversation.type === 'CLASS_CHANNEL') {
    if (!conversation.classId) throw new Error('Conversation invalide (canal sans classe).');
    if (role === 'TEACHER' && (await estEnseignantDeLaClasseOp(prisma, params.userId, conversation.classId))) return conversation;
    if (role === 'STUDENT' && (await estEleveDeLaClasseOp(prisma, params.userId, conversation.classId))) return conversation;
    throw new Error("Vous n'avez pas accès à ce canal de classe.");
  }

  if (conversation.type === 'PARENT_CHANNEL') {
    if (conversation.level) {
      if (role === 'TEACHER' && (await estEnseignantDuNiveauOp(prisma, params.userId, params.schoolId, conversation.level))) return conversation;
      if (role === 'PARENT' && (await estParentDUnEleveDuNiveauOp(prisma, params.userId, params.schoolId, conversation.level))) return conversation;
    } else if (conversation.classId) {
      if (role === 'TEACHER' && (await estEnseignantDeLaClasseOp(prisma, params.userId, conversation.classId))) return conversation;
      if (role === 'PARENT' && (await estParentDUnEleveDeLaClasseOp(prisma, params.userId, conversation.classId))) return conversation;
    }
    throw new Error("Vous n'avez pas accès à ce canal parents.");
  }

  throw new Error('Type de conversation non pris en charge.');
}

async function assurerCanauxPourClassesOp(prisma: PrismaClient, schoolId: string): Promise<void> {
  const dernierCheck = dernieresVerificationsCanaux.get(schoolId);
  const maintenant = Date.now();
  if (dernierCheck && maintenant - dernierCheck < 5 * 60 * 1000) return;
  dernieresVerificationsCanaux.set(schoolId, maintenant);

  const classes = await prisma.class.findMany({ where: { schoolId }, select: { id: true, name: true, level: true } });
  if (!classes.length) return;

  const existingClassChannels = await prisma.conversation.findMany({
    where: { schoolId, type: 'CLASS_CHANNEL' },
    select: { classId: true },
  });
  const existingClassIds = new Set(existingClassChannels.map((c) => c.classId));
  const toCreateClass = classes
    .filter((cl) => !existingClassIds.has(cl.id))
    .map((cl) => ({
      schoolId,
      classId: cl.id,
      type: 'CLASS_CHANNEL' as const,
      name: `Classe — ${cl.name}`,
      announcementsOnly: true,
    }));
  if (toCreateClass.length > 0) {
    await prisma.conversation.createMany({ data: toCreateClass, skipDuplicates: true });
  }

  const distinctLevels = Array.from(
    new Set(classes.map((c) => (c.level?.trim() || c.name.split(' ')[0]).trim())),
  ).filter(Boolean);

  const existingLevelChannels = await prisma.conversation.findMany({
    where: { schoolId, type: 'PARENT_CHANNEL', level: { in: distinctLevels } },
    select: { level: true },
  });
  const existingLevels = new Set(existingLevelChannels.map((c) => c.level));

  const toCreateParents = distinctLevels
    .filter((lvl) => !existingLevels.has(lvl))
    .map((lvl) => ({
      schoolId,
      level: lvl,
      type: 'PARENT_CHANNEL' as const,
      name: `Parents — ${lvl}`,
      announcementsOnly: true,
    }));
  if (toCreateParents.length > 0) {
    await prisma.conversation.createMany({ data: toCreateParents, skipDuplicates: true });
  }
}

async function chargerMembresParClasse(prisma: PrismaClient, classIds: string[]) {
  const enseignantsParClasse = new Map<string, ParticipantFormat[]>();
  const elevesParClasse = new Map<string, ParticipantFormat[]>();
  const parentsParClasse = new Map<string, ParticipantFormat[]>();

  if (classIds.length === 0) {
    return { enseignantsParClasse, elevesParClasse, parentsParClasse };
  }

  const [assignments, classesWithPp, enrollments] = await Promise.all([
    prisma.teachingAssignment.findMany({
      where: { classId: { in: classIds } },
      include: { teacher: { select: USER_PARTICIPANT_SELECT } },
    }),
    prisma.class.findMany({
      where: { id: { in: classIds }, professorPrincipalId: { not: null } },
      select: { id: true, professorPrincipal: { select: USER_PARTICIPANT_SELECT } },
    }),
    prisma.enrollment.findMany({
      where: { classId: { in: classIds }, status: 'ACTIVE' },
      include: { student: { include: { user: { select: USER_PARTICIPANT_SELECT } } } },
    }),
  ]);

  for (const a of assignments) {
    if (a.teacher) ajouterParticipantUnique(enseignantsParClasse, a.classId, toParticipantFormat(a.teacher));
  }
  for (const cl of classesWithPp) {
    if (cl.professorPrincipal) {
      ajouterParticipantUnique(enseignantsParClasse, cl.id, toParticipantFormat(cl.professorPrincipal));
    }
  }

  const studentProfileIdToClassId = new Map<string, string>();
  for (const en of enrollments) {
    if (!en.student?.user) continue;
    studentProfileIdToClassId.set(en.studentId, en.classId);
    ajouterParticipantUnique(elevesParClasse, en.classId, toParticipantFormat(en.student.user));
  }

  const studentProfileIds = Array.from(studentProfileIdToClassId.keys());
  if (studentProfileIds.length > 0) {
    const parentLinks = await prisma.parentStudent.findMany({
      where: { studentProfileId: { in: studentProfileIds } },
      include: { parentProfile: { include: { user: { select: USER_PARTICIPANT_SELECT } } } },
    });
    for (const pl of parentLinks) {
      const parentUser = pl.parentProfile?.user;
      const targetClassId = studentProfileIdToClassId.get(pl.studentProfileId);
      if (parentUser && targetClassId) {
        ajouterParticipantUnique(parentsParClasse, targetClassId, toParticipantFormat(parentUser));
      }
    }
  }

  return { enseignantsParClasse, elevesParClasse, parentsParClasse };
}

function agregerMembresParNiveau(
  classIdsParLevel: Map<string, string[]>,
  enseignantsParClasse: Map<string, ParticipantFormat[]>,
  parentsParClasse: Map<string, ParticipantFormat[]>,
) {
  const enseignantsParNiveau = new Map<string, ParticipantFormat[]>();
  const parentsParNiveau = new Map<string, ParticipantFormat[]>();

  for (const [lvl, cIds] of classIdsParLevel.entries()) {
    const profsMap = new Map<string, ParticipantFormat>();
    const parentsMap = new Map<string, ParticipantFormat>();
    for (const cId of cIds) {
      for (const p of enseignantsParClasse.get(cId) ?? []) profsMap.set(p.id, p);
      for (const pr of parentsParClasse.get(cId) ?? []) parentsMap.set(pr.id, pr);
    }
    enseignantsParNiveau.set(lvl, Array.from(profsMap.values()));
    parentsParNiveau.set(lvl, Array.from(parentsMap.values()));
  }

  return { enseignantsParNiveau, parentsParNiveau };
}

function dedupliquerParticipants(listes: ParticipantFormat[][]): ParticipantFormat[] {
  const map = new Map<string, ParticipantFormat>();
  for (const groupe of listes) {
    for (const u of groupe) map.set(u.id, u);
  }
  return Array.from(map.values());
}

export async function listerConversationsPourAppelantOp(
  prisma: PrismaClient,
  cmd: { schoolId: string; appelantId: string; role: string; classIds: string[]; estSupervision: boolean },
): Promise<unknown[]> {
  const role = cmd.role.toUpperCase();
  const { classIds, estSupervision, appelantId, schoolId } = cmd;

  await assurerCanauxPourClassesOp(prisma, schoolId);

  const [directionMembers, niveaux] = await Promise.all([
    trouverMembresDirectionOp(prisma, schoolId),
    niveauxPertinentsOp(prisma, appelantId, role, schoolId),
  ]);

  const orConditions: Prisma.ConversationWhereInput[] = [];
  if (role !== 'STUDENT') {
    orConditions.push({ type: 'PRIVATE', participants: { some: { userId: appelantId } } });
  }
  if (estSupervision) {
    orConditions.push({ type: 'CLASS_CHANNEL' }, { type: 'PARENT_CHANNEL', level: { not: null } });
  } else {
    if (classIds.length && (role === 'TEACHER' || role === 'STUDENT')) {
      orConditions.push({ type: 'CLASS_CHANNEL', classId: { in: classIds } });
    }
    if (niveaux.length && (role === 'TEACHER' || role === 'PARENT')) {
      orConditions.push({ type: 'PARENT_CHANNEL', level: { in: niveaux } });
    }
  }

  const where: Prisma.ConversationWhereInput = {
    schoolId,
    OR: orConditions.length ? orConditions : [{ id: '__none__' }],
  };

  const [conversations, allClasses] = await Promise.all([
    prisma.conversation.findMany({
      where,
      include: {
        participants: { include: { user: { select: USER_PARTICIPANT_SELECT } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, content: true, createdAt: true, senderId: true } },
      },
    }),
    prisma.class.findMany({ where: { schoolId }, select: { id: true, name: true, level: true } }),
  ]);

  const nomParClasseId = new Map(allClasses.map((c) => [c.id, c.name]));
  const levelParClasseId = new Map(
    allClasses.map((c) => [c.id, (c.level?.trim() || c.name.split(' ')[0]).trim()]),
  );
  const classIdsParLevel = new Map<string, string[]>();
  for (const cl of allClasses) {
    const lvl = (cl.level?.trim() || cl.name.split(' ')[0]).trim();
    const list = classIdsParLevel.get(lvl) ?? [];
    list.push(cl.id);
    classIdsParLevel.set(lvl, list);
  }

  const { enseignantsParClasse, elevesParClasse, parentsParClasse } = await chargerMembresParClasse(
    prisma,
    allClasses.map((c) => c.id),
  );
  const { enseignantsParNiveau, parentsParNiveau } = agregerMembresParNiveau(
    classIdsParLevel,
    enseignantsParClasse,
    parentsParClasse,
  );

  const avecMeta = await Promise.all(
    conversations.map(async (conversation) => {
      const nonLus = await prisma.message.count({
        where: {
          conversationId: conversation.id,
          senderId: { not: appelantId },
          moderationStatus: 'APPROVED',
          readStatuses: { none: { userId: appelantId } },
        },
      });

      let participantsList: ParticipantFormat[];
      if (conversation.type === 'CLASS_CHANNEL' && conversation.classId) {
        participantsList = dedupliquerParticipants([
          directionMembers,
          enseignantsParClasse.get(conversation.classId) ?? [],
          elevesParClasse.get(conversation.classId) ?? [],
        ]);
      } else if (conversation.type === 'PARENT_CHANNEL') {
        const lvl = conversation.level ?? (conversation.classId ? levelParClasseId.get(conversation.classId) : null);
        participantsList = dedupliquerParticipants([
          directionMembers,
          lvl ? (parentsParNiveau.get(lvl) ?? []) : [],
          lvl ? (enseignantsParNiveau.get(lvl) ?? []) : [],
        ]);
      } else {
        participantsList = conversation.participants.map((p) => toParticipantFormat(p.user));
      }

      const resolvedName =
        conversation.name ??
        (conversation.type === 'PARENT_CHANNEL' && conversation.level
          ? `Parents — ${conversation.level}`
          : conversation.classId
            ? nomParClasseId.get(conversation.classId)
            : null) ??
        null;

      return {
        id: conversation.id,
        type: conversation.type,
        name: resolvedName,
        classId: conversation.classId,
        level: conversation.level,
        announcementsOnly: conversation.announcementsOnly,
        participants: participantsList,
        lastMessage: conversation.messages[0] ?? null,
        unreadCount: nonLus,
      };
    }),
  );

  return avecMeta.sort((a, b) => {
    const dateA = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const dateB = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
    return dateB - dateA;
  });
}
