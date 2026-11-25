import type { Request, Response, NextFunction } from 'express';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import { sendContactRequestEmail, sendTransactionalEmail } from '../../services/email/EmailService.ts';

export class PublicController {
  constructor(private readonly schoolRepository: SchoolRepository) { }

  // GET /api/v2/public/schools — liste publique des écoles joignables (APPROVED, ACTIVE, SUSPENDED)
  // Retourne uniquement les champs nécessaires au sélecteur — jamais le statut ni le motif de suspension
  listSchools = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schools = (await this.schoolRepository.findAll())
        .filter((s) => ['APPROVED', 'ACTIVE', 'SUSPENDED'].includes(s.status))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => {
          const o = s.toObject();
          return { id: o.id, name: o.name, subdomain: o.subdomain, city: o.city, region: o.region, logoUrl: o.logoUrl };
        });
      res.json({ success: true, data: schools });
    } catch (error) {
      next(error);
    }
  };

  demoRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { nom, nomEtablissement, email, telephone, ville, nbEleves, message } = req.body as Record<string, string>;

      if (!nom?.trim() || !nomEtablissement?.trim() || !email?.trim()) {
        res.status(400).json({ success: false, message: 'Nom complet, nom de l\'établissement et email sont requis.' });
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        res.status(400).json({ success: false, message: 'Adresse email invalide.' });
        return;
      }

      const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'zekoulabia.noreply@gmail.com';
      const nbElevesLabel: Record<string, string> = {
        'lt100': 'Moins de 100 élèves',
        '100-300': '100 – 300 élèves',
        '300-500': '300 – 500 élèves',
        '500plus': '500+ élèves',
      };

      const whatsappLink = telephone?.trim()
        ? `<a href="https://wa.me/${telephone.replace(/\D/g, '')}" style="color:#059669;">${telephone.trim()}</a>`
        : '—';

      // Structure table-based : seule façon fiable pour tous les clients email
      // (Gmail desktop, Outlook, Apple Mail, mobile)
      const html = `
        <table width="100%" cellspacing="0" cellpadding="0" border="0"
          style="font-family:Arial,sans-serif;background-color:#f7f3ee;">
          <tr>
            <td align="center" style="padding:20px 12px;">

              <!-- Conteneur principal 580px max -->
              <table width="100%" cellspacing="0" cellpadding="0" border="0"
                style="max-width:580px;">

                <!-- En-tête vert foncé -->
                <tr>
                  <td align="center" bgcolor="#1a2e1e"
                    style="background-color:#1a2e1e;padding:22px 20px;border-radius:12px 12px 0 0;">
                    <p style="color:white;margin:0;font-size:20px;font-weight:bold;
                      font-family:Arial,sans-serif;">
                      🎓 ZekoulABia — Nouvelle demande de démo
                    </p>
                  </td>
                </tr>

                <!-- Corps blanc -->
                <tr>
                  <td style="background-color:#ffffff;padding:26px 22px;
                    border-radius:0 0 12px 12px;border:1px solid #e8e0d4;">

                    <p style="color:#1a1209;font-size:15px;margin:0 0 18px;
                      font-family:Arial,sans-serif;">
                      Une nouvelle demande de démonstration vient d'être soumise
                      depuis la landing page.
                    </p>

                    <!-- Section Contact -->
                    <p style="color:#059669;font-size:15px;font-weight:bold;
                      margin:0 0 10px;font-family:Arial,sans-serif;">👤 Contact</p>
                    <table width="100%" cellspacing="0" cellpadding="0" border="0"
                      style="font-size:14px;margin-bottom:20px;
                        border-collapse:collapse;">
                      <tr>
                        <td style="padding:9px 10px;color:#6b5c45;font-weight:600;
                          width:38%;border-bottom:1px solid #f0ebe3;">Nom complet</td>
                        <td style="padding:9px 10px;color:#1a1209;font-weight:800;
                          border-bottom:1px solid #f0ebe3;">${nom.trim()}</td>
                      </tr>
                      <tr>
                        <td style="padding:9px 10px;color:#6b5c45;font-weight:600;
                          border-bottom:1px solid #f0ebe3;">Email</td>
                        <td style="padding:9px 10px;border-bottom:1px solid #f0ebe3;">
                          <a href="mailto:${email.trim()}"
                            style="color:#059669;font-weight:700;text-decoration:none;">
                            ${email.trim()}
                          </a>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:9px 10px;color:#6b5c45;font-weight:600;">
                          Téléphone (WhatsApp)
                        </td>
                        <td style="padding:9px 10px;color:#1a1209;">${whatsappLink}</td>
                      </tr>
                    </table>

                    <!-- Section Établissement -->
                    <p style="color:#1d4ed8;font-size:15px;font-weight:bold;
                      margin:0 0 10px;font-family:Arial,sans-serif;">🏫 Établissement</p>
                    <table width="100%" cellspacing="0" cellpadding="0" border="0"
                      style="font-size:14px;margin-bottom:20px;border-collapse:collapse;">
                      <tr>
                        <td style="padding:9px 10px;color:#6b5c45;font-weight:600;
                          width:38%;border-bottom:1px solid #f0ebe3;">Nom</td>
                        <td style="padding:9px 10px;color:#1a1209;font-weight:800;
                          border-bottom:1px solid #f0ebe3;">${nomEtablissement.trim()}</td>
                      </tr>
                      <tr>
                        <td style="padding:9px 10px;color:#6b5c45;font-weight:600;
                          border-bottom:1px solid #f0ebe3;">Ville</td>
                        <td style="padding:9px 10px;color:#1a1209;
                          border-bottom:1px solid #f0ebe3;">${ville?.trim() || '—'}</td>
                      </tr>
                      <tr>
                        <td style="padding:9px 10px;color:#6b5c45;font-weight:600;">
                          Élèves (approx.)
                        </td>
                        <td style="padding:9px 10px;color:#1a1209;">
                          ${nbEleves ? (nbElevesLabel[nbEleves] ?? nbEleves) : '—'}
                        </td>
                      </tr>
                    </table>

                    ${message?.trim() ? `
                    <!-- Message optionnel -->
                    <p style="color:#7c3aed;font-size:15px;font-weight:bold;
                      margin:0 0 10px;font-family:Arial,sans-serif;">💬 Message</p>
                    <table width="100%" cellspacing="0" cellpadding="0" border="0"
                      style="margin-bottom:20px;">
                      <tr>
                        <td style="background-color:#f7f3ee;border-radius:8px;
                          padding:14px;font-size:13px;color:#6b5c45;line-height:1.65;
                          border-left:3px solid #7c3aed;">
                          ${message.trim().replace(/\n/g, '<br>')}
                        </td>
                      </tr>
                    </table>
                    ` : ''}

                    <hr style="border:none;border-top:1px solid #e8e0d4;margin:18px 0;" />
                    <p style="color:#a89478;font-size:11px;text-align:center;margin:0;
                      font-family:Arial,sans-serif;">
                      ZekoulABia · Plateforme de gestion scolaire · Cameroun
                    </p>

                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      `;

      res.json({ success: true, message: 'Demande envoyée avec succès.' });

      void sendTransactionalEmail({
        recipientEmail: superAdminEmail,
        subject: `🎓 Demande de démo — ${nom.trim()} · ${nomEtablissement.trim()}`,
        html,
        template: 'demo_request',
        eventType: 'demo_request',
      }).catch(err => console.error('[Email] Échec demande démo:', (err as Error)?.message));
    } catch (error) {
      next(error);
    }
  };

  contactRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { school, email, phone, message } = req.body;
      if (!school?.trim() || !email?.trim()) {
        res.status(400).json({ message: "Le nom de l'établissement et l'email sont requis." });
        return;
      }

      try {
        await sendContactRequestEmail({
          to: 'zekoulabia.noreply@gmail.com',
          schoolName: school,
          responsibleEmail: email,
          phone: phone || 'Non fourni',
          message: message || 'Aucun message',
        });
      } catch (emailError) {
        console.error('[CONTACT] Email error (non-bloquant):', emailError);
      }

      res.json({ message: "Demande envoyée avec succès ! L'administrateur vous contactera bientôt." });
    } catch (error) {
      next(error);
    }
  };
}
