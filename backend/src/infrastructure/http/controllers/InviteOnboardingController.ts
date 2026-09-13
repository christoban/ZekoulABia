import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { sendTransactionalEmail } from '../../services/email/EmailService.ts';
import { passwordError } from '../../../domain/security/PasswordPolicy';
import type { InvitationRepository } from '../../../domain/ports/repositories/InvitationRepository';
import type { SchoolRepository } from '../../../domain/ports/repositories/SchoolRepository';

const LETTRES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function previewGen(
  config: {
    niveaux1erCycle?: string[]
    classesParNiveau?: Record<string, number>
    conventionNommage?: string
    niveaux2eCycle?: string[]
    filieres?: string[]
    a4Languages?: string[]
    classesParFiliere?: string
    niveauxPrimaire?: string[]
    classesParNiveauPrimaire?: Record<string, number>
  }
): { classes: { name: string; level: string; section: string }[] } {
  const classes: { name: string; level: string; section: string }[] = []
  const conv = config.conventionNommage ?? 'LETTRES'

  // 1er cycle
  if (config.niveaux1erCycle) {
    for (const niveau of config.niveaux1erCycle) {
      const count = config.classesParNiveau?.[niveau] ?? 2
      for (let i = 0; i < Math.min(count, 26); i++) {
        const suffix = conv === 'LETTRES' ? LETTRES[i]
          : conv === 'CHIFFRES' ? `${i + 1}`
            : `${LETTRES[i]}1`
        classes.push({ name: `${niveau} ${suffix}`, level: niveau, section: 'FR' })
      }
    }
  }

  // 2e cycle
  if (config.niveaux2eCycle && config.filieres) {
    const nbClasses = config.classesParFiliere === '3+' ? 3 : parseInt(config.classesParFiliere ?? '1')
    for (const niveau of config.niveaux2eCycle) {
      for (const filiere of config.filieres) {
        // Les filières techniques (TI, F·G·H) ne s'ouvrent qu'à partir de la 1ère
        if (niveau === '2nde' && (/^TI/.test(filiere) || filiere === 'D' || /F\s*·\s*G\s*·\s*H/.test(filiere) || /technique/i.test(filiere))) continue

        // Séries A4 → 1 classe par langue
        if (filiere.startsWith('A4') || filiere.includes('A4')) {
          const langs = config.a4Languages?.length ? config.a4Languages : ['LV']
          for (const lang of langs) {
            classes.push({ name: `${niveau} A4-${lang}`, level: niveau, section: 'FR' })
          }
        } else {
          // Autres filières
          for (let i = 0; i < nbClasses; i++) {
            const suffix = nbClasses > 1 ? ` ${LETTRES[i]}` : ''
            const short = filiere.split('—')[0]?.trim() ?? filiere
            classes.push({ name: `${niveau} ${short}${suffix}`, level: niveau, section: 'FR' })
          }
        }
      }
    }
  }

  // Primaire
  if (config.niveauxPrimaire) {
    for (const niveau of config.niveauxPrimaire) {
      const count = config.classesParNiveauPrimaire?.[niveau] ?? 1
      for (let i = 0; i < Math.min(count, 26); i++) {
        classes.push({ name: `${niveau} ${LETTRES[i]}`, level: niveau, section: 'FR' })
      }
    }
  }

  return { classes }
}

export class InviteOnboardingController {
  constructor(
    private readonly invitationRepository: InvitationRepository,
    private readonly schoolRepository: SchoolRepository,
  ) { }

