export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface EmailTemplatePort {
  buildSchoolInviteTemplate(payload: {
    schoolName: string;
    requestedAdminName: string;
    activationUrl: string;
    language?: 'fr' | 'en' | 'bilingual';
  }): EmailTemplate;
  buildOnboardingLink(payload: {
    nomProvisoire: string;
    schoolName: string;
    formUrl: string;
    expiryDays: number;
    language?: 'fr' | 'en';
  }): EmailTemplate;
}
