export interface ConversationRef {
  id: string;
  type: string;
  classId: string | null;
  schoolId: string;
}

export interface MessageData {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  moderationStatus: string;
  createdAt: Date;
  sender?: { id: string; firstName: string; lastName: string; role: string };
  readStatuses?: { userId: string; readAt: Date }[];
  isRead?: boolean;
}

export interface MessageModerationRef {
  id: string;
  senderId: string;
  moderationStatus: string;
  conversationId: string;
}

export interface VerifierAppartenanceParams {
  conversationId: string;
  schoolId: string;
  userId: string;
  role: string;
}

export interface MessagerieRepository {
  // Helpers d'accès (règles de RBAC messagerie, partagées par plusieurs use cases)
  verifierAppartenanceConversation(params: VerifierAppartenanceParams): Promise<ConversationRef>;
  classIdsPertinents(userId: string, role: string): Promise<string[]>;
  destinatairesAutorises(schoolId: string, appelantId: string, appelantRole: string): Promise<Set<string> | null>;

  // Messages
  trouverMessage(id: string): Promise<MessageData | null>;
  creerMessage(data: {
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    moderationStatus: string;
  }): Promise<MessageData>;

  // Conversations privées
  trouverConversationPriveeExistante(schoolId: string, userA: string, userB: string): Promise<ConversationRef | null>;
  creerConversationPrivee(schoolId: string, userA: string, userB: string): Promise<ConversationRef>;

  // Canaux de classe / parents (idempotents)
  creerCanalClasse(schoolId: string, classId: string, className: string): Promise<ConversationRef>;
  creerCanalParents(schoolId: string, classId: string, className: string): Promise<ConversationRef>;

  // Config / utilisateur
  trouverConfigModeration(schoolId: string): Promise<{ messageModeration: boolean } | null>;
  trouverUtilisateurActif(id: string, schoolId: string): Promise<{ id: string } | null>;

  // Listings
  listerConversationsPourAppelant(cmd: {
    schoolId: string;
    appelantId: string;
    role: string;
    classIds: string[];
    estSupervision: boolean;
  }): Promise<unknown[]>;
  listerMessagesPourConversation(cmd: {
    conversationId: string;
    estSupervision: boolean;
    appelantId: string;
    since?: Date;
    page: number;
  }): Promise<{ messages: MessageData[]; mode: 'rattrapage' | 'page'; page?: number }>;
  compterMessagesNonLus(where: Record<string, unknown>): Promise<number>;
  listerEnAttenteModeration(schoolId: string): Promise<unknown[]>;
  trouverMessagePourModeration(messageId: string, schoolId: string): Promise<MessageModerationRef | null>;
  modererMessage(messageId: string, data: {
    moderationStatus: string;
    moderatedById: string;
    moderationReason: string | null;
  }): Promise<MessageData>;
  trouverMessagesNonLus(conversationId: string, seuilDate: Date, userId: string): Promise<{ id: string }[]>;
  marquerMessagesLus(messageIds: string[], userId: string): Promise<number>;
  marquerNotificationsConversationLues(params: { userId: string; schoolId: string; conversationId: string }): Promise<void>;
  listerContacts(where: Record<string, unknown>): Promise<unknown[]>;

  // Participants / destinataires de notification
  listerParticipantsConversation(conversationId: string, excludeUserId: string): Promise<string[]>;
  listerEnseignantsClasse(classId: string): Promise<string[]>;
  trouverProfesseurPrincipalClasse(classId: string): Promise<string | null>;
  listerElevesClasse(classId: string): Promise<string[]>;
  listerParentsClasse(classId: string): Promise<string[]>;
  estEnseignantDeLaClasse(userId: string, classId: string): Promise<boolean>;
  estEleveDeLaClasse(userId: string, classId: string): Promise<boolean>;
  estParentDUnEleveDeLaClasse(userId: string, classId: string): Promise<boolean>;
}