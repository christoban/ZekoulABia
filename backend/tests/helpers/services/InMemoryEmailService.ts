import type { EmailService, EnvoiEmailOptions } from '@domain/ports/services/EmailService';

export class InMemoryEmailService implements EmailService {
  appels: EnvoiEmailOptions[] = [];
  appelsAvecPdf: (EnvoiEmailOptions & { pdf: { nom: string; contenu: Buffer } })[] = [];

  async envoyer(options: EnvoiEmailOptions): Promise<void> {
    this.appels.push(options);
  }

  async envoyerAvecPDF(
    options: EnvoiEmailOptions & { pdf: { nom: string; contenu: Buffer } }
  ): Promise<void> {
    this.appelsAvecPdf.push(options);
  }
}
