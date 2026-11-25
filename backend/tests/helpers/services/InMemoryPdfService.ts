import type { PdfService, ContexteBulletin } from '@domain/ports/services/PdfService';

export class InMemoryPdfService implements PdfService {
  appels: ContexteBulletin[] = [];

  async genererBulletin(contexte: ContexteBulletin): Promise<Buffer> {
    this.appels.push(contexte);
    return Buffer.from('PDF_TEST');
  }

  async genererBulletinsEnMasse(
    contextes: ContexteBulletin[]
  ): Promise<{ bulletinId: string; pdf: Buffer }[]> {
    this.appels.push(...contextes);
    return contextes.map(c => ({ bulletinId: c.bulletin.id, pdf: Buffer.from('PDF_TEST') }));
  }

  async genererTableauHonneur(_params: {
    className: string;
    periodName: string;
    yearName: string;
    schoolName: string;
    schoolCity?: string;
    reportCards: import('@domain/ports/services/PdfService').TableauHonneurLigne[];
  }): Promise<Buffer> {
    return Buffer.from('PDF_TABLEAU_HONNEUR');
  }

  async genererTableauHonneurAnnuel(_params: {
    className: string;
    yearName: string;
    schoolName: string;
    schoolCity?: string;
    ranked: import('@domain/ports/services/PdfService').TableauHonneurAnnuelLigne[];
  }): Promise<Buffer> {
    return Buffer.from('PDF_TABLEAU_HONNEUR_ANNUEL');
  }
}
