import type { EmailService, EnvoiEmailOptions } from '@domain/ports/services/EmailService';
import type { EmailEventType } from '../../../types/email.ts';
import { sendTransactionalEmail } from './EmailService.ts';

export class NodemailerEmailService implements EmailService {
  async envoyer(options: EnvoiEmailOptions): Promise<void> {
    const result = await sendTransactionalEmail({
      recipientEmail: options.destinataire,
      recipientUserId: options.recipientUserId,
      subject: options.sujet,
      html: options.contenuHtml,
      text: options.contenuTexte,
      template: options.eventType || 'domain-email',
      eventType: (options.eventType || 'school_approved') as EmailEventType,
      metadata: options.metadata,
      ...(options.pieceJointe && {
        attachments: [{
          filename: options.pieceJointe.nom,
          content: options.pieceJointe.contenu,
          contentType: options.pieceJointe.mimeType,
        }],
      }),
    });

    if (result.status === 'failed') {
      console.error(`[Email] Échec envoi à ${options.destinataire} : ${result.error}`);
    }
  }

  async envoyerAvecPDF(
    options: EnvoiEmailOptions & { pdf: { nom: string; contenu: Buffer } }
  ): Promise<void> {
    const result = await sendTransactionalEmail({
      recipientEmail: options.destinataire,
      recipientUserId: options.recipientUserId,
      subject: options.sujet,
      html: options.contenuHtml,
      text: options.contenuTexte,
      template: 'domain-email',
      eventType: 'report_card_sent',
      attachments: [{
        filename: options.pdf.nom,
        content: options.pdf.contenu,
        contentType: 'application/pdf',
      }],
    });

    if (result.status === 'failed') {
      console.error(`[Email] Échec envoi bulletin PDF à ${options.destinataire} : ${result.error}`);
    }
  }
}
