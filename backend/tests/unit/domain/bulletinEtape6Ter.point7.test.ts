import { describe, it, expect } from 'bun:test';
import PDFDocument from 'pdfkit';
import {
  GENERAL_GROUPED_V1,
  createNewTemplateSpecVersion,
} from '@domain/templates/bulletinCatalog';
import { buildFictitiousPreviewSnapshot } from '@application/reportCard/bulletinAtelierPreview';
import { MeasuredPdfKitBulletinRenderer } from '@infrastructure/pdf/renderer/MeasuredPdfKitBulletinRenderer';

async function renderAndCaptureFills(spec: typeof GENERAL_GROUPED_V1) {
  const preview = buildFictitiousPreviewSnapshot(spec);
  const renderer = new MeasuredPdfKitBulletinRenderer();
  const fillColors: string[] = [];
  let pageCount = 0;

  const origFillAndStroke = PDFDocument.prototype.fillAndStroke;
  const origAddPage = PDFDocument.prototype.addPage;

  PDFDocument.prototype.fillAndStroke = function patchedFillAndStroke(
    this: PDFKit.PDFDocument,
    fillColor?: unknown,
    strokeColor?: unknown,
    ...rest: unknown[]
  ) {
    if (typeof fillColor === 'string') fillColors.push(fillColor.toLowerCase());
    return (origFillAndStroke as (...a: unknown[]) => PDFKit.PDFDocument).call(this, fillColor, strokeColor, ...rest);
  } as typeof PDFDocument.prototype.fillAndStroke;

  PDFDocument.prototype.addPage = function patchedAddPage(this: PDFKit.PDFDocument, ...rest: unknown[]) {
    pageCount++;
    return (origAddPage as (...a: unknown[]) => PDFKit.PDFDocument).apply(this, rest);
  } as typeof PDFDocument.prototype.addPage;

  try {
    const pdf = await renderer.render(preview.snapshot, spec, {
      className: preview.className,
      periodName: preview.periodName,
      yearName: preview.yearName,
      mention: preview.mention,
      language: 'fr',
      isPreview: true,
      verifyUrl: 'https://verify.zekoulabia.cm/verify/0123456789abcdef0123456789abcdef0123456789abcdef',
      shortVerifyCode: 'ZK-ECO-0001',
      school: {
        schoolName: 'Collège Modèle Général',
        city: 'Yaoundé',
        accentColor: '#1d4ed8',
      },
    });
    expect(pdf.subarray(0, 5).toString('utf8')).toBe('%PDF-');
  } finally {
    PDFDocument.prototype.fillAndStroke = origFillAndStroke;
    PDFDocument.prototype.addPage = origAddPage;
  }
  return { fillColors, pageCount };
}

describe('Étape 6 ter — Point 7 : mode économique (économie d’encre)', () => {
  it('en mode par défaut (inkSaverMode absent/false), conserve les aplats colorés et sombres', async () => {
    const out = await renderAndCaptureFills(GENERAL_GROUPED_V1);
    expect(out.pageCount).toBe(1);
    expect(out.fillColors).toContain('#1d4ed8');
    expect(out.fillColors).toContain('#1e293b');
  });

  it('en mode économique (inkSaverMode: true), remplace tous les aplats sombres/colorés par un gris très clair avec contour', async () => {
    const ecoSpec = createNewTemplateSpecVersion(GENERAL_GROUPED_V1, {
      name: 'Famille A — Mode Économique',
      inkSaverMode: true,
    });
    expect(ecoSpec.inkSaverMode).toBe(true);

    const out = await renderAndCaptureFills(ecoSpec);
    expect(out.pageCount).toBe(1);
    expect(out.fillColors).not.toContain('#1d4ed8');
    expect(out.fillColors).not.toContain('#1e293b');
    expect(out.fillColors).not.toContain('#cbd5e1');
    expect(out.fillColors).toContain('#f1f5f9');
  });
});

