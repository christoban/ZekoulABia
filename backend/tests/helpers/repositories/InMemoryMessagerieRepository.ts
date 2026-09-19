import type {
  MessagerieRepository,
  ConversationRef,
  MessageData,
  VerifierAppartenanceParams,
} from '@domain/ports/repositories/MessagerieRepository';

export class InMemoryMessagerieRepository implements MessagerieRepository {
  private conversations: ConversationRef[] = [];
  private messages: MessageData[] = [];
  private participants = new Map<string, string[]>(); // conversationId → userIds
  private classIdsPertinentsResult: string[] = [];
  private destinatairesResult: Set<string> | null = null;

  ajouterConversation(c: ConversationRef): void {
    this.conversations.push(c);
  }
  ajouterMessage(m: MessageData): void {
    this.messages.push(m);
  }
  setClassIdsPertinents(ids: string[]): void { this.classIdsPertinentsResult = ids; }
  setDestinatairesAutorises(s: Set<string> | null): void { this.destinatairesResult = s; }

  async verifierAppartenanceConversation(params: VerifierAppartenanceParams): Promise<ConversationRef> {
    const c = this.conversations.find((x) => x.id === params.conversationId && x.schoolId === params.schoolId);
    if (!c) throw new Error('Conversation introuvable.');
    if (c.type === 'PRIVATE') {
      const p = this.participants.get(c.id) ?? [];
      if (!p.includes(params.userId)) throw new Error("Vous ne faites pas partie de cette conversation.");
    }
    return c;
  }
  async classIdsPertinents(): Promise<string[]> { return this.classIdsPertinentsResult; }
  async destinatairesAutorises(): Promise<Set<string> | null> { return this.destinatairesResult; }
  async trouverMessage(id: string): Promise<MessageData | null> { return this.messages.find((m) => m.id === id) ?? null; }
  async creerMessage(data: { id: string; conversationId: string; senderId: string; content: string; moderationStatus: string }): Promise<MessageData> {
    const m: MessageData = { ...data, createdAt: new Date() };
    this.messages.push(m);
    return m;
  }
  async trouverConversationPriveeExistante(): Promise<ConversationRef | null> { return null; }
  async creerConversationPrivee(schoolId: string, userA: string, userB: string): Promise<ConversationRef> {
    const c: ConversationRef = { id: `conv-${this.conversations.length + 1}`, type: 'PRIVATE', classId: null, schoolId };
    this.conversations.push(c);
    this.participants.set(c.id, [userA, userB]);
    return c;
  }
  async creerCanalClasse(schoolId: string, classId: string, className: string): Promise<ConversationRef> {
    const c: ConversationRef = { id: `conv-class-${classId}`, type: 'CLASS_CHANNEL', classId, schoolId };
    this.conversations.push(c);
    return c;
  }
  async creerCanalParents(schoolId: string, classId: string, className: string): Promise<ConversationRef> {
    const c: ConversationRef = { id: `conv-parent-${classId}`, type: 'PARENT_CHANNEL', classId, schoolId };
    this.conversations.push(c);
    return c;
  }
  async trouverConfigModeration(): Promise<{ messageModeration: boolean } | null> { return null; }
  async trouverUtilisateurActif(id: string): Promise<{ id: string } | null> { return { id }; }
  async listerConversationsPourAppelant(): Promise<unknown[]> { return this.conversations; }
  async listerMessagesPourConversation(): Promise<{ messages: MessageData[]; mode: 'rattrapage' | 'page'; page?: number }> {
    return { messages: this.messages, mode: 'page', page: 1 };
  }
  async compterMessagesNonLus(): Promise<number> { return 0; }
  async listerEnAttenteModeration(): Promise<unknown[]> { return []; }
  async trouverMessagePourModeration(): Promise<null> { return null; }
  async modererMessage(): Promise<MessageData> { throw new Error('not implemented'); }
  async trouverMessagesNonLus(): Promise<{ id: string }[]> { return []; }
  async marquerMessagesLus(): Promise<number> { return 0; }
  async marquerNotificationsConversationLues(): Promise<void> { /* in-memory noop */ }
  async listerContacts(): Promise<unknown[]> { return []; }
  async listerParticipantsConversation(): Promise<string[]> { return []; }
  async listerEnseignantsClasse(): Promise<string[]> { return []; }
  async trouverProfesseurPrincipalClasse(): Promise<string | null> { return null; }
  async listerElevesClasse(): Promise<string[]> { return []; }
  async listerParentsClasse(): Promise<string[]> { return []; }
  async estEnseignantDeLaClasse(): Promise<boolean> { return false; }
  async estEleveDeLaClasse(): Promise<boolean> { return false; }
  async estParentDUnEleveDeLaClasse(): Promise<boolean> { return false; }
}