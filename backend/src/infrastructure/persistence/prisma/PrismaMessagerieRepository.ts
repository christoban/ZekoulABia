import type { PrismaClient, ModerationStatus } from '@prisma/client';
import type {
  MessagerieRepository,
  ConversationRef,
  MessageData,
  MessageModerationRef,
  VerifierAppartenanceParams,
} from '@domain/ports/repositories/MessagerieRepository';
import { whereProfilesParClasse } from '@application/shared/studentEnrollment';

const TAILLE_PAGE = 30;
const TAILLE_RATTRAPAGE_MAX = 200;

export class PrismaMessagerieRepository implements MessagerieRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async verifierAppartenanceConversation(params: VerifierAppartenanceParams): Promise<ConversationRef> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: params.conversationId, schoolId: params.schoolId },
      select: { id: true, type: true, classId: true, schoolId: true },
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
    if (!conversation.classId) throw new Error('Conversation invalide (canal sans classe).');

    if (conversation.type === 'CLASS_CHANNEL') {
      if (role === 'TEACHER' && (await this.estEnseignantDeLaClasse(params.userId, conversation.classId))) return conversation;
      if (role === 'STUDENT' && (await this.estEleveDeLaClasse(params.userId, conversation.classId))) return conversation;
      throw new Error("Vous n'avez pas accès à ce canal de classe.");
    }

    if (conversation.type === 'PARENT_CHANNEL') {
      if (role === 'TEACHER' && (await this.estEnseignantDeLaClasse(params.userId, conversation.classId))) return conversation;
      if (role === 'PARENT' && (await this.estParentDUnEleveDeLaClasse(params.userId, conversation.classId))) return conversation;
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
    if (role !== 'PARENT' && role !== 'STUDENT') return null;

    const classIds = await this.classIdsPertinents(appelantId, role);

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
      select: { id: true, type: true, classId: true, schoolId: true },
    });
  }

  async creerConversationPrivee(schoolId: string, userA: string, userB: string): Promise<ConversationRef> {
    return this.prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.create({
        data: {
          schoolId,
          type: 'PRIVATE',
          participants: {
            create: [{ userId: userA }, { userId: userB }],
          },
        },
        select: { id: true, type: true, classId: true, schoolId: true },
      });
      return conversation;
    });
  }

  async creerCanalClasse(schoolId: string, classId: string, className: string): Promise<ConversationRef> {
    const existant = await this.prisma.conversation.findFirst({
      where: { schoolId, classId, type: 'CLASS_CHANNEL' },
    });
    if (existant) return existant;
    return this.prisma.conversation.create({
      data: { schoolId, classId, type: 'CLASS_CHANNEL', name: `Classe — ${className}` },
    }) as Promise<ConversationRef>;
  }

  async creerCanalParents(schoolId: string, classId: string, className: string): Promise<ConversationRef> {
    const existant = await this.prisma.conversation.findFirst({
      where: { schoolId, classId, type: 'PARENT_CHANNEL' },
    });
    if (existant) return existant;
    return this.prisma.conversation.create({
      data: { schoolId, classId, type: 'PARENT_CHANNEL', name: `Parents — ${className}` },
    }) as Promise<ConversationRef>;
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

  async listerConversationsPourAppelant(cmd: {
    schoolId: string;
    appelantId: string;
    role: string;
    classIds: string[];
    estSupervision: boolean;
  }): Promise<unknown[]> {
    const role = cmd.role.toUpperCase();
    const { classIds, estSupervision, appelantId, schoolId } = cmd;

    const where: Record<string, unknown> = {
      schoolId,
      OR: [
        { type: 'PRIVATE', participants: { some: { userId: appelantId } } },
        estSupervision
          ? { type: { in: ['CLASS_CHANNEL', 'PARENT_CHANNEL'] } }
          : {
              OR: [
                ...(classIds.length && (role === 'TEACHER' || role === 'STUDENT') ? [{ type: 'CLASS_CHANNEL', classId: { in: classIds } }] : []),
                ...(classIds.length && (role === 'TEACHER' || role === 'PARENT') ? [{ type: 'PARENT_CHANNEL', classId: { in: classIds } }] : []),
              ],
            },
      ],
    };

    const conversations = await this.prisma.conversation.findMany({
      where,
      include: {
        participants: { include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, content: true, createdAt: true, senderId: true } },
      },
    });

    const classIdsAAfficher = Array.from(new Set(conversations.map((c: any) => c.classId).filter(Boolean))) as string[];
    const classes = classIdsAAfficher.length
      ? await this.prisma.class.findMany({ where: { id: { in: classIdsAAfficher } }, select: { id: true, name: true } })
      : [];
    const nomParClasseId = new Map(classes.map((c: any) => [c.id, c.name]));

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

        return {
          id: conversation.id,
          type: conversation.type,
          name: conversation.name ?? (conversation.classId ? nomParClasseId.get(conversation.classId) : null) ?? null,
          classId: conversation.classId,
          participants: conversation.participants.map((p: any) => p.user),
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
      sender: { select: { id: true, firstName: true, lastName: true, role: true } },
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
}