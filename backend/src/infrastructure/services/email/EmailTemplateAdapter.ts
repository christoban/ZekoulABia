import type { EmailTemplatePort, EmailTemplate } from '@domain/ports/services/EmailTemplatePort';
import { buildSchoolInviteTemplate, buildOnboardingLinkTemplate } from './templates/emailTemplates';

export class EmailTemplateAdapter implements EmailTemplatePort {
  buildSchoolInviteTemplate(payload: {
    schoolName: string;
    requestedAdminName: string;
    activationUrl: string;
    language?: 'fr' | 'en' | 'bilingual';
  }): EmailTemplate {
    return buildSchoolInviteTemplate(payload);
  }

  buildOnboardingLink(payload: {
    nomProvisoire: string;
    schoolName: string;
    formUrl: string;
    expiryDays: number;
    language?: 'fr' | 'en';
  }): EmailTemplate {
    return buildOnboardingLinkTemplate(payload);
  }
}
