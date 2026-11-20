import { describe, it, expect } from 'bun:test';
import PDFDocument from 'pdfkit';
import {
  ANNUAL_BILINGUAL_V1,
  BILINGUAL_APC_V1,
  listPublishedTemplateSpecs,
} from '@domain/templates/bulletinCatalog';
import { buildFictitiousPreviewSnapshot } from '@application/reportCard/bulletinAtelierPreview';
import { MeasuredPdfKitBulletinRenderer } from '@infrastructure/pdf/renderer/MeasuredPdfKitBulletinRenderer';
import { formatLocalizedNumber } from '@infrastructure/pdf/renderer/measuredFormatHelpers';

interface DrawnText {
  text: string;
  x?: number;
  y?: number;
}

async function renderAndMeasure(spec: typeof BILINGUAL_APC_V1) {
  const preview = buildFictitiousPreviewSnapshot(spec);
  const renderer = new MeasuredPdfKitBulletinRenderer();
  const drawn: DrawnText[] = [];
  const fontSizes: number[] = [];
  let pageCount = 0;

  const origText = PDFDocument.prototype.text;
  const origFontSize = PDFDocument.prototype.fontSize;
  const origAddPage = PDFDocument.prototype.addPage;

  PDFDocument.prototype.text = function patchedText(
    this: PDFKit.PDFDocument,
    t: string,
    xOrOpts?: number | PDFKit.Mixins.TextOptions,
    y?: number,
    ...rest: unknown[]
  ) {
    if (typeof t === 'string') {
      drawn.push({
        text: t,
        x: typeof xOrOpts === 'number' ? xOrOpts : undefined,
        y: typeof y === 'number' ? y : undefined,
      });
    }
    return (origText as (...a: unknown[]) => PDFKit.PDFDocument).call(this, t, xOrOpts, y, ...rest);
  } as typeof PDFDocument.prototype.text;

  PDFDocument.prototype.fontSize = function patchedFontSize(this: PDFKit.PDFDocument, size: number) {
    if (typeof size === 'number') fontSizes.push(size);
    return origFontSize.call(this, size);
  } as typeof PDFDocument.prototype.fontSize;

  PDFDocument.prototype.addPage = function patchedAddPage(this: PDFKit.PDFDocument, ...rest: unknown[]) {
    pageCount++;
    return (origAddPage as (...a: unknown[]) => PDFKit.PDFDocument).apply(this, rest);
  } as typeof PDFDocument.prototype.addPage;

  try {
    await renderer.render(preview.snapshot, spec, {
      className: preview.className,
      periodName: preview.periodName,
      yearName: preview.yearName,
      isAnnual: spec.familyKey === 'D',
      mention: preview.mention,
      language: spec.language === 'en' ? 'en' : 'fr',
      verifyUrl: 'https://verify.zekoulabia.cm/verify/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1234',
      shortVerifyCode: 'ZK-PT5-TEST',
      school: { schoolName: 'Établissement Spécimen', city: 'Garoua' },
    });
  } finally {
    PDFDocument.prototype.text = origText;
    PDFDocument.prototype.fontSize = origFontSize;
    PDFDocument.prototype.addPage = origAddPage;
  }

  return {
    snapshot: preview.snapshot,
    drawn,
    minFontSize: Math.min(...fontSizes),
    pageCount,
  };
}

