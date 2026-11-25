import type { EmailService } from '@domain/ports/services/EmailService';
import type {
  CredentialsChannel,
  CredentialsNotificationPort,
} from '@domain/ports/services/CredentialsNotificationPort';
import { buildCredentialsTemplate } from '../email/templates/emailTemplates';
import { notifyCredentialsSms } from '../sms/SmsNotificationService';

export type SendCredentialsParams = {
  schoolId: string;
  email?: string | null;
  phone?: string | null;
  os?: string | null;
  temporaryPassword: string;
  roleLabel: string;
  loginIdentifier: string;
  schoolName?: string;
};

function isDevMode(): boolean {
  return process.env.NODE_ENV === 'development';
}

export class CredentialsNotificationService implements CredentialsNotificationPort {
  constructor(private readonly emailService: EmailService) {}

  async sendCredentials(params: SendCredentialsParams): Promise<CredentialsChannel> {
    if (isDevMode()) {
      console.info(
        `[DEV] Identifiants créés — ${params.roleLabel} | ` +
          `login: ${params.loginIdentifier} | ` +
          `mot de passe: ${params.temporaryPassword}` +
          (params.email ? ` | email: ${params.email}` : '') +
          (params.phone ? ` | téléphone: ${params.phone}` : ''),
      );
      return 'TERMINAL';
    }

    const email = params.email ?? null;
    const phone = params.phone ?? null;
    const preferEmail = !!email && (!params.os || params.os === 'ANDROID' || params.os === 'IOS');

    if (preferEmail) {
      const template = buildCredentialsTemplate({
        roleLabel: params.roleLabel,
        loginIdentifier: params.loginIdentifier,
        temporaryPassword: params.temporaryPassword,
      });
      await this.emailService.envoyer({
        destinataire: email,
        sujet: template.subject,
        contenuHtml: template.html,
        contenuTexte: template.text,
        eventType: 'user_invite',
        metadata: { schoolId: params.schoolId },
      });
      return 'EMAIL';
    }

    if (phone) {
      await notifyCredentialsSms({
        schoolId: params.schoolId,
        phone,
        roleLabel: params.roleLabel,
        loginIdentifier: params.loginIdentifier,
        temporaryPassword: params.temporaryPassword,
      });
      return 'SMS';
    }

    return 'PHYSICAL';
  }
}