import type { PrismaClient, ModerationStatus } from '@prisma/client';
import type {
  MessagerieRepository,
  ConversationRef,
  ContactResult,
  MessageData,
  MessageModerationRef,
  VerifierAppartenanceParams,
} from '@domain/ports/repositories/MessagerieRepository';
import { whereProfilesParClasse, whereProfilesParClasses } from '@application/shared/studentEnrollment';

const TAILLE_PAGE = 30;
const TAILLE_RATTRAPAGE_MAX = 200;

export class PrismaMessagerieRepository implements MessagerieRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async verifierAppartenanceConversation(params: VerifierAppartenanceParams): Promise<ConversationRef> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: params.conversationId, schoolId: params.schoolId },
      select: { id: true, type: true, classId: true, level: true, schoolId: true, announcementsOnly: true },
    });
    if (!conversation) throw new Error('Conversation introuvable.');

    const role = params.role.toUpperCase();

    if (conversation.type === 'PRIVATE') {
      const participant = await this.prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId: conversation.id, userId: params.userId } },
      });
      if (!participant) throw new Error("Vous ne faites pas partie de cette conversation.");
      return conversation;
    }

    if (role === 'ADMIN' || role === 'STAFF') return conversation;

    if (conversation.type === 'CLASS_CHANNEL') {
      if (!conversation.classId) throw new Error('Conversation invalide (canal sans classe).');
      if (role === 'TEACHER' && (await this.estEnseignantDeLaClasse(params.userId, conversation.classId))) return conversation;
      if (role === 'STUDENT' && (await this.estEleveDeLaClasse(params.userId, conversation.classId))) return conversation;
      throw new Error("Vous n'avez pas accès à ce canal de classe.");
    }

    if (conversation.type === 'PARENT_CHANNEL') {
      if (conversation.level) {
        if (role === 'TEACHER' && (await this.estEnseignantDuNiveau(params.userId, params.schoolId, conversation.level))) return conversation;
        if (role === 'PARENT' && (await this.estParentDUnEleveDuNiveau(params.userId, params.schoolId, conversation.level))) return conversation;
      } else if (conversation.classId) {
        if (role === 'TEACHER' && (await this.estEnseignantDeLaClasse(params.userId, conversation.classId))) return conversation;
        if (role === 'PARENT' && (await this.estParentDUnEleveDeLaClasse(params.userId, conversation.classId))) return conversation;
      }
      throw new Error("Vous n'avez pas accès à ce canal parents.");
    }

    throw new Error('Type de conversation non pris en charge.');
  }

  async classIdsPertinents(userId: string, role: string): Promise<string[]> {
    const upperRole = role.toUpperCase();

    if (upperRole === 'TEACHER') {
      const [assignments, classesPp] = await Promise.all([
        this.prisma.teachingAssignment.findMany({ where: { teacherId: userId }, select: { classId: true } }),
        this.prisma.class.findMany({ where: { professorPrincipalId: userId }, select: { id: true } }),
      ]);
      return Array.from(new Set([
        ...assignments.map((a: any) => a.classId),
        ...classesPp.map((c: any) => c.id),
      ]));
    }

    if (upperRole === 'STUDENT') {
      const classId = await this.getClassIdActuelEleve(userId);
      return classId ? [classId] : [];
    }

    if (upperRole === 'PARENT') {
      const children = await this.prisma.parentStudent.findMany({
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
          .map((c: any) => c.studentProfile?.enrollmentsYearScoped?.[0]?.classId)
          .filter((id: string | null | undefined): id is string => !!id),
      ));
    }

    return [];
  }

  async destinatairesAutorises(schoolId: string, appelantId: string, appelantRole: string): Promise<Set<string> | null> {
    const role = appelantRole.toUpperCase();
    if (role === 'STUDENT') {
      // Les élèves n'ont pas accès aux messages privés : aucun destinataire autorisé
      return new Set<string>();
    }

    // ADMIN et STAFF : pas de restriction sur les destinataires (mais le frontend
    // impose une recherche textuelle, jamais une liste brute)
    if (role === 'ADMIN' || role === 'STAFF') return null;

    const classIds = await this.classIdsPertinents(appelantId, role);

    if (role === 'TEACHER') {
      // Enseignant → parents et élèves de ses classes + collègues enseignants + staff + admin
      const [parentsLinks, students, colleagues, staffEtAdmin] = await Promise.all([
        classIds.length
          ? this.prisma.parentStudent.findMany({
              where: { studentProfile: whereProfilesParClasses(classIds) },
              select: { parentProfile: { select: { userId: true } } },
            })
          : Promise.resolve([]),
        classIds.length
          ? this.prisma.studentProfile.findMany({
              where: { ...whereProfilesParClasses(classIds) },
              select: { userId: true },
            })
          : Promise.resolve([]),
        this.prisma.user.findMany({ where: { schoolId, role: 'TEACHER', isActive: true, id: { not: appelantId } }, select: { id: true } }),
        this.prisma.user.findMany({ where: { schoolId, role: { in: ['STAFF', 'ADMIN'] }, isActive: true }, select: { id: true } }),
      ]);
      return new Set<string>([
        ...parentsLinks.map((p: any) => p.parentProfile.userId),
        ...students.map((s: any) => s.userId),
        ...colleagues.map((u: any) => u.id),
        ...staffEtAdmin.map((u: any) => u.id),
      ]);
    }

    // PARENT → enseignants de ses enfants + PP + staff + admin
    const [assignments, classesPp, staffEtAdmin] = await Promise.all([
      classIds.length
        ? this.prisma.teachingAssignment.findMany({ where: { classId: { in: classIds } }, select: { teacherId: true } })
        : Promise.resolve([]),
      classIds.length
        ? this.prisma.class.findMany({ where: { id: { in: classIds }, professorPrincipalId: { not: null } }, select: { professorPrincipalId: true } })
        : Promise.resolve([]),
      this.prisma.user.findMany({ where: { schoolId, role: { in: ['STAFF', 'ADMIN'] }, isActive: true }, select: { id: true } }),
    ]);

    return new Set<string>([
      ...assignments.map((a: any) => a.teacherId),
      ...classesPp.map((c: any) => c.professorPrincipalId as string),
      ...staffEtAdmin.map((u: any) => u.id),
    ]);
  }

  async trouverMessage(id: string): Promise<MessageData | null> {
    return this.prisma.message.findUnique({
      where: { id },
      include: { sender: { select: { id: true, firstName: true, lastName: true, role: true } } },
    }) as Promise<MessageData | null>;
  }

  async creerMessage(data: { id: string; conversationId: string; senderId: string; content: string; moderationStatus: string }): Promise<MessageData> {
    return this.prisma.message.create({
      data: {
        id: data.id,
        conversationId: data.conversationId,
        senderId: data.senderId,
        content: data.content,
        moderationStatus: data.moderationStatus as ModerationStatus,
      },
      include: { sender: { select: { id: true, firstName: true, lastName: true, role: true } } },
    }) as Promise<MessageData>;
  }

  async trouverConversationPriveeExistante(schoolId: string, userA: string, userB: string): Promise<ConversationRef | null> {
    return this.prisma.conversation.findFirst({
      where: {
        schoolId,
        type: 'PRIVATE',
        AND: [
          { participants: { some: { userId: userA } } },
          { participants: { some: { userId: userB } } },
        ],
      },
      select: { id: true, type: true, classId: true, schoolId: true, announcementsOnly: true },
    });
  }

  async creerConversationPrivee(schoolId: string, userA: string, userB: string): Promise<ConversationRef> {
    return this.prisma.conversation.create({
      data: {
        schoolId,
        type: 'PRIVATE',
        announcementsOnly: false,
        participants: {
          create: [{ userId: userA }, { userId: userB }],
        },
      },
      select: { id: true, type: true, classId: true, schoolId: true, announcementsOnly: true },
    });
  }

  async creerCanalClasse(schoolId: string, classId: string, className: string): Promise<ConversationRef> {
    const existant = await this.prisma.conversation.findFirst({
      where: { schoolId, classId, type: 'CLASS_CHANNEL' },
      select: { id: true, type: true, classId: true, schoolId: true, announcementsOnly: true },
    });
    if (existant) return existant;
    return this.prisma.conversation.create({
      data: { schoolId, classId, type: 'CLASS_CHANNEL', name: `Classe — ${className}`, announcementsOnly: true },
      select: { id: true, type: true, classId: true, schoolId: true, announcementsOnly: true },
    });
  }

  async creerCanalParents(schoolId: string, classId: string, className: string): Promise<ConversationRef> {
    const existant = await this.prisma.conversation.findFirst({
      where: { schoolId, classId, type: 'PARENT_CHANNEL' },
      select: { id: true, type: true, classId: true, schoolId: true, announcementsOnly: true },
    });
    if (existant) return existant;
    return this.prisma.conversation.create({
      data: { schoolId, classId, type: 'PARENT_CHANNEL', name: `Parents — ${className}`, announcementsOnly: true },
      select: { id: true, type: true, classId: true, schoolId: true, announcementsOnly: true },
    });
  }

  async trouverConfigModeration(schoolId: string): Promise<{ messageModeration: boolean } | null> {
    return this.prisma.schoolConfig.findUnique({
      where: { schoolId },
      select: { messageModeration: true },
    });
  }

  async trouverUtilisateurActif(id: string, schoolId: string): Promise<{ id: string } | null> {
    return this.prisma.user.findFirst({
      where: { id, schoolId, isActive: true },
      select: { id: true },
    });
  }

  private async trouverMembresDirection(schoolId: string): Promise<Array<{ id: string; firstName: string; lastName: string; role: string; staffTitle: string | null }>> {
    const [admins, staff] = await Promise.all([
      this.prisma.user.findMany({
        where: { schoolId, role: 'ADMIN', isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
          staffProfile: { select: { title: true } },
        },
      }),
      this.prisma.user.findMany({
        where: { schoolId, role: 'STAFF', isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
          staffProfile: { select: { title: true } },
        },
      }),
    ]);

    const directionStaff = staff.filter((s: any) => {
      const title = (s.staffProfile?.title || '').toLowerCase();
      const isCenseur = /censeur|vice[- ]?principal|dean.*studies/i.test(title);
      const isOrientation = /orientation|counselor|conseill/i.test(title);
      return isCenseur || isOrientation;
    });

    const uniqueMap = new Map<string, { id: string; firstName: string; lastName: string; role: string; staffTitle: string | null }>();
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

  async niveauxPertinents(userId: string, role: string, schoolId: string): Promise<string[]> {
    const upperRole = role.toUpperCase();
    if (upperRole === 'ADMIN' || upperRole === 'STAFF') {
      const classes = await this.prisma.class.findMany({ where: { schoolId }, select: { level: true, name: true } });
      return Array.from(new Set(classes.map((c: any) => (c.level?.trim() || c.name.split(' ')[0]).trim()))).filter(Boolean);
    }
    if (upperRole === 'STUDENT') {
      return [];
    }
    const classIds = await this.classIdsPertinents(userId, role);
    if (!classIds.length) return [];
    const classes = await this.prisma.class.findMany({
      where: { id: { in: classIds } },
      select: { level: true, name: true },
    });
    return Array.from(new Set(classes.map((c: any) => (c.level?.trim() || c.name.split(' ')[0]).trim()))).filter(Boolean);
  }

  async estEnseignantDuNiveau(userId: string, schoolId: string, level: string): Promise<boolean> {
    const classes = await this.prisma.class.findMany({
      where: { schoolId, OR: [{ level }, { name: { startsWith: level } }] },
      select: { id: true, professorPrincipalId: true },
    });
    const classIds = classes.map((c: any) => c.id);
    if (!classIds.length) return false;

    const [assignment, isPp] = await Promise.all([
      this.prisma.teachingAssignment.findFirst({ where: { classId: { in: classIds }, teacherId: userId }, select: { id: true } }),
      classes.some((c: any) => c.professorPrincipalId === userId),
    ]);
    return Boolean(assignment || isPp);
  }

  async estParentDUnEleveDuNiveau(userId: string, schoolId: string, level: string): Promise<boolean> {
    const classes = await this.prisma.class.findMany({
      where: { schoolId, OR: [{ level }, { name: { startsWith: level } }] },
      select: { id: true },
    });
    const classIds = classes.map((c: any) => c.id);
    if (!classIds.length) return false;

    const count = await this.prisma.parentStudent.count({
      where: {
        parentProfile: { userId },
        studentProfile: {
          enrollmentsYearScoped: {
            some: { classId: { in: classIds }, status: 'ACTIVE' },
          },
        },
      },
    });
    return count > 0;
  }

  private static dernieresVerificationsCanaux = new Map<string, number>();

  private async assurerCanauxPourClasses(schoolId: string): Promise<void> {
    const dernierCheck = PrismaMessagerieRepository.dernieresVerificationsCanaux.get(schoolId);
    const maintenant = Date.now();
    if (dernierCheck && maintenant - dernierCheck < 5 * 60 * 1000) {
      return;
    }
    PrismaMessagerieRepository.dernieresVerificationsCanaux.set(schoolId, maintenant);

    const classes = await this.prisma.class.findMany({
      where: { schoolId },
      select: { id: true, name: true, level: true },
    });
    if (!classes.length) return;

    // 1. Canaux de classe (CLASS_CHANNEL) pour chaque classe individuelle
    const existingClassChannels = await this.prisma.conversation.findMany({
      where: { schoolId, type: 'CLASS_CHANNEL' },
      select: { classId: true },
    });
    const existingClassIds = new Set(existingClassChannels.map((c: any) => c.classId));
    const toCreateClass: Array<{
      schoolId: string;
      classId: string;
      type: 'CLASS_CHANNEL';
      name: string;
      announcementsOnly: boolean;
    }> = [];

    for (const cl of classes) {
      if (!existingClassIds.has(cl.id)) {
        toCreateClass.push({
          schoolId,
          classId: cl.id,
          type: 'CLASS_CHANNEL',
          name: `Classe — ${cl.name}`,
          announcementsOnly: true,
        });
      }
    }
    if (toCreateClass.length > 0) {
      await this.prisma.conversation.createMany({
        data: toCreateClass,
        skipDuplicates: true,
      });
    }

    // 2. Canaux de parents (PARENT_CHANNEL) par NIVEAU (et non par classe)
    const distinctLevels = Array.from(
      new Set(classes.map((c: any) => (c.level?.trim() || c.name.split(' ')[0]).trim())),
    ).filter(Boolean);

    const existingLevelChannels = await this.prisma.conversation.findMany({
      where: { schoolId, type: 'PARENT_CHANNEL', level: { in: distinctLevels } },
      select: { level: true },
    });
    const existingLevels = new Set(existingLevelChannels.map((c: any) => c.level));

    const toCreateParents: Array<{
      schoolId: string;
      level: string;
      type: 'PARENT_CHANNEL';
      name: string;
      announcementsOnly: boolean;
    }> = [];

    for (const lvl of distinctLevels) {
      if (!existingLevels.has(lvl)) {
        toCreateParents.push({
          schoolId,
          level: lvl,
          type: 'PARENT_CHANNEL',
          name: `Parents — ${lvl}`,
          announcementsOnly: true,
        });
      }
    }
    if (toCreateParents.length > 0) {
      await this.prisma.conversation.createMany({
        data: toCreateParents,
        skipDuplicates: true,
      });
    }
  }

  async listerConversationsPourAppelant(cmd: {
    schoolId: string;
    appelantId: string;
    role: string;
    classIds: string[];
    estSupervision: boolean;
  }): Promise<unknown[]> {
    const role = cmd.role.toUpperCase();
    const { classIds, estSupervision, appelantId, schoolId } = cmd;

    // Auto-initialisation automatique et idempotente des canaux pour toutes les classes
    await this.assurerCanauxPourClasses(schoolId);

    const [directionMembers, niveaux] = await Promise.all([
      this.trouverMembresDirection(schoolId),
      this.niveauxPertinents(appelantId, role, schoolId),
    ]);

    const orConditions: Record<string, unknown>[] = [];
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

    const where: Record<string, unknown> = {
      schoolId,
      OR: orConditions.length ? orConditions : [{ id: '__none__' }],
    };

    const conversations = await this.prisma.conversation.findMany({
      where,
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
                staffProfile: { select: { title: true } },
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, content: true, createdAt: true, senderId: true },
        },
      },
    });

    // Chargement de l'ensemble des classes de l'école pour indexation par nom et par niveau
    const allClasses = await this.prisma.class.findMany({
      where: { schoolId },
      select: { id: true, name: true, level: true },
    });
    const nomParClasseId = new Map(allClasses.map((c: any) => [c.id, c.name]));
    const levelParClasseId = new Map(
      allClasses.map((c: any) => [c.id, (c.level?.trim() || c.name.split(' ')[0]).trim()]),
    );
    const classIdsParLevel = new Map<string, string[]>();
    for (const cl of allClasses) {
      const lvl = (cl.level?.trim() || cl.name.split(' ')[0]).trim();
      const list = classIdsParLevel.get(lvl) ?? [];
      list.push(cl.id);
      classIdsParLevel.set(lvl, list);
    }

    // Résolution groupée des membres réels pour les canaux de classe et de parents
    type ParticipantFormat = { id: string; firstName: string; lastName: string; role: string; staffTitle: string | null };
    const enseignantsParClasse = new Map<string, ParticipantFormat[]>();
    const elevesParClasse = new Map<string, ParticipantFormat[]>();
    const parentsParClasse = new Map<string, ParticipantFormat[]>();

    const classIdsAAfficher = allClasses.map((c: any) => c.id);

    if (classIdsAAfficher.length > 0) {
      const [assignments, classesWithPp, enrollments] = await Promise.all([
        this.prisma.teachingAssignment.findMany({
          where: { classId: { in: classIdsAAfficher } },
          include: {
            teacher: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
                staffProfile: { select: { title: true } },
              },
            },
          },
        }),
        this.prisma.class.findMany({
          where: { id: { in: classIdsAAfficher }, professorPrincipalId: { not: null } },
          select: {
            id: true,
            professorPrincipal: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
                staffProfile: { select: { title: true } },
              },
            },
          },
        }),
        this.prisma.enrollment.findMany({
          where: { classId: { in: classIdsAAfficher }, status: 'ACTIVE' },
          include: {
            student: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    staffProfile: { select: { title: true } },
                  },
                },
              },
            },
          },
        }),
      ]);

      // Enseignants
      for (const a of assignments) {
        if (!a.teacher) continue;
        const list = enseignantsParClasse.get(a.classId) ?? [];
        if (!list.some((u) => u.id === a.teacher.id)) {
          list.push({
            id: a.teacher.id,
            firstName: a.teacher.firstName,
            lastName: a.teacher.lastName,
            role: a.teacher.role,
            staffTitle: a.teacher.staffProfile?.title ?? null,
          });
          enseignantsParClasse.set(a.classId, list);
        }
      }
      // Prof principal
      for (const cl of classesWithPp) {
        if (!cl.professorPrincipal) continue;
        const list = enseignantsParClasse.get(cl.id) ?? [];
        if (!list.some((u) => u.id === cl.professorPrincipal!.id)) {
          list.push({
            id: cl.professorPrincipal.id,
            firstName: cl.professorPrincipal.firstName,
            lastName: cl.professorPrincipal.lastName,
            role: cl.professorPrincipal.role,
            staffTitle: cl.professorPrincipal.staffProfile?.title ?? null,
          });
          enseignantsParClasse.set(cl.id, list);
        }
      }

      // Élèves
      const studentProfileIdToClassId = new Map<string, string>();
      for (const en of enrollments) {
        if (!en.student?.user) continue;
        studentProfileIdToClassId.set(en.studentId, en.classId);
        const list = elevesParClasse.get(en.classId) ?? [];
        if (!list.some((u) => u.id === en.student.user.id)) {
          list.push({
            id: en.student.user.id,
            firstName: en.student.user.firstName,
            lastName: en.student.user.lastName,
            role: en.student.user.role,
            staffTitle: en.student.user.staffProfile?.title ?? null,
          });
          elevesParClasse.set(en.classId, list);
        }
      }

      // Parents
      const studentProfileIds = Array.from(studentProfileIdToClassId.keys());
      if (studentProfileIds.length > 0) {
        const parentLinks = await this.prisma.parentStudent.findMany({
          where: { studentProfileId: { in: studentProfileIds } },
          include: {
            parentProfile: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    staffProfile: { select: { title: true } },
                  },
                },
              },
            },
          },
        });

        for (const pl of parentLinks) {
          const parentUser = pl.parentProfile?.user;
          const targetClassId = studentProfileIdToClassId.get(pl.studentProfileId);
          if (!parentUser || !targetClassId) continue;
          const list = parentsParClasse.get(targetClassId) ?? [];
          if (!list.some((u) => u.id === parentUser.id)) {
            list.push({
              id: parentUser.id,
              firstName: parentUser.firstName,
              lastName: parentUser.lastName,
              role: parentUser.role,
              staffTitle: parentUser.staffProfile?.title ?? null,
            });
            parentsParClasse.set(targetClassId, list);
          }
        }
      }
    }

    // Agréger enseignants et parents par niveau
    const enseignantsParNiveau = new Map<string, ParticipantFormat[]>();
    const parentsParNiveau = new Map<string, ParticipantFormat[]>();

    for (const [lvl, cIds] of classIdsParLevel.entries()) {
      const profsMap = new Map<string, ParticipantFormat>();
      const parentsMap = new Map<string, ParticipantFormat>();

      for (const cId of cIds) {
        for (const p of enseignantsParClasse.get(cId) ?? []) {
          profsMap.set(p.id, p);
        }
        for (const pr of parentsParClasse.get(cId) ?? []) {
          parentsMap.set(pr.id, pr);
        }
      }
      enseignantsParNiveau.set(lvl, Array.from(profsMap.values()));
      parentsParNiveau.set(lvl, Array.from(parentsMap.values()));
    }

    const avecMeta = await Promise.all(
      conversations.map(async (conversation: any) => {
        const nonLus = await this.prisma.message.count({
          where: {
            conversationId: conversation.id,
            senderId: { not: appelantId },
            moderationStatus: 'APPROVED',
            readStatuses: { none: { userId: appelantId } },
          },
        });

        let participantsList: ParticipantFormat[] = [];
        if (conversation.type === 'CLASS_CHANNEL' && conversation.classId) {
          const profs = enseignantsParClasse.get(conversation.classId) ?? [];
          const eleves = elevesParClasse.get(conversation.classId) ?? [];
          // Inclure la direction (Admin, Censeur, Conseiller d'Orientation), les profs et les élèves
          const map = new Map<string, ParticipantFormat>();
          for (const u of [...directionMembers, ...profs, ...eleves]) {
            map.set(u.id, u);
          }
          participantsList = Array.from(map.values());
        } else if (conversation.type === 'PARENT_CHANNEL') {
          const lvl =
            conversation.level ??
            (conversation.classId ? levelParClasseId.get(conversation.classId) : null);
          const parents = lvl ? (parentsParNiveau.get(lvl) ?? []) : [];
          const profs = lvl ? (enseignantsParNiveau.get(lvl) ?? []) : [];
          // Inclure la direction (Admin, Censeur, Conseiller d'Orientation), les parents du niveau et les enseignants du niveau
          const map = new Map<string, ParticipantFormat>();
          for (const u of [...directionMembers, ...parents, ...profs]) {
            map.set(u.id, u);
          }
          participantsList = Array.from(map.values());
        } else {
          participantsList = conversation.participants.map((p: any) => ({
            id: p.user.id,
            firstName: p.user.firstName,
            lastName: p.user.lastName,
            role: p.user.role,
            staffTitle: p.user.staffProfile?.title ?? null,
          }));
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

    return avecMeta.sort((a: any, b: any) => {
      const dateA = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const dateB = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }

  async listerMessagesPourConversation(cmd: {
    conversationId: string;
    estSupervision: boolean;
    appelantId: string;
    since?: Date;
    page: number;
  }): Promise<{ messages: MessageData[]; mode: 'rattrapage' | 'page'; page?: number }> {
    const filtreModeration = cmd.estSupervision
      ? {}
      : { OR: [{ moderationStatus: 'APPROVED' as ModerationStatus }, { senderId: cmd.appelantId }] };

    const includeOpts = {
      sender: { select: { id: true, firstName: true, lastName: true, role: true, staffProfile: { select: { title: true } } } },
      readStatuses: { select: { userId: true, readAt: true } },
    };

    const mapperMessage = (m: any): MessageData => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      content: m.content,
      moderationStatus: m.moderationStatus,
      createdAt: m.createdAt,
      sender: m.sender,
      readStatuses: m.readStatuses ?? [],
      isRead: Array.isArray(m.readStatuses) && m.readStatuses.some((r: any) => r.userId !== m.senderId),
    });

    if (cmd.since) {
      const messages = await this.prisma.message.findMany({
        where: { conversationId: cmd.conversationId, createdAt: { gt: cmd.since }, ...filtreModeration },
        orderBy: { createdAt: 'asc' },
        take: TAILLE_RATTRAPAGE_MAX,
        include: includeOpts,
      });
      return { messages: messages.map(mapperMessage), mode: 'rattrapage' };
    }

    const page = Math.max(1, cmd.page);
    const messagesDesc = await this.prisma.message.findMany({
      where: { conversationId: cmd.conversationId, ...filtreModeration },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * TAILLE_PAGE,
      take: TAILLE_PAGE,
      include: includeOpts,
    });

    return { messages: messagesDesc.reverse().map(mapperMessage), mode: 'page', page };
  }

  async compterMessagesNonLus(where: Record<string, unknown>): Promise<number> {
    return this.prisma.message.count({ where });
  }

  async listerEnAttenteModeration(schoolId: string): Promise<unknown[]> {
    return this.prisma.message.findMany({
      where: { moderationStatus: 'PENDING', conversation: { schoolId } },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, role: true } },
        conversation: { select: { id: true, type: true, name: true, classId: true } },
      },
    });
  }

  async trouverMessagePourModeration(messageId: string, schoolId: string): Promise<MessageModerationRef | null> {
    return this.prisma.message.findFirst({
      where: { id: messageId, conversation: { schoolId } },
      select: { id: true, senderId: true, moderationStatus: true, conversationId: true },
    });
  }

  async modererMessage(messageId: string, data: { moderationStatus: string; moderatedById: string; moderationReason: string | null }): Promise<MessageData> {
    return this.prisma.message.update({
      where: { id: messageId },
      data: {
        moderationStatus: data.moderationStatus as ModerationStatus,
        moderatedById: data.moderatedById,
        moderationReason: data.moderationReason,
      },
      include: { sender: { select: { id: true, firstName: true, lastName: true, role: true } } },
    }) as Promise<MessageData>;
  }

  async trouverMessagesNonLus(conversationId: string, seuilDate: Date, userId: string): Promise<{ id: string }[]> {
    return this.prisma.message.findMany({
      where: {
        conversationId,
        createdAt: { lte: seuilDate },
        senderId: { not: userId },
        readStatuses: { none: { userId } },
      },
      select: { id: true },
    });
  }

  async marquerMessagesLus(messageIds: string[], userId: string): Promise<number> {
    const resultat = await this.prisma.messageReadStatus.createMany({
      data: messageIds.map((messageId) => ({ messageId, userId })),
      skipDuplicates: true,
    });
    return resultat.count;
  }

  async marquerNotificationsConversationLues(params: { userId: string; schoolId: string; conversationId: string }): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        userId: params.userId,
        schoolId: params.schoolId,
        type: 'COMMUNICATION',
        readAt: null,
        metadata: {
          path: ['conversationId'],
          equals: params.conversationId,
        },
      },
      data: {
        readAt: new Date(),
      },
    });
  }

  async listerContacts(where: Record<string, unknown>): Promise<unknown[]> {
    return this.prisma.user.findMany({
      where,
      select: { id: true, firstName: true, lastName: true, role: true },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
    });
  }

  async listerParticipantsConversation(conversationId: string, excludeUserId: string): Promise<string[]> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { type: true, classId: true, level: true, schoolId: true },
    });

    if (!conversation) return [];

    const directionMembers = await this.trouverMembresDirection(conversation.schoolId);
    const directionUserIds = directionMembers.map((m) => m.id);

    if (conversation.type === 'CLASS_CHANNEL' && conversation.classId) {
      const classId = conversation.classId;
      const [assignments, classePp] = await Promise.all([
        this.prisma.teachingAssignment.findMany({ where: { classId }, select: { teacherId: true } }),
        this.prisma.class.findUnique({ where: { id: classId }, select: { professorPrincipalId: true } }),
      ]);
      const profIds = [
        ...assignments.map((a: any) => a.teacherId),
        ...(classePp?.professorPrincipalId ? [classePp.professorPrincipalId] : []),
      ];
      const studentIds = await this.listerElevesClasse(classId);
      return Array.from(new Set([...directionUserIds, ...profIds, ...studentIds])).filter((id) => id !== excludeUserId);
    }

    if (conversation.type === 'PARENT_CHANNEL') {
      let profIds: string[] = [];
      let parentIds: string[] = [];

      if (conversation.level) {
        const classesDuNiveau = await this.prisma.class.findMany({
          where: {
            schoolId: conversation.schoolId,
            OR: [{ level: conversation.level }, { name: { startsWith: conversation.level } }],
          },
          select: { id: true, professorPrincipalId: true },
        });
        const classIds = classesDuNiveau.map((c: any) => c.id);
        const assignments = await this.prisma.teachingAssignment.findMany({
          where: { classId: { in: classIds } },
          select: { teacherId: true },
        });
        profIds = [
          ...assignments.map((a: any) => a.teacherId),
          ...classesDuNiveau.map((c: any) => c.professorPrincipalId).filter((id): id is string => Boolean(id)),
        ];
        const parentLinks = await this.prisma.parentStudent.findMany({
          where: {
            studentProfile: {
              enrollmentsYearScoped: {
                some: { classId: { in: classIds }, status: 'ACTIVE' },
              },
            },
          },
          select: { parentProfile: { select: { userId: true } } },
        });
        parentIds = parentLinks
          .map((pl: any) => pl.parentProfile?.userId)
          .filter((id: any): id is string => Boolean(id));
      } else if (conversation.classId) {
        const classId = conversation.classId;
        const [assignments, classePp] = await Promise.all([
          this.prisma.teachingAssignment.findMany({ where: { classId }, select: { teacherId: true } }),
          this.prisma.class.findUnique({ where: { id: classId }, select: { professorPrincipalId: true } }),
        ]);
        profIds = [
          ...assignments.map((a: any) => a.teacherId),
          ...(classePp?.professorPrincipalId ? [classePp.professorPrincipalId] : []),
        ];
        parentIds = await this.listerParentsClasse(classId);
      }

      return Array.from(new Set([...directionUserIds, ...profIds, ...parentIds])).filter((id) => id !== excludeUserId);
    }

    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId, userId: { not: excludeUserId } },
      select: { userId: true },
    });
    return participants.map((p: any) => p.userId);
  }

  async listerEnseignantsClasse(classId: string): Promise<string[]> {
    const assignments = await this.prisma.teachingAssignment.findMany({ where: { classId }, select: { teacherId: true } });
    return assignments.map((a: any) => a.teacherId);
  }

  async trouverProfesseurPrincipalClasse(classId: string): Promise<string | null> {
    const classe = await this.prisma.class.findUnique({ where: { id: classId }, select: { professorPrincipalId: true } });
    return classe?.professorPrincipalId ?? null;
  }

  async listerElevesClasse(classId: string): Promise<string[]> {
    const students = await this.prisma.studentProfile.findMany({
      where: { ...whereProfilesParClasse(classId) },
      select: { userId: true },
    });
    return students.map((s: any) => s.userId);
  }

  async listerParentsClasse(classId: string): Promise<string[]> {
    const parentsLinks = await this.prisma.parentStudent.findMany({
      where: { studentProfile: whereProfilesParClasse(classId) },
      select: { parentProfile: { select: { userId: true } } },
    });
    return parentsLinks.map((p: any) => p.parentProfile.userId);
  }

  async estEnseignantDeLaClasse(userId: string, classId: string): Promise<boolean> {
    const teacherProfile = await this.prisma.teacherProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!teacherProfile) return false;

    const [assignment, classeCommePp] = await Promise.all([
      this.prisma.teachingAssignment.findFirst({ where: { classId, teacherId: userId }, select: { id: true } }),
      this.prisma.class.findFirst({ where: { id: classId, professorPrincipalId: userId }, select: { id: true } }),
    ]);

    return Boolean(assignment || classeCommePp);
  }

  async estEleveDeLaClasse(userId: string, classId: string): Promise<boolean> {
    const classIdActuel = await this.getClassIdActuelEleve(userId);
    return classIdActuel === classId;
  }

  async estParentDUnEleveDeLaClasse(userId: string, classId: string): Promise<boolean> {
    const count = await this.prisma.parentStudent.count({
      where: {
        parentProfile: { userId },
        studentProfile: whereProfilesParClasse(classId),
      },
    });
    return count > 0;
  }

  private async getClassIdActuelEleve(userId: string): Promise<string | null> {
    const row = await this.prisma.enrollment.findFirst({
      where: { student: { userId }, status: 'ACTIVE', academicYear: { isCurrent: true } },
      select: { classId: true },
    });
    return row?.classId ?? null;
  }

  async changerParametresCanal(conversationId: string, data: { announcementsOnly: boolean }): Promise<ConversationRef> {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { announcementsOnly: data.announcementsOnly },
      select: { id: true, type: true, classId: true, schoolId: true, announcementsOnly: true },
    });
  }

  async trouverConversation(conversationId: string, schoolId: string): Promise<ConversationRef | null> {
    return this.prisma.conversation.findFirst({
      where: { id: conversationId, schoolId },
      select: { id: true, type: true, classId: true, schoolId: true, announcementsOnly: true },
    });
  }

  /**
   * Recherche textuelle de contacts avec filtrage par matrice de communication.
   * Pour ADMIN/STAFF : retourne des résultats seulement si `recherche` est fournie (min 2 chars).
   * Pour TEACHER : filtre par parents/élèves de ses classes + collègues + staff/admin.
   * Pour PARENT : filtre par enseignants des enfants + PP + staff/admin.
   * Pour STUDENT : retourne [] (pas de DM).
   */
  async rechercherContacts(cmd: {
    schoolId: string;
    appelantId: string;
    appelantRole: string;
    recherche: string;
    limite?: number;
  }): Promise<ContactResult[]> {
    const role = cmd.appelantRole.toUpperCase();
    const limite = cmd.limite ?? 20;
    const recherche = cmd.recherche.trim();

    // Élèves : aucun contact (pas de DM)
    if (role === 'STUDENT') return [];

    // Recherche textuelle obligatoire pour tous les rôles
    if (recherche.length < 2) return [];

    const termes = recherche.toLowerCase().split(/\s+/).filter(Boolean);

    // Construire le filtre d'IDs autorisés pour les rôles restreints
    const autorises = await this.destinatairesAutorises(cmd.schoolId, cmd.appelantId, cmd.appelantRole);

    const where: Record<string, unknown> = {
      schoolId: cmd.schoolId,
      isActive: true,
      id: { not: cmd.appelantId },
      // Recherche textuelle : chaque terme doit matcher prénom OU nom
      AND: termes.map((terme) => ({
        OR: [
          { firstName: { contains: terme, mode: 'insensitive' } },
          { lastName: { contains: terme, mode: 'insensitive' } },
        ],
      })),
    };

    // Pour les rôles restreints (TEACHER, PARENT), filtrer par IDs autorisés
    if (autorises !== null) {
      const idsArray = Array.from(autorises);
      if (idsArray.length === 0) return [];
      where.id = { not: cmd.appelantId, in: idsArray };
    }

    const users = await this.prisma.user.findMany({
      where,
      select: { id: true, firstName: true, lastName: true, role: true, staffProfile: { select: { title: true } } },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
      take: limite,
    });

    return users.map((u: any) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      staffTitle: u.staffProfile?.title ?? null,
    }));
  }
}