import type { EmailService } from '@domain/ports/services/EmailService';

export async function envoyerEmailLienInvitation(
  emailService: EmailService,
  userId: string,
  email: string,
  prenom: string,
  nom: string,
  schoolId: string,
  schoolName: string,
): Promise<void> {
  try {
    const frontendUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
    const jwt = await import('jsonwebtoken');
    const inviteToken = jwt.default.sign(
      { sub: userId, email, schoolId, type: 'user_invite' },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' },
    );
    const inviteUrl = `${frontendUrl}/invite/set-password?token=${inviteToken}`;

    await emailService.envoyer({
      destinataire: email,
      sujet: `ZekoulABia — Créez votre mot de passe · ${schoolName}`,
      contenuHtml: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
          <div style="background:#1a2e1e;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
            <h1 style="color:white;margin:0;font-size:20px;">🎓 ZekoulABia</h1>
          </div>
          <div style="background:#ffffff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e8e0d4;">
            <h2 style="color:#1a1209;margin-top:0;">Bonjour ${prenom} ${nom},</h2>
            <p style="color:#6b5c45;font-size:15px;line-height:1.6;">
              Vous avez été invité(e) à rejoindre <strong>ZekoulABia — ${schoolName}</strong>.
              Cliquez sur le bouton ci-dessous pour créer votre mot de passe et accéder à votre espace.
            </p>
            <div style="text-align:center;margin:28px 0 16px;">
              <a href="${inviteUrl}" style="background:linear-gradient(135deg,#059669,#047857);color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block;">
                🔑 Créer mon mot de passe
              </a>
            </div>
            <p style="color:#a89478;font-size:13px;text-align:center;">Ce lien expire dans 7 jours.</p>
            <hr style="border:none;border-top:1px solid #e8e0d4;margin:20px 0;" />
            <p style="color:#a89478;font-size:12px;margin:0;text-align:center;">
              ZekoulABia · Plateforme de gestion scolaire · Cameroun
            </p>
          </div>
        </div>
      `,
      contenuTexte: `ZekoulABia — Créez votre mot de passe · ${schoolName}`,
      eventType: 'user_import',
      metadata: { schoolId },
    });
  } catch {
    // non bloquant
  }
}