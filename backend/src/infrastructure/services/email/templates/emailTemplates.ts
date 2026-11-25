import type { ReportPeriod } from "../../../../domain/academic/reporting.ts";

type Language = "fr" | "en";

const formatPeriodLabel = (period: ReportPeriod, language: Language) => {
  if (language === "fr") {
    if (period === "term1") return "Trimestre 1";
    if (period === "term2") return "Trimestre 2";
    if (period === "term3") return "Trimestre 3";
    return "Annuel";
  }

  if (period === "term1") return "Term 1";
  if (period === "term2") return "Term 2";
  if (period === "term3") return "Term 3";
  return "Annual";
};

const shell = (title: string, subtitle: string, body: string) => {
  return `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>${title}</title>
    </head>
    <body style="margin:0;background:#f6f8fb;font-family:Segoe UI,Arial,sans-serif;color:#1f2937;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
        <tr>
          <td align="center">
            <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
              <tr>
                <td style="background:#0f766e;color:#ffffff;padding:20px 24px;">
                  <div style="font-size:22px;font-weight:700;">ZEKOULABIA</div>
                  <div style="font-size:14px;opacity:0.9;">${subtitle}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:24px;line-height:1.6;font-size:15px;">${body}</td>
              </tr>
              <tr>
                <td style="padding:16px 24px;background:#f9fafb;color:#6b7280;font-size:12px;">
                  Message automatique ZEKOULABIA. Merci de ne pas repondre a cet email.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
};

export const buildReportCardTemplate = (payload: {
  recipientName: string;
  period: ReportPeriod;
  yearName: string;
  average: number;
  mention: string;
  totalExams: number;
  language?: Language;
}) => {
  const {
    recipientName,
    period,
    yearName,
    average,
    mention,
    totalExams,
    language = "fr",
  } = payload;
  const isFr = language === "fr";
  const periodLabel = formatPeriodLabel(period, language);
  const subjectLine = isFr
    ? `Bulletin disponible - ${periodLabel}`
    : `Report card available - ${periodLabel}`;
  const body = isFr
    ? `
    <p>Bonjour <strong>${recipientName}</strong>,</p>
    <p>Le bulletin ${periodLabel} pour l'annee ${yearName} est maintenant disponible.</p>
    <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;margin:12px 0;">
      <tr><td><strong>Moyenne:</strong></td><td>${average}%</td></tr>
      <tr><td><strong>Mention:</strong></td><td>${mention}</td></tr>
      <tr><td><strong>Nombre d'examens:</strong></td><td>${totalExams}</td></tr>
    </table>
    <p>Connectez-vous a ZEKOULABIA pour consulter le bulletin complet.</p>
  `
    : `
    <p>Hello <strong>${recipientName}</strong>,</p>
    <p>Your ${periodLabel} report card for ${yearName} is now available.</p>
    <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;margin:12px 0;">
      <tr><td><strong>Average:</strong></td><td>${average}%</td></tr>
      <tr><td><strong>Mention:</strong></td><td>${mention}</td></tr>
      <tr><td><strong>Total exams:</strong></td><td>${totalExams}</td></tr>
    </table>
    <p>Sign in to ZEKOULABIA to view the full report card.</p>
  `;

  return {
    subject: subjectLine,
    html: shell(subjectLine, isFr ? "Bulletin scolaire" : "Report card", body),
    text: isFr
      ? `Bonjour ${recipientName}, votre bulletin ${periodLabel} (${yearName}) est disponible. Moyenne: ${average}%, mention: ${mention}.`
      : `Hello ${recipientName}, your ${periodLabel} report card (${yearName}) is available. Average: ${average}%, mention: ${mention}.`,
  };
};

export const buildPaymentReminderTemplate = (payload: {
  studentName: string;
  totalOutstanding: number;
  currency?: string;
  language?: Language;
}) => {
  const { studentName, totalOutstanding, currency = "XAF", language = "fr" } = payload;
  const isFr = language === "fr";
  const amount = `${Math.round(totalOutstanding).toLocaleString("fr-CM")} ${currency}`;

  const subject = isFr ? "Rappel de paiement - ZEKOULABIA" : "Payment reminder - ZEKOULABIA";
  const body = isFr
    ? `
      <p>Bonjour,</p>
      <p>Nous vous informons que <strong>${studentName}</strong> a un montant impaye de <strong>${amount}</strong>.</p>
      <p>Merci de regulariser des que possible.</p>
    `
    : `
      <p>Hello,</p>
      <p>Please note that <strong>${studentName}</strong> has an outstanding balance of <strong>${amount}</strong>.</p>
      <p>Please complete payment as soon as possible.</p>
    `;

  return {
    subject,
    html: shell(subject, isFr ? "Rappel finance" : "Finance reminder", body),
    text: isFr
      ? `Rappel ZEKOULABIA: ${studentName} a un montant impaye de ${amount}. Merci de regulariser.`
      : `ZEKOULABIA reminder: ${studentName} has an outstanding balance of ${amount}. Please complete payment.`,
    sms: isFr
      ? `Rappel ZEKOULABIA: ${studentName} a un montant impaye de ${amount}. Merci de regulariser.`
      : `ZEKOULABIA reminder: ${studentName} has an outstanding balance of ${amount}. Please complete payment.`,
  };
};

export const buildSchoolInviteTemplate = (payload: {
  schoolName: string;
  requestedAdminName: string;
  activationUrl: string;
  /** "bilingual" = FR + EN dans le même email (langue du destinataire encore inconnue à l'invitation). */
  language?: Language | "bilingual";
}) => {
  const { schoolName, requestedAdminName, activationUrl, language = "fr" } = payload;

  const frBody = `
      <p>Bonjour <strong>${requestedAdminName}</strong>,</p>
      <p>Votre établissement <strong>${schoolName}</strong> est prêt pour l'activation.</p>
      <p><a href="${activationUrl}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 16px;border-radius:8px;text-decoration:none;">Activer l'établissement</a></p>
      <p>Ce lien est personnel et temporaire.</p>
    `;
  const enBody = `
      <p>Hello <strong>${requestedAdminName}</strong>,</p>
      <p>Your school <strong>${schoolName}</strong> is ready for activation.</p>
      <p><a href="${activationUrl}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 16px;border-radius:8px;text-decoration:none;">Activate school</a></p>
      <p>This link is personal and temporary.</p>
    `;
  const frText = `Bonjour ${requestedAdminName}, votre établissement ${schoolName} est prêt. Activez-le ici: ${activationUrl}`;
  const enText = `Hello ${requestedAdminName}, your school ${schoolName} is ready. Activate it here: ${activationUrl}`;

  // Email BILINGUE : bloc FR + séparateur + bloc EN, sujet dans les deux langues.
  if (language === "bilingual") {
    const subject = `Invitation ZEKOULABIA / ZEKOULABIA Invitation - ${schoolName}`;
    const divider = `<hr style="border:none;border-top:1px solid #e5e7eb;margin:26px 0;" /><p style="color:#6b7280;font-size:13px;margin:0 0 6px;">🇬🇧 English version below</p>`;
    return {
      subject,
      html: shell(subject, "Invitation / School invitation", `${frBody}${divider}${enBody}`),
      text: `${frText}\n\n— — — — —\n\n${enText}`,
    };
  }

  const isFr = language === "fr";
  const subject = isFr ? `Invitation ZEKOULABIA - ${schoolName}` : `ZEKOULABIA invite - ${schoolName}`;
  return {
    subject,
    html: shell(subject, isFr ? "Invitation établissement" : "School invitation", isFr ? frBody : enBody),
    text: isFr ? frText : enText,
  };
};

export const buildOnboardingLinkTemplate = (payload: {
  nomProvisoire: string;
  schoolName: string;
  formUrl: string;
  expiryDays: number;
  language?: Language;
}) => {
  const { nomProvisoire, schoolName, formUrl, expiryDays, language = "fr" } = payload;
  const isFr = language === "fr";

  const subject = isFr ? `Inscription de ${nomProvisoire} - ${schoolName}` : `${nomProvisoire}'s enrollment - ${schoolName}`;
  const body = isFr
    ? `
      <p>Bonjour,</p>
      <p><strong>${schoolName}</strong> vous invite à compléter le dossier d'inscription de <strong>${nomProvisoire}</strong>.</p>
      <p><a href="${formUrl}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 16px;border-radius:8px;text-decoration:none;">Compléter le dossier</a></p>
      <p>Ce lien est personnel et valable ${expiryDays} jours.</p>
    `
    : `
      <p>Hello,</p>
      <p><strong>${schoolName}</strong> invites you to complete <strong>${nomProvisoire}</strong>'s enrollment file.</p>
      <p><a href="${formUrl}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 16px;border-radius:8px;text-decoration:none;">Complete the file</a></p>
      <p>This link is personal and valid for ${expiryDays} days.</p>
    `;
  const text = isFr
    ? `${schoolName} vous invite à compléter le dossier d'inscription de ${nomProvisoire}: ${formUrl}`
    : `${schoolName} invites you to complete ${nomProvisoire}'s enrollment file: ${formUrl}`;

  return { subject, html: shell(subject, isFr ? "Inscription élève" : "Student enrollment", body), text };
};

export const buildOnboardingPasswordSetupTemplate = (payload: {
  recipientName: string;
  schoolName: string;
  setupUrl: string;
  language?: Language;
}) => {
  const { recipientName, schoolName, setupUrl, language = "fr" } = payload;
  const isFr = language === "fr";

  const subject = isFr ? `Configurez votre mot de passe - ${schoolName}` : `Set up your password - ${schoolName}`;
  const body = isFr
    ? `
      <p>Bonjour <strong>${recipientName}</strong>,</p>
      <p>Le dossier d'inscription a été validé par <strong>${schoolName}</strong>. Votre compte est prêt.</p>
      <p><a href="${setupUrl}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 16px;border-radius:8px;text-decoration:none;">Configurer mon mot de passe</a></p>
      <p>Ce lien est personnel et temporaire.</p>
    `
    : `
      <p>Hello <strong>${recipientName}</strong>,</p>
      <p>The enrollment file has been validated by <strong>${schoolName}</strong>. Your account is ready.</p>
      <p><a href="${setupUrl}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 16px;border-radius:8px;text-decoration:none;">Set up my password</a></p>
      <p>This link is personal and temporary.</p>
    `;
  const text = isFr
    ? `Votre compte ${schoolName} est prêt. Configurez votre mot de passe: ${setupUrl}`
    : `Your ${schoolName} account is ready. Set up your password: ${setupUrl}`;

  return { subject, html: shell(subject, isFr ? "Configuration du compte" : "Account setup", body), text };
};

export const buildCredentialsTemplate = (payload: {
  roleLabel: string;
  loginIdentifier: string;
  temporaryPassword: string;
  language?: Language;
}) => {
  const { roleLabel, loginIdentifier, temporaryPassword, language = "fr" } = payload;
  const isFr = language === "fr";
  const subject = isFr ? `Vos identifiants ZEKOULABIA - ${roleLabel}` : `Your ZEKOULABIA credentials - ${roleLabel}`;
  const body = isFr
    ? `<p>Bonjour,</p><p>Votre compte <strong>${roleLabel}</strong> ZEKOULABIA est prêt.</p><p>Identifiant : <strong>${loginIdentifier}</strong><br />Mot de passe temporaire : <strong>${temporaryPassword}</strong></p><p>Vous devez modifier ce mot de passe lors de votre première connexion.</p>`
    : `<p>Hello,</p><p>Your ZEKOULABIA <strong>${roleLabel}</strong> account is ready.</p><p>Login: <strong>${loginIdentifier}</strong><br />Temporary password: <strong>${temporaryPassword}</strong></p><p>You must change this password on your first login.</p>`;
  const text = isFr
    ? `Votre compte ZEKOULABIA (${roleLabel}) est prêt. Identifiant: ${loginIdentifier}. Mot de passe temporaire: ${temporaryPassword}. Changez-le à la première connexion.`
    : `Your ZEKOULABIA account (${roleLabel}) is ready. Login: ${loginIdentifier}. Temporary password: ${temporaryPassword}. Change it on your first login.`;

  return { subject, html: shell(subject, isFr ? "Identifiants de connexion" : "Login credentials", body), text };
};
