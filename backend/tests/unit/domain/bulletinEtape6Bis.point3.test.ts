import { describe, it, expect } from 'bun:test';
import PDFDocument from 'pdfkit';
import type { BulletinSubjectSnapshotLine } from '@domain/types/bulletinSnapshot';
import { TECH_GROUPED_V1 } from '@domain/templates/bulletinCatalog';
import { buildFictitiousPreviewSnapshot } from '@application/reportCard/bulletinAtelierPreview';
import { formatSubjectCell } from '@infrastructure/pdf/renderer/measuredSubjectTableHelpers';
import { MeasuredPdfKitBulletinRenderer } from '@infrastructure/pdf/renderer/MeasuredPdfKitBulletinRenderer';

function makeLine(avg: number, teacherComment?: string): BulletinSubjectSnapshotLine {
  return {
    subjectId: 'sub-1',
    subjectName: 'Technologie',
    coefficient: 3,
    groupKey: 'PROFESSIONNEL',
    groupLabel: 'Enseignement Professionnel',
    groupOrder: 2,
    subjectAverage: avg,
    weightedScore: avg * 3,
    subjectRank: 1,
    subjectTotalStudents: 34,
    classSubjectAverage: 12,
    minSubjectAverage: 6,
    maxSubjectAverage: 18,
    teacherComment,
  };
}

describe('Étape 6 bis — Point 3 : Famille B appréciation par matière calculée selon l’échelle + surcharge saisie', () => {
  it('calcule automatiquement le niveau de compétence selon l’échelle configurée quand aucun commentaire n’est saisi', () => {
    const garouaScale = { competence: { ongoingMin: 11, acquiredMin: 14, expertMin: 18 } };
    expect(formatSubjectCell(makeLine(9.90), 'teacherComment', false, 'TECHNICAL_GROUPED', garouaScale))
      .toBe('Compétence non acquise');
    expect(formatSubjectCell(makeLine(10.90), 'teacherComment', false, 'TECHNICAL_GROUPED', garouaScale))
      .toBe('Compétence non acquise');
    expect(formatSubjectCell(makeLine(11.00), 'teacherComment', false, 'TECHNICAL_GROUPED', garouaScale))
      .toBe("En cours d'acquisition");
    expect(formatSubjectCell(makeLine(13.00), 'teacherComment', false, 'TECHNICAL_GROUPED', garouaScale))
      .toBe("En cours d'acquisition");
    expect(formatSubjectCell(makeLine(14.00), 'teacherComment', false, 'TECHNICAL_GROUPED', garouaScale))
      .toBe('Compétence acquise');
    expect(formatSubjectCell(makeLine(18.50), 'teacherComment', false, 'TECHNICAL_GROUPED', garouaScale))
      .toBe('Compétence expert');

    // Surcharge par politique école différente (seuil acquise à 15)
    const strictScale = { competence: { ongoingMin: 12, acquiredMin: 15, expertMin: 18 } };
    expect(formatSubjectCell(makeLine(14.00), 'teacherComment', false, 'TECHNICAL_GROUPED', strictScale))
      .toBe("En cours d'acquisition");
  });

  it('permet de remplacer le niveau calculé par un commentaire saisi par l’enseignant', () => {
    const garouaScale = { competence: { ongoingMin: 11, acquiredMin: 14, expertMin: 18 } };
    expect(
      formatSubjectCell(makeLine(14.5, 'Très habile en atelier, à encourager'), 'teacherComment', false, 'TECHNICAL_GROUPED', garouaScale),
    ).toBe('Très habile en atelier, à encourager');

    // Chaîne vide/espaces → retombe sur le niveau de compétence calculé
    expect(
      formatSubjectCell(makeLine(14.5, '   '), 'teacherComment', false, 'TECHNICAL_GROUPED', garouaScale),
    ).toBe('Compétence acquise');
  });

  it('dans le spécimen PDF Famille B, les appréciations reflètent les niveaux de compétence variés et la surcharge saisie', async () => {
    const preview = buildFictitiousPreviewSnapshot(TECH_GROUPED_V1);
    const renderer = new MeasuredPdfKitBulletinRenderer();
    const texts: string[] = [];
    const origText = PDFDocument.prototype.text;
    PDFDocument.prototype.text = function patched(this: PDFKit.PDFDocument, t: string, ...rest: unknown[]) {
      if (typeof t === 'string') texts.push(t);
      return (origText as (...a: unknown[]) => PDFKit.PDFDocument).call(this, t, ...rest);
    } as typeof PDFDocument.prototype.text;
    try {
      await renderer.render(preview.snapshot, TECH_GROUPED_V1, {
        className: preview.className,
        periodName: preview.periodName,
        yearName: preview.yearName,
        mention: preview.mention,
        language: 'fr',
        school: { schoolName: 'Lycée Technique Spécimen', city: 'Garoua' },
      });
    } finally {
      PDFDocument.prototype.text = origText;
    }
    const joined = texts.join('\n');
    expect(joined).toContain('Très habile en atelier, à encourager');
    expect(joined).toMatch(/Compétence acquise|En cours d'acquisition|Compétence non acquise/);
    expect(joined).not.toContain('Travail sérieux');
  });
});

