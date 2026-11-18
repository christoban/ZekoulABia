import type { ModerationStatus, PrismaClient } from '@prisma/client';
import type {
  ContactResult,
  ConversationRef,
  MessageData,
  MessageModerationRef,
  MessagerieRepository,
  VerifierAppartenanceParams,
} from '@domain/ports/repositories/MessagerieRepository';
import {
  classIdsPertinentsOp,
  destinatairesAutorisesOp,
  estEleveDeLaClasseOp,
  estEnseignantDeLaClasseOp,
  estEnseignantDuNiveauOp,
  estParentDUnEleveDeLaClasseOp,
  estParentDUnEleveDuNiveauOp,
  listerElevesClasseOp,
  listerParentsClasseOp,
  listerParticipantsConversationOp,
  niveauxPertinentsOp,
  rechercherContactsOp,
} from './helpers/messagerieBroadcastHelpers';
import {
  listerConversationsPourAppelantOp,
  verifierAppartenanceConversationOp,
} from './helpers/messagerieThreadHelpers';
import {
  listerEnAttenteModerationOp,
  listerMessagesPourConversationOp,
  marquerMessagesLusOp,
  marquerNotificationsConversationLuesOp,
  modererMessageOp,
  trouverMessagesNonLusOp,
} from './helpers/messagerieMessageHelpers';

const CONVERSATION_REF_SELECT = {
  id: true,
  type: true,
  classId: true,
  schoolId: true,
  announcementsOnly: true,
} as const;

