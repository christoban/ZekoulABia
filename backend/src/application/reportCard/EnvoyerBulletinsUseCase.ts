/**
 * APPLICATION LAYER — Use Case : Envoyer les bulletins aux parents
 * Envoie les PDFs par email à tous les parents d'une classe.
 */
import type { BulletinRepository } from '@domain/ports/repositories/BulletinRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { BulletinValidationRepository } from '@domain/ports/repositories/BulletinValidationRepository';
import type { EmailService } from '@domain/ports/services/EmailService';

export interface EnvoyerBulletinsCommande {
  schoolId: string;
  classId: string;
  academicPeriodId: string;
  nomEtablissement: string;
  nomPeriode: string;
  /** Langue de l'email (résolue par l'appelant : sous-système + section de la classe). Défaut 'fr'. */
  langue?: 'fr' | 'en';
  /** Rôle de l'initiateur (si ADMIN, autorise la finalisation directe du workflow de publication) */
  demandeurRole?: string;
  demandeurId?: string;
}

export interface EnvoyerBulletinsResultat {
  envoyes: number;
  echoues: number;
  dejaEnvoyes?: number;
}

export class EnvoyerBulletinsUseCase {
  constructor(
    private readonly bulletinRepository: BulletinRepository,
    private readonly userRepository: UserRepository,
    private readonly emailService: EmailService,
    private readonly bulletinValidationRepository: BulletinValidationRepository,
  ) {}

  async execute(commande: EnvoyerBulletinsCommande): Promise<EnvoyerBulletinsResultat> {
    // Vérification du workflow de validation : la session doit être PUBLISHED
    let session = await this.bulletinValidationRepository.sessionExistante(
      commande.classId,
      commande.academicPeriodId,
    );

    const estAdmin = commande.demandeurRole?.toUpperCase() === 'ADMIN';

    if (!session) {
      if (estAdmin && commande.demandeurId) {
        // L'ADMIN crée et publie directement la session pour cette classe et période
        session = await this.bulletinValidationRepository.creerSession({
          schoolId: commande.schoolId,
          classId: commande.classId,
          academicPeriodId: commande.academicPeriodId,
          submittedById: commande.demandeurId,
        });
        await this.bulletinValidationRepository.validerSession(session.id, commande.demandeurId);
        await this.bulletinValidationRepository.publierSession(session.id);
        await this.bulletinRepository.majStatutWorkflowParClasse(
          commande.classId,
          commande.academicPeriodId,
          commande.schoolId,
          'PUBLISHED',
        );
      } else {
        throw new Error(
          'Publication non autorisée : aucune session de validation n\'existe pour cette classe et cette période.'
        );
      }
    } else if (session.status !== 'PUBLISHED') {
      if (estAdmin && commande.demandeurId) {
        if (session.status === 'SUBMITTED') {
          await this.bulletinValidationRepository.validerSession(session.id, commande.demandeurId);
        }
        await this.bulletinValidationRepository.publierSession(session.id);
        await this.bulletinRepository.majStatutWorkflowParClasse(
          commande.classId,
          commande.academicPeriodId,
          commande.schoolId,
          'PUBLISHED',
        );
      } else {
        throw new Error(
          'Publication non autorisée : le workflow de validation du bulletin n\'est pas complété pour cette classe et cette période.'
        );
      }
    }

    const bulletins = await this.bulletinRepository.findByClasse(
      commande.classId,
      commande.academicPeriodId
    );

    if (bulletins.length === 0) {
      throw new Error('Aucun bulletin trouvé pour cette classe. Veuillez d\'abord cliquer sur « Générer les bulletins ».');
    }

    const generes = bulletins.filter((b) => b.estGenere() && !b.estEnvoye());
    const dejaEnvoyes = bulletins.filter((b) => b.estEnvoye()).length;

    if (generes.length === 0 && dejaEnvoyes > 0) {
      return { envoyes: 0, echoues: 0, dejaEnvoyes };
    }

    let envoyes = 0;
    let echoues = 0;

    for (const bulletin of generes) {
      try {
        const eleve = await this.userRepository.findById(bulletin.studentId);
        if (!eleve) continue;

        // Envoi aux parents — pas à l'élève (qui souvent n'a pas d'email au Cameroun)
        const emailsParents = await this.userRepository.findEmailsParentsParEleve(bulletin.studentId);

        // Fallback : si aucun parent avec email, essayer l'email de l'élève lui-même
        const destinataires = emailsParents.length > 0
          ? emailsParents
          : eleve.email ? [eleve.email] : [];

        if (destinataires.length === 0) continue;

        const langue = commande.langue ?? 'fr';
        const sujet = langue === 'fr'
          ? `Bulletin scolaire — ${commande.nomPeriode} — ${commande.nomEtablissement}`
          : `Report card — ${commande.nomPeriode} — ${commande.nomEtablissement}`;
        const contenuHtml = langue === 'fr'
          ? `
          <p>Bonjour,</p>
          <p>Veuillez trouver ci-joint le bulletin scolaire de <strong>${eleve.nomComplet}</strong>
          pour la période : <strong>${commande.nomPeriode}</strong>.</p>
          <p>Cordialement,<br/>${commande.nomEtablissement}</p>
        `
          : `
          <p>Hello,</p>
          <p>Please find attached the report card of <strong>${eleve.nomComplet}</strong>
          for the period: <strong>${commande.nomPeriode}</strong>.</p>
          <p>Best regards,<br/>${commande.nomEtablissement}</p>
        `;

        for (const email of destinataires) {
          // recipientUserId permet le push-d'abord (voir PLAN_NOTIFICATIONS_PUSH.md Phase B) —
          // sans lui, cet envoi tombait par défaut sur eventType 'school_approved' côté
          // NodemailerEmailService (aucun eventType explicite fourni ici auparavant), donc
          // n'était jamais reconnu comme "bulletin disponible" ; corrigé au passage.
          const destinataireUser = await this.userRepository.findByEmail(email, commande.schoolId);
          await this.emailService.envoyer({
            destinataire: email,
            recipientUserId: destinataireUser?.id,
            sujet,
            contenuHtml,
            eventType: 'report_card_available',
          });
        }

        bulletin.marquerEnvoye();
        await this.bulletinRepository.update(bulletin);
        envoyes++;
      } catch {
        echoues++;
      }
    }

    return { envoyes, echoues };
  }
}