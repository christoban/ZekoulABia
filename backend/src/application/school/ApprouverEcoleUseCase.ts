/**
 * APPLICATION LAYER — Use Case : Approuver une école (MasterAdmin)
 * PENDING → APPROVED
 * Notifie l'Admin que l'école est approuvée et l'invite à finaliser la configuration.
 */
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { EmailService } from '@domain/ports/services/EmailService';
import { resolveLanguage } from '../../domain/policies/LanguagePolicy';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';

export interface ApprouverEcoleCommande {
  schoolId: string;
  masterAdminId: string;
}

export interface ApprouverEcoleResultat {
  schoolId: string;
  subdomain: string;
  message: string;
}

export class ApprouverEcoleUseCase {
  constructor(
    private readonly schoolRepository: SchoolRepository,
    private readonly userRepository: UserRepository,
    private readonly emailService: EmailService,
  ) {}

  async execute(commande: ApprouverEcoleCommande): Promise<ApprouverEcoleResultat> {
    // 1. Charger l'école
    const school = await this.schoolRepository.findById(commande.schoolId);
    if (!school) {
      throw new Error(`École introuvable : ${commande.schoolId}`);
    }

    // 2. Approuver (PENDING → APPROVED)
    school.approuver();
    await this.schoolRepository.update(school);

    // 3. Notifier l'Admin — invitation à finaliser la configuration
    const frontendUrl = (process.env.FRONTEND_URL || process.env.CLIENT_URL || process.env.APP_URL || 'http://localhost:3000').trim().replace(/\/+$/, '');
    const configUrl = `${frontendUrl}/admin/configuration?subdomain=${encodeURIComponent(school.subdomain)}`;

    // Langue déjà connue (sous-système fixé sur l'école) → resolveLanguage.
    const langueApprob = resolveLanguage(school.subsystem);
    const A = langueApprob === 'fr'
      ? {
          subject: '✅ Votre école est approuvée — Finalisez la configuration',
          congrats: 'Félicitations !',
          approved: `La demande d'inscription de <strong>${school.name}</strong> a été <strong style="color:#059669;">approuvée</strong>.`,
          login: 'Connectez-vous pour configurer votre espace et finaliser la mise en place de votre établissement sur ZekoulABia.',
          cta: '⚙️ Configurer mon espace',
          direct: 'Lien direct',
          footer: 'ZekoulABia · Plateforme de gestion scolaire · Cameroun',
        }
      : {
          subject: '✅ Your school is approved — Complete the setup',
          congrats: 'Congratulations!',
          approved: `The registration request for <strong>${school.name}</strong> has been <strong style="color:#059669;">approved</strong>.`,
          login: 'Log in to configure your workspace and complete your school setup on ZekoulABia.',
          cta: '⚙️ Configure my workspace',
          direct: 'Direct link',
          footer: 'ZekoulABia · School management platform · Cameroon',
        };

    const admins = await this.userRepository.findByRole(school.id, 'ADMIN');
    for (const admin of admins) {
      if (admin.email) {
        void this.emailService.envoyer({
          destinataire: admin.email,
          sujet: A.subject,
          contenuHtml: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
              <div style="background:#1a2e1e;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
                <h1 style="color:white;margin:0;font-size:24px;">🎓 ZekoulABia</h1>
              </div>
              <div style="background:#ffffff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e8e0d4;">
                <h2 style="color:#1a1209;margin-top:0;">${A.congrats}</h2>
                <p style="color:#6b5c45;font-size:16px;line-height:1.6;">
                  ${A.approved}
                </p>
                <p style="color:#6b5c45;font-size:16px;line-height:1.6;">
                  ${A.login}
                </p>
                <div style="text-align:center;margin:32px 0;">
                  <a href="${configUrl}" style="background:linear-gradient(135deg,#059669,#047857);color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block;">
                    ${A.cta}
                  </a>
                </div>
                <p style="color:#a89478;font-size:13px;">
                  ${A.direct} : <a href="${configUrl}" style="color:#059669;">${configUrl}</a>
                </p>
                <hr style="border:none;border-top:1px solid #e8e0d4;margin:24px 0;" />
                <p style="color:#a89478;font-size:12px;margin:0;">
                  ${A.footer}
                </p>
              </div>
            </div>
          `,
        }).catch(err => console.error('[Email] Échec notification approbation:', (err as Error)?.message));
      }
    }

    return {
      schoolId: school.id,
      subdomain: school.subdomain,
      message: `École "${school.name}" approuvée — en attente de configuration`,
    };
  }
}