  // POST /api/v2/onboarding/preview-structure
  previewStructure = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const config = req.body
      const result = previewGen(config)
      const subjects: string[] = []
      res.json({ success: true, data: { ...result, totalClasses: result.classes.length, subjects } })
    } catch (error) {
      next(error)
    }
  }

  // GET /api/v2/onboarding/invite/:token
  validateInvite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.params.token as string;
      const invite = await this.invitationRepository.findByToken(token);

      if (!invite) {
        res.status(404).json({ success: false, message: 'Invitation introuvable ou invalide.' });
        return;
      }
      if (invite.status === 'USED') {
        res.status(410).json({ success: false, message: 'Cette invitation a déjà été utilisée. Votre espace est en cours de configuration.' });
        return;
      }
      if (invite.status === 'EXPIRED' || invite.expiresAt < new Date()) {
        res.status(410).json({ success: false, message: 'Cette invitation a expiré. Contactez ZekoulABia pour en obtenir une nouvelle.' });
        return;
      }

      res.json({
        success: true,
        data: {
          schoolName: invite.schoolName,
          email: invite.email,
          plan: invite.plan,
          notes: invite.notes ?? null,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/onboarding/invite/:token/complete
  completeOnboarding = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.params.token as string;
      const {
        nom, subdomain, adresse, ville, region, telephone, email,
        subsystem, educationType, ownership, admissionType,
        adminPrenom, adminNom, adminEmail, password, logoBase64,
        onboardingConfig,
      } = req.body;

      // admissionType n'a de sens réel que pour educationType=TECHNICAL (GGTC/CETIF) —
      // ignoré silencieusement sinon plutôt que rejeté, cohérent avec le fait que ce
      // n'est jamais un champ obligatoire (défaut MIXTE en base).
      const validAdmissionTypes = ['MIXTE', 'FILLES', 'GARCONS'];
      const admissionTypeValue = educationType === 'TECHNICAL' && validAdmissionTypes.includes(admissionType)
        ? admissionType
        : undefined;

      const required = ['nom', 'subdomain', 'subsystem', 'educationType', 'ownership', 'adminPrenom', 'adminNom', 'adminEmail', 'password'];
      const missing = required.filter(f => !String(req.body[f] ?? '').trim());
      if (missing.length > 0) {
        res.status(400).json({ success: false, message: `Champs manquants : ${missing.join(', ')}` });
        return;
      }
      const pwdErr = passwordError(String(password));
      if (pwdErr) {
        res.status(400).json({ success: false, message: pwdErr });
        return;
      }

      const invite2 = await this.invitationRepository.findByToken(token);
      if (!invite2 || invite2.status !== 'PENDING') {
        res.status(404).json({ success: false, message: 'Invitation invalide ou déjà utilisée.' });
        return;
      }
      if (invite2.expiresAt < new Date()) {
        await this.invitationRepository.marquerExpiree(token);
        res.status(410).json({ success: false, message: 'Cette invitation a expiré.' });
        return;
      }

      if (!invite2.schoolId) {
        res.status(500).json({ success: false, message: 'Invitation corrompue : aucune école associée.' });
        return;
      }

      const subdomainClean = String(subdomain).toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const existing = await this.schoolRepository.findBySubdomain(subdomainClean);
      if (existing && existing.id !== invite2.schoolId) {
        res.status(409).json({ success: false, message: `Le sous-domaine "${subdomainClean}" est déjà pris. Choisissez-en un autre.` });
        return;
      }

      const passwordHash = await bcrypt.hash(String(password), 10);

      const validLogo = typeof logoBase64 === 'string' && logoBase64.startsWith('data:image/') && logoBase64.length <= 2_000_000
        ? logoBase64
        : null;

      const { schoolId } = await this.invitationRepository.completeOnboarding({
        token,
        school: {
          id: invite2.schoolId,
          name: String(nom).trim(),
          subdomain: subdomainClean,
          address: adresse?.trim() || null,
          city: ville?.trim() || null,
          region: region?.trim() || null,
          phone: telephone?.trim() || null,
          email: email?.trim() || null,
          subsystem,
          educationType,
          ownership,
          admissionType: admissionTypeValue,
          plan: invite2.plan,
          logoUrl: validLogo,
          onboardingConfig: onboardingConfig || undefined,
          templateCode: onboardingConfig?.templateCode ?? null,
        },
        admin: {
          email: String(adminEmail).trim().toLowerCase(),
          firstName: String(adminPrenom).trim(),
          lastName: String(adminNom).trim(),
          passwordHash,
        },
      });

      res.status(201).json({
        success: true,
        data: {
          schoolId,
          message: 'Votre demande a été soumise avec succès.',
        },
      });

      // Email de confirmation à l'administrateur de l'école
      sendTransactionalEmail({
        recipientEmail: String(adminEmail),
        subject: 'ZekoulABia — Demande reçue, en attente d\'approbation',
        html: `
          <p>Bonjour ${String(adminPrenom).trim()},</p>
          <p>Votre inscription pour l'établissement <strong>${String(nom).trim()}</strong> a bien été enregistrée.</p>
          <p>Notre équipe va examiner votre dossier sous <strong>24 à 48 heures</strong>. Vous recevrez un email dès validation.</p>
          <p style="color:#888;font-size:13px">ZekoulABia — Plateforme de gestion scolaire · Cameroun</p>
        `,
        template: 'school_invite',
        eventType: 'school_invite',
      }).catch(err => console.error('[Email] Onboarding confirmation error:', err));

      // Notification au Super Admin — envoyée via Resend (destinataire = SUPER_ADMIN_EMAIL)
      const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'zekoulabia.noreply@gmail.com';
      const masterDashboardUrl = `${process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000'}/master/dashboard`;
      const planLabels: Record<string, string> = { DISCOVERY: 'Découverte (gratuit)', STANDARD: 'Standard', PREMIUM: 'Premium' };

      sendTransactionalEmail({
        recipientEmail: superAdminEmail,
        subject: `🏫 Nouvelle demande ZekoulABia — ${String(nom).trim()}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;">
            <div style="background:#1a2e1e;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
              <h1 style="color:white;margin:0;font-size:22px;">🎓 ZekoulABia — Nouvelle demande d'inscription</h1>
            </div>
            <div style="background:#ffffff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e8e0d4;">
              <p style="color:#1a1209;font-size:16px;margin-top:0;">
                Un établissement vient de compléter son formulaire d'inscription et attend votre approbation.
              </p>

              <h2 style="color:#059669;font-size:18px;margin-bottom:16px;">🏫 Informations sur l'établissement</h2>
              <table style="width:100%;border-collapse:collapse;font-size:15px;">
                <tr style="border-bottom:1px solid #f0ebe3;">
                  <td style="padding:10px 12px;color:#6b5c45;font-weight:600;width:40%;">Nom</td>
                  <td style="padding:10px 12px;color:#1a1209;font-weight:800;">${String(nom).trim()}</td>
                </tr>
                <tr style="border-bottom:1px solid #f0ebe3;">
                  <td style="padding:10px 12px;color:#6b5c45;font-weight:600;">Sous-domaine</td>
                  <td style="padding:10px 12px;color:#1a1209;font-family:monospace;">${subdomainClean}</td>
                </tr>
                <tr style="border-bottom:1px solid #f0ebe3;">
                  <td style="padding:10px 12px;color:#6b5c45;font-weight:600;">Plan tarifaire</td>
                  <td style="padding:10px 12px;color:#1a1209;">${planLabels[invite2.plan] ?? invite2.plan}</td>
                </tr>
                <tr style="border-bottom:1px solid #f0ebe3;">
                  <td style="padding:10px 12px;color:#6b5c45;font-weight:600;">Sous-système</td>
                  <td style="padding:10px 12px;color:#1a1209;">${subsystem ?? '—'}</td>
                </tr>
                <tr style="border-bottom:1px solid #f0ebe3;">
                  <td style="padding:10px 12px;color:#6b5c45;font-weight:600;">Type d'enseignement</td>
                  <td style="padding:10px 12px;color:#1a1209;">${educationType ?? '—'}</td>
                </tr>
                <tr style="border-bottom:1px solid #f0ebe3;">
                  <td style="padding:10px 12px;color:#6b5c45;font-weight:600;">Statut juridique</td>
                  <td style="padding:10px 12px;color:#1a1209;">${ownership ?? '—'}</td>
                </tr>
                ${ville ? `<tr style="border-bottom:1px solid #f0ebe3;"><td style="padding:10px 12px;color:#6b5c45;font-weight:600;">Ville</td><td style="padding:10px 12px;color:#1a1209;">${String(ville).trim()}${region ? ` · ${String(region).trim()}` : ''}</td></tr>` : ''}
                ${telephone ? `<tr style="border-bottom:1px solid #f0ebe3;"><td style="padding:10px 12px;color:#6b5c45;font-weight:600;">Téléphone</td><td style="padding:10px 12px;color:#1a1209;">${String(telephone).trim()}</td></tr>` : ''}
              </table>

              <h2 style="color:#1d4ed8;font-size:18px;margin-top:28px;margin-bottom:16px;">👤 Administrateur de l'établissement</h2>
              <table style="width:100%;border-collapse:collapse;font-size:15px;">
                <tr style="border-bottom:1px solid #f0ebe3;">
                  <td style="padding:10px 12px;color:#6b5c45;font-weight:600;width:40%;">Nom complet</td>
                  <td style="padding:10px 12px;color:#1a1209;font-weight:800;">${String(adminPrenom).trim()} ${String(adminNom).trim()}</td>
                </tr>
                <tr>
                  <td style="padding:10px 12px;color:#6b5c45;font-weight:600;">Email</td>
                  <td style="padding:10px 12px;"><a href="mailto:${String(adminEmail).trim()}" style="color:#059669;font-weight:700;">${String(adminEmail).trim()}</a></td>
                </tr>
              </table>

              <div style="text-align:center;margin:32px 0 16px;">
                <a href="${masterDashboardUrl}" style="background:linear-gradient(135deg,#059669,#047857);color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block;">
                  🔍 Examiner la demande sur le dashboard
                </a>
              </div>

              <p style="color:#a89478;font-size:13px;text-align:center;margin:0;">
                Lien direct : <a href="${masterDashboardUrl}" style="color:#059669;">${masterDashboardUrl}</a>
              </p>
              <hr style="border:none;border-top:1px solid #e8e0d4;margin:24px 0;" />
              <p style="color:#a89478;font-size:12px;text-align:center;margin:0;">
                ZekoulABia · Plateforme de gestion scolaire · Cameroun
              </p>
            </div>
          </div>
        `,
        template: 'school_pending_notification',
        eventType: 'school_pending_notification',
      }).catch(err => console.error('[Email] Super admin notification error:', err));
    } catch (error) {
      next(error);
    }
  };
}