export class PrismaMessagerieRepository implements MessagerieRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async verifierAppartenanceConversation(params: VerifierAppartenanceParams): Promise<ConversationRef> {
    return verifierAppartenanceConversationOp(this.prisma, params);
  }

  async classIdsPertinents(userId: string, role: string): Promise<string[]> {
    return classIdsPertinentsOp(this.prisma, userId, role);
  }

  async destinatairesAutorises(schoolId: string, appelantId: string, appelantRole: string): Promise<Set<string> | null> {
    return destinatairesAutorisesOp(this.prisma, schoolId, appelantId, appelantRole);
  }

  async trouverMessage(id: string): Promise<MessageData | null> {
    return this.prisma.message.findUnique({
      where: { id },
      include: { sender: { select: { id: true, firstName: true, lastName: true, role: true } } },
    });
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
    });
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
      select: CONVERSATION_REF_SELECT,
    });
  }

  async creerConversationPrivee(schoolId: string, userA: string, userB: string): Promise<ConversationRef> {
    return this.prisma.conversation.create({
      data: {
        schoolId,
        type: 'PRIVATE',
        announcementsOnly: false,
        participants: { create: [{ userId: userA }, { userId: userB }] },
      },
      select: CONVERSATION_REF_SELECT,
    });
  }

  async creerCanalClasse(schoolId: string, classId: string, className: string): Promise<ConversationRef> {
    const existant = await this.prisma.conversation.findFirst({
      where: { schoolId, classId, type: 'CLASS_CHANNEL' },
      select: CONVERSATION_REF_SELECT,
    });
    if (existant) return existant;
    return this.prisma.conversation.create({
      data: { schoolId, classId, type: 'CLASS_CHANNEL', name: `Classe — ${className}`, announcementsOnly: true },
      select: CONVERSATION_REF_SELECT,
    });
  }

  async creerCanalParents(schoolId: string, classId: string, className: string): Promise<ConversationRef> {
    const existant = await this.prisma.conversation.findFirst({
      where: { schoolId, classId, type: 'PARENT_CHANNEL' },
      select: CONVERSATION_REF_SELECT,
    });
    if (existant) return existant;
    return this.prisma.conversation.create({
      data: { schoolId, classId, type: 'PARENT_CHANNEL', name: `Parents — ${className}`, announcementsOnly: true },
      select: CONVERSATION_REF_SELECT,
    });
  }

  async trouverConfigModeration(schoolId: string): Promise<{ messageModeration: boolean } | null> {
    return this.prisma.schoolConfig.findUnique({ where: { schoolId }, select: { messageModeration: true } });
  }

  async trouverUtilisateurActif(id: string, schoolId: string): Promise<{ id: string } | null> {
    return this.prisma.user.findFirst({ where: { id, schoolId, isActive: true }, select: { id: true } });
  }

  async niveauxPertinents(userId: string, role: string, schoolId: string): Promise<string[]> {
    return niveauxPertinentsOp(this.prisma, userId, role, schoolId);
  }

  async estEnseignantDuNiveau(userId: string, schoolId: string, level: string): Promise<boolean> {
    return estEnseignantDuNiveauOp(this.prisma, userId, schoolId, level);
  }

  async estParentDUnEleveDuNiveau(userId: string, schoolId: string, level: string): Promise<boolean> {
    return estParentDUnEleveDuNiveauOp(this.prisma, userId, schoolId, level);
  }

  async listerConversationsPourAppelant(cmd: {
    schoolId: string;
    appelantId: string;
    role: string;
    classIds: string[];
    estSupervision: boolean;
  }): Promise<unknown[]> {
    return listerConversationsPourAppelantOp(this.prisma, cmd);
  }

  async listerMessagesPourConversation(cmd: {
    conversationId: string;
    estSupervision: boolean;
    appelantId: string;
    since?: Date;
    page: number;
  }): Promise<{ messages: MessageData[]; mode: 'rattrapage' | 'page'; page?: number }> {
    return listerMessagesPourConversationOp(this.prisma, cmd);
  }

  async compterMessagesNonLus(where: Record<string, unknown>): Promise<number> {
    return this.prisma.message.count({ where });
  }

  async listerEnAttenteModeration(schoolId: string): Promise<unknown[]> {
    return listerEnAttenteModerationOp(this.prisma, schoolId);
  }

  async trouverMessagePourModeration(messageId: string, schoolId: string): Promise<MessageModerationRef | null> {
    return this.prisma.message.findFirst({
      where: { id: messageId, conversation: { schoolId } },
      select: { id: true, senderId: true, moderationStatus: true, conversationId: true },
    });
  }

  async modererMessage(messageId: string, data: { moderationStatus: string; moderatedById: string; moderationReason: string | null }): Promise<MessageData> {
    return modererMessageOp(this.prisma, messageId, data);
  }

  async trouverMessagesNonLus(conversationId: string, seuilDate: Date, userId: string): Promise<{ id: string }[]> {
    return trouverMessagesNonLusOp(this.prisma, conversationId, seuilDate, userId);
  }

  async marquerMessagesLus(messageIds: string[], userId: string): Promise<number> {
    return marquerMessagesLusOp(this.prisma, messageIds, userId);
  }

  async marquerNotificationsConversationLues(params: { userId: string; schoolId: string; conversationId: string }): Promise<void> {
    return marquerNotificationsConversationLuesOp(this.prisma, params);
  }

  async listerContacts(where: Record<string, unknown>): Promise<unknown[]> {
    return this.prisma.user.findMany({
      where,
      select: { id: true, firstName: true, lastName: true, role: true },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
    });
  }

  async listerParticipantsConversation(conversationId: string, excludeUserId: string): Promise<string[]> {
    return listerParticipantsConversationOp(this.prisma, conversationId, excludeUserId);
  }

  async listerEnseignantsClasse(classId: string): Promise<string[]> {
    const assignments = await this.prisma.teachingAssignment.findMany({ where: { classId }, select: { teacherId: true } });
    return assignments.map((a) => a.teacherId);
  }

  async trouverProfesseurPrincipalClasse(classId: string): Promise<string | null> {
    const classe = await this.prisma.class.findUnique({ where: { id: classId }, select: { professorPrincipalId: true } });
    return classe?.professorPrincipalId ?? null;
  }

  async listerElevesClasse(classId: string): Promise<string[]> {
    return listerElevesClasseOp(this.prisma, classId);
  }

  async listerParentsClasse(classId: string): Promise<string[]> {
    return listerParentsClasseOp(this.prisma, classId);
  }

  async estEnseignantDeLaClasse(userId: string, classId: string): Promise<boolean> {
    return estEnseignantDeLaClasseOp(this.prisma, userId, classId);
  }

  async estEleveDeLaClasse(userId: string, classId: string): Promise<boolean> {
    return estEleveDeLaClasseOp(this.prisma, userId, classId);
  }

  async estParentDUnEleveDeLaClasse(userId: string, classId: string): Promise<boolean> {
    return estParentDUnEleveDeLaClasseOp(this.prisma, userId, classId);
  }

  async changerParametresCanal(conversationId: string, data: { announcementsOnly: boolean }): Promise<ConversationRef> {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { announcementsOnly: data.announcementsOnly },
      select: CONVERSATION_REF_SELECT,
    });
  }

  async trouverConversation(conversationId: string, schoolId: string): Promise<ConversationRef | null> {
    return this.prisma.conversation.findFirst({
      where: { id: conversationId, schoolId },
      select: CONVERSATION_REF_SELECT,
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
    return rechercherContactsOp(this.prisma, cmd);
  }
}
