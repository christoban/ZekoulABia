import { describe, it, expect } from 'bun:test';
import PDFDocument from 'pdfkit';
import {
  PRIMARY_POINTS_RATIO_EN_V1,
  PRIMARY_POINTS_RATIO_FR_LABELS_V1,
} from '@domain/templates/bulletinCatalog';
import { buildFictitiousPreviewSnapshot } from '@application/reportCard/bulletinAtelierPreview';
import { MeasuredPdfKitBulletinRenderer } from '@infrastructure/pdf/renderer/MeasuredPdfKitBulletinRenderer';
import { formatSubjectCell } from '@infrastructure/pdf/renderer/measuredSubjectTableHelpers';
import type { BulletinSubjectSnapshotLine } from '@domain/types/bulletinSnapshot';

async function renderSpecTexts(spec: typeof PRIMARY_POINTS_RATIO_EN_V1): Promise<string> {
  const preview = buildFictitiousPreviewSnapshot(spec);
  const renderer = new MeasuredPdfKitBulletinRenderer();
  const texts: string[] = [];
  const origText = PDFDocument.prototype.text;
  PDFDocument.prototype.text = function patched(this: PDFKit.PDFDocument, t: string, ...rest: unknown[]) {
    if (typeof t === 'string') texts.push(t);
    return (origText as (...a: unknown[]) => PDFKit.PDFDocument).call(this, t, ...rest);
  } as typeof PDFDocument.prototype.text;
  try {
    await renderer.render(preview.snapshot, spec, {
      className: preview.className,
      periodName: preview.periodName,
      yearName: preview.yearName,
      mention: preview.mention,
      language: spec.language === 'en' ? 'en' : 'fr',
      isPreview: true,
      school: { schoolName: 'GSB Primaire Spécimen', city: 'Yaoundé' },
    });
  } finally {
    PDFDocument.prototype.text = origText;
  }
  return texts.join('\n');
}

describe('Étape 6 ter — Point 5 : Famille F libellés FR traduit aussi les valeurs affichées (Unité X, CM2)', () => {
  it('Famille F libellés FR affiche "Unité 1..4" et "Classe : CM2 (Spécimen)" sans aucun "Unit " ni "Class V"', async () => {
    const frText = await renderSpecTexts(PRIMARY_POINTS_RATIO_FR_LABELS_V1);
    expect(frText).toContain('Classe : CM2 (Spécimen)');
    expect(frText).toContain('Unité 1');
    expect(frText).toContain('Unité 2');
    expect(frText).toContain('Unité 3');
    expect(frText).toContain('Unité 4');
    expect(frText).not.toContain('Unit 1');
    expect(frText).not.toContain('Unit 2');
    expect(frText).not.toContain('Class V');
  });

  it('Famille F EN conserve "Class V (Sample)" et "Unit 1..4", et formatSubjectCell localise learningUnit', async () => {
    const enText = await renderSpecTexts(PRIMARY_POINTS_RATIO_EN_V1);
    expect(enText).toContain('Class : Class V (Sample)');
    expect(enText).toContain('Unit 2');

    const line = { learningUnit: 'Unit 2' } as BulletinSubjectSnapshotLine;
    expect(formatSubjectCell(line, 'learningUnit', false)).toBe('Unité 2');
    expect(formatSubjectCell({ learningUnit: 'Unité 3' } as BulletinSubjectSnapshotLine, 'learningUnit', true)).toBe('Unit 3');
  });
});

