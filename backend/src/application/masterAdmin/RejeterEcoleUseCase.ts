/**
 * APPLICATION LAYER — Use Case : Rejeter une école
 * PENDING → REJECTED avec motif obligatoire
 */
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { EmailService } from '@domain/ports/services/EmailService';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';

export interface RejeterEcoleCommande {
  schoolId: string;
  motif: string;
}

export class RejeterEcoleUseCase {
  constructor(
    private readonly schoolRepository: SchoolRepository,
    private readonly userRepository: UserRepository,
    private readonly emailService: EmailService,
  ) {}

  async execute(commande: RejeterEcoleCommande): Promise<void> {
    if (!commande.motif?.trim()) {
      throw new Error('Un motif de rejet est obligatoire');
    }

    const school = await this.schoolRepository.findById(commande.schoolId);
    if (!school) throw new Error(`École introuvable : ${commande.schoolId}`);

    school.rejeter();
    await this.schoolRepository.update(school);

    // Notifier l'Admin de l'école
    const admins = await this.userRepository.findByRole(school.id, 'ADMIN');
    for (const admin of admins) {
      if (admin.email) {
        void this.emailService.envoyer({
          destinataire: admin.email,
          sujet: `Demande d'accès ZekoulABia — ${school.name}`,
          contenuHtml: `
            <p>Bonjour,</p>
            <p>Votre demande d'accès pour <strong>${school.name}</strong>
            n'a pas pu être approuvée.</p>
            <p><strong>Motif :</strong> ${commande.motif}</p>
            <p>Contactez-nous pour plus d'informations.</p>
          `,
        }).catch(err => console.error('[Email] Échec notification rejet:', (err as Error)?.message));
      }
    }
  }
}
