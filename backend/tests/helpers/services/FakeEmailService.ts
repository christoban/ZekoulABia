import type { EmailService, EnvoiEmailOptions } from '@domain/ports/services/EmailService';

export class FakeEmailService implements EmailService {
  emailsEnvoyes: EnvoiEmailOptions[] = [];

  async envoyer(options: EnvoiEmailOptions): Promise<void> {
    this.emailsEnvoyes.push(options);
  }

  async envoyerAvecPDF(options: any): Promise<void> {
    this.emailsEnvoyes.push(options);
  }

  vider(): void { this.emailsEnvoyes = []; }
}
