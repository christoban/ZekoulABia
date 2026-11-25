import { describe, it, expect } from 'bun:test';
import PDFDocument from 'pdfkit';
import { TECH_GROUPED_V1 } from '@domain/templates/bulletinCatalog';
import { buildFictitiousPreviewSnapshot } from '@application/reportCard/bulletinAtelierPreview';
import { MeasuredPdfKitBulletinRenderer } from '@infrastructure/pdf/renderer/MeasuredPdfKitBulletinRenderer';

async function renderFamilyBTexts(classMasterComment?: string | null): Promise<string[]> {
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
      classMasterComment,
      language: 'fr',
      school: { schoolName: 'Lycée Technique Spécimen', city: 'Garoua' },
    });
  } finally {
    PDFDocument.prototype.text = origText;
  }
  return texts;
}

describe('Étape 6 ter — Point 4 : cadre Visa du professeur principal (Famille B) vide sans tiret', () => {
  it('laisse la zone sous "VISA DU PROFESSEUR PRINCIPAL :" vide sans tiret quand aucun visa n’est saisi', async () => {
    for (const emptyVal of [undefined, null, '', '   ']) {
      const texts = await renderFamilyBTexts(emptyVal);
      const conductBlock = texts.find((t) => t.includes('VISA DU PROFESSEUR PRINCIPAL :'));
      expect(conductBlock).toBeDefined();
      expect(conductBlock!.endsWith('VISA DU PROFESSEUR PRINCIPAL :')).toBe(true);
      expect(conductBlock!).not.toContain('VISA DU PROFESSEUR PRINCIPAL :\n—');
    }
  });

  it('affiche le commentaire du professeur principal lorsqu’il est saisi', async () => {
    const texts = await renderFamilyBTexts('Travail sérieux, maintenir cet effort.');
    const conductBlock = texts.find((t) => t.includes('VISA DU PROFESSEUR PRINCIPAL :'));
    expect(conductBlock).toContain('VISA DU PROFESSEUR PRINCIPAL :\nTravail sérieux, maintenir cet effort.');
  });
});