describe('Étape 6 bis — Point 5 : alignement sous-totaux C & D, tableau récapitulatif annuel D et police >= 7 pt', () => {
  it('toutes les familles (A à F) respectent strictement une taille de police minimale >= 7 pt et tiennent sur 1 page', async () => {
    for (const spec of listPublishedTemplateSpecs()) {
      const m = await renderAndMeasure(spec);
      expect(m.minFontSize).toBeGreaterThanOrEqual(7);
      expect(m.pageCount).toBe(1);
    }
  });

  it('Famille C : les moyennes et totaux de groupe sont alignés exactement sous leurs colonnes du tableau', async () => {
    const m = await renderAndMeasure(BILINGUAL_APC_V1);
    const hdrAvg = m.drawn.find((d) => d.text === 'Trim /20');
    const hdrEv3 = m.drawn.find((d) => d.text === 'Éval 3');
    const hdrEv4 = m.drawn.find((d) => d.text === 'Éval 4');
    const hdrCoef = m.drawn.find((d) => d.text === 'COEF');
    const hdrTotal = m.drawn.find((d) => d.text === 'Total (N×C)');
    expect(hdrAvg?.x).toBeDefined();
    expect(hdrEv3?.x).toBeDefined();
    expect(hdrEv4?.x).toBeDefined();
    expect(hdrCoef?.x).toBeDefined();
    expect(hdrTotal?.x).toBeDefined();

    const g1 = m.snapshot.groupSummaries[0]!;
    const g1Label = m.drawn.find((d) => d.text === `Moy. ${g1.groupLabel}`);
    expect(g1Label?.y).toBeDefined();
    const rowCells = m.drawn.filter((d) => d.y !== undefined && Math.abs(d.y - g1Label!.y!) < 1);
    expect(rowCells.some((c) => c.text === formatLocalizedNumber(g1.groupAverage, false, 2) && Math.abs((c.x ?? 0) - hdrAvg!.x!) <= 1)).toBe(true);
    expect(rowCells.some((c) => c.text === String(g1.totalCoefficient) && Math.abs((c.x ?? 0) - hdrCoef!.x!) <= 1)).toBe(true);
    expect(rowCells.some((c) => c.text === formatLocalizedNumber(g1.totalWeightedScore, false, 2) && Math.abs((c.x ?? 0) - hdrTotal!.x!) <= 1)).toBe(true);
  });

  it('Famille D : sous-totaux de groupe alignés sous les colonnes et récapitulatif annuel en tableau (lignes Moyenne et Rang)', async () => {
    const m = await renderAndMeasure(ANNUAL_BILINGUAL_V1);
    const hdrT1 = m.drawn.find((d) => d.text === 'Tri 1');
    const hdrCoef = m.drawn.find((d) => d.text === 'COEF');
    const hdrAn = m.drawn.find((d) => d.text === 'Moy.AN');
    expect(hdrT1?.x).toBeDefined();
    expect(hdrCoef?.x).toBeDefined();
    expect(hdrAn?.x).toBeDefined();

    const g1 = m.snapshot.groupSummaries[0]!;
    const g1Label = m.drawn.find((d) => d.text === `Moy. ${g1.groupLabel}`);
    expect(g1Label?.y).toBeDefined();
    const g1Cells = m.drawn.filter((d) => d.y !== undefined && Math.abs(d.y - g1Label!.y!) < 1);
    expect(g1Cells.some((c) => c.text === String(g1.totalCoefficient) && Math.abs((c.x ?? 0) - hdrCoef!.x!) <= 1)).toBe(true);
    expect(g1Cells.some((c) => c.text === formatLocalizedNumber(g1.groupAverage, false, 2) && Math.abs((c.x ?? 0) - hdrAn!.x!) <= 1)).toBe(true);

    // Mini-tableau récapitulatif annuel : en-tête Période / Tri 1..Annuel + lignes Moyenne et Rang alignées en colonnes
    const recapHdrRow = m.drawn.find((d) => d.text === 'Période');
    const meanRow = m.drawn.find((d) => d.text === 'Moyenne');
    const rankRow = m.drawn.find((d) => d.text === 'Rang');
    expect(recapHdrRow?.y).toBeDefined();
    expect(meanRow?.y).toBeDefined();
    expect(rankRow?.y).toBeDefined();
    expect(meanRow!.y!).toBeGreaterThan(recapHdrRow!.y!);
    expect(rankRow!.y!).toBeGreaterThan(meanRow!.y!);

    const hdrRowCells = m.drawn.filter((d) => d.y !== undefined && Math.abs(d.y - recapHdrRow!.y!) < 1);
    const hdrCols = hdrRowCells.map((d) => d.text);
    for (const col of ['Tri 1', 'Éval 1', 'Éval 2', 'Tri 2', 'Éval 3', 'Éval 4', 'Tri 3', 'Éval 5', 'Éval 6', 'Annuel']) {
      expect(hdrCols).toContain(col);
    }
    const hdrAnnuel = hdrRowCells.find((d) => d.text === 'Annuel')!;
    expect(hdrAnnuel?.x).toBeDefined();
    const meanAnnuel = m.drawn.find(
      (d) => d.y !== undefined && Math.abs(d.y - meanRow!.y!) < 1 && Math.abs((d.x ?? 0) - hdrAnnuel.x!) <= 1,
    );
    const rankAnnuel = m.drawn.find(
      (d) => d.y !== undefined && Math.abs(d.y - rankRow!.y!) < 1 && Math.abs((d.x ?? 0) - hdrAnnuel.x!) <= 1,
    );
    expect(meanAnnuel?.text).toBe(formatLocalizedNumber(m.snapshot.generalAverage, false, 2));
    expect(rankAnnuel?.text).toBe(`${m.snapshot.rank}/${m.snapshot.totalStudents}`);
    expect(m.minFontSize).toBeGreaterThanOrEqual(7);
  });
});

