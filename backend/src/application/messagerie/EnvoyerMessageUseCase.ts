import type { MessagerieRepository } from '@domain/ports/repositories/MessagerieRepository';
import type { NotificationService } from '@domain/ports/services/NotificationService';
import type { RealtimeSocketPort } from '@domain/ports/services/RealtimeSocketPort';

export interface EnvoyerMessageCommande {
  schoolId: string;
  appelantId: string;
  appelantRole: string;
  clientMessageId: string;
  content: string;
  conversationId?: string;
  destinataireId?: string;
}

export class EnvoyerMessageUseCase {
  constructor(
    private readonly messagerieRepository: MessagerieRepository,
    private readonly notificationService: NotificationService,
    private readonly realtimeSocket: RealtimeSocketPort,
  ) {}

  async execute(cmd: EnvoyerMessageCommande) {
    const content = cmd.content.trim();
    if (!content) throw new Error('Le message ne peut pas être vide.');
    if (!cmd.clientMessageId) throw new Error('Identifiant client du message requis.');

    // Défense en profondeur en plus de l'idempotence HTTP générique (Idempotency-Key) déjà en
    // place — un retry ou un bug frontend qui rejoue le même clientMessageId ne doit jamais créer
    // de doublon : on renvoie simplement le message déjà persisté.
    const existant = await this.messagerieRepository.trouverMessage(cmd.clientMessageId);
    if (existant) return existant;

    const conversation = cmd.conversationId
      ? await this.messagerieRepository.verifierAppartenanceConversation({
          conversationId: cmd.conversationId,
          schoolId: cmd.schoolId,
          userId: cmd.appelantId,
          role: cmd.appelantRole,
        })
      : await this.trouverOuCreerConversationPrivee(cmd);

    let moderationStatus: 'APPROVED' | 'PENDING' = 'APPROVED';
    if (conversation.type === 'CLASS_CHANNEL' || conversation.type === 'PARENT_CHANNEL') {
      const config = await this.messagerieRepository.trouverConfigModeration(cmd.schoolId);
      if (config?.messageModeration) moderationStatus = 'PENDING';
    }

    const message = await this.messagerieRepository.creerMessage({
      id: cmd.clientMessageId,
      conversationId: conversation.id,
      senderId: cmd.appelantId,
      content,
      moderationStatus,
    });

    this.realtimeSocket.emitter(`conversation:${conversation.id}`, 'message:new', message);

    if (moderationStatus === 'APPROVED') {
      await this.notifierParticipants(conversation, cmd.appelantId, cmd.schoolId, message.content, message);
    }

    return message;
  }

  private async trouverOuCreerConversationPrivee(cmd: EnvoyerMessageCommande) {
    if (!cmd.destinataireId) {
      throw new Error('Indiquez une conversation existante ou un destinataire.');
    }
    if (cmd.destinataireId === cmd.appelantId) {
      throw new Error('Vous ne pouvez pas vous écrire à vous-même.');
    }

    const autorises = await this.messagerieRepository.destinatairesAutorises(cmd.schoolId, cmd.appelantId, cmd.appelantRole);
    if (autorises && !autorises.has(cmd.destinataireId)) {
      throw new Error("Vous ne pouvez pas écrire à ce destinataire.");
    }

    const destinataire = await this.messagerieRepository.trouverUtilisateurActif(cmd.destinataireId, cmd.schoolId);
    if (!destinataire) throw new Error('Destinataire introuvable.');

    const existante = await this.messagerieRepository.trouverConversationPriveeExistante(
      cmd.schoolId,
      cmd.appelantId,
      cmd.destinataireId,
    );
    if (existante) return existante;

    return this.messagerieRepository.creerConversationPrivee(
      cmd.schoolId,
      cmd.appelantId,
      cmd.destinataireId,
    );
  }

  /** Notifie (socket temps réel + push + cloche) les autres participants d'une conversation qu'un message est arrivé. */
  private async notifierParticipants(
    conversation: { id: string; type: string; classId: string | null },
    expediteurId: string,
    schoolId: string,
    contenu: string,
    message: unknown,
  ) {
    let destinataireIds: string[] = [];

    if (conversation.type === 'PRIVATE') {
      destinataireIds = await this.messagerieRepository.listerParticipantsConversation(conversation.id, expediteurId);
    } else if (conversation.classId) {
      const [enseignants, professeurPrincipal, students, parentsLinks] = await Promise.all([
        this.messagerieRepository.listerEnseignantsClasse(conversation.classId),
        this.messagerieRepository.trouverProfesseurPrincipalClasse(conversation.classId),
        conversation.type === 'CLASS_CHANNEL'
          ? this.messagerieRepository.listerElevesClasse(conversation.classId)
          : Promise.resolve([]),
        conversation.type === 'PARENT_CHANNEL'
          ? this.messagerieRepository.listerParentsClasse(conversation.classId)
          : Promise.resolve([]),
      ]);

      destinataireIds = [
        ...enseignants,
        ...(professeurPrincipal ? [professeurPrincipal] : []),
        ...students,
        ...parentsLinks,
      ].filter((id) => id !== expediteurId);
      destinataireIds = Array.from(new Set(destinataireIds));
    }

    // Émettre en direct vers la room personnelle de chaque destinataire connecté
    // (met à jour instantanément la liste des conversations et le badge sidebar)
    for (const userId of destinataireIds) {
      this.realtimeSocket.emitter(`user:${userId}`, 'message:new', message);
    }

    const apercu = contenu.length > 80 ? `${contenu.slice(0, 80)}…` : contenu;

    await Promise.allSettled(
      destinataireIds.map((userId) =>
        this.notificationService.envoyer({
          schoolId,
          userId,
          type: 'COMMUNICATION',
          titre: 'Nouveau message',
          corps: apercu,
          urgency: 'NORMAL',
          metadata: { conversationId: conversation.id },
        }),
      ),
    );
  }
}
