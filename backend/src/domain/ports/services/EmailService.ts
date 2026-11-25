/**
 * DOMAIN LAYER — Port Service Email
 */
export interface EnvoiEmailOptions {
  destinataire: string;
  sujet: string;
  contenuHtml: string;
  contenuTexte?: string;
  pieceJointe?: {
    nom: string;
    contenu: Buffer;
    mimeType: string;
  };
  metadata?: Record<string, unknown>;
  eventType?: string;
  /** Si le destinataire a déjà un compte, permet le push-d'abord (voir PLAN_NOTIFICATIONS_PUSH.md Phase B). */
  recipientUserId?: string;
}

export interface EmailService {
  envoyer(options: EnvoiEmailOptions): Promise<void>;
  envoyerAvecPDF(options: EnvoiEmailOptions & {
    pdf: { nom: string; contenu: Buffer };
  }): Promise<void>;
}
