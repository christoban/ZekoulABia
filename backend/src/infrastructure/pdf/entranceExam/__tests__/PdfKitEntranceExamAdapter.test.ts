import { describe, expect, it } from 'bun:test';
import { PdfKitEntranceExamAdapter } from '../PdfKitEntranceExamAdapter';

describe('PdfKitEntranceExamAdapter', () => {
  const adapter = new PdfKitEntranceExamAdapter();

  it('génère une convocation PDF valide avec signature PDF (%PDF)', async () => {
    const pdfBuffer = await adapter.genererConvocationPdf({
      schoolName: 'Collège Bilingue Saint Joseph',
      sessionName: 'Session Juin 2026',
      examDate: new Date('2026-06-25'),
      candidateNumber: 'STJOSE-C042',
      candidateFullName: 'Kengne Patrick',
      dateOfBirth: new Date('2014-07-12'),
      originSchool: 'École Publique Bastos',
      roomName: 'Salle 12 (Bâtiment C)',
      deskNumber: 15,
      subjects: [
        { name: 'Mathématiques', coefficient: 3, maxScore: 20 },
        { name: 'Français', coefficient: 2, maxScore: 20 },
      ],
    });

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    // Vérifier l'en-tête PDF standard
    const header = pdfBuffer.subarray(0, 5).toString('ascii');
    expect(header).toBe('%PDF-');
  });

  it('génère une liste d émargement PDF valide au format paysage', async () => {
    const pdfBuffer = await adapter.genererListeEmargementPdf({
      schoolName: 'Collège Bilingue Saint Joseph',
      sessionName: 'Session Juin 2026',
      examDate: new Date('2026-06-25'),
      roomName: 'Salle 12',
      candidates: [
        { candidateNumber: 'STJOSE-C001', fullName: 'Abena Marie', deskNumber: 1, dateOfBirth: new Date('2014-01-10') },
        { candidateNumber: 'STJOSE-C002', fullName: 'Biya Paul', deskNumber: 2, dateOfBirth: new Date('2014-02-13') },
      ],
    });

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    const header = pdfBuffer.subarray(0, 5).toString('ascii');
    expect(header).toBe('%PDF-');
  });
});
