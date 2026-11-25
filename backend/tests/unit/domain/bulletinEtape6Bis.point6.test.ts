import { describe, it, expect } from 'bun:test';
import PDFDocument from 'pdfkit';
import { BILINGUAL_APC_V1 } from '@domain/templates/bulletinCatalog';
import { buildFictitiousPreviewSnapshot } from '@application/reportCard/bulletinAtelierPreview';
import { MeasuredPdfKitBulletinRenderer } from '@infrastructure/pdf/renderer/MeasuredPdfKitBulletinRenderer';

interface DrawnEntry {
  text: string;
  x?: number;
  y?: number;
}

describe('Étape 6 bis — Point 6 : Famille C cadre parents vide & observation chez le chef d’établissement', () => {
  it('laisse le cadre "OBSERVATION & VISA DES PARENTS" totalement vide et place le texte d’observation dans "OBSERVATIONS DU CHEF D\'ÉTABLISSEMENT"', async () => {
    const preview = buildFictitiousPreviewSnapshot(BILINGUAL_APC_V1);
    const customObs = 'Élève sérieux, efforts à maintenir au troisième trimestre.';
    const snapshot = {
      ...preview.snapshot,
      councilDecision: {
        ...preview.snapshot.councilDecision!,
        observations: customObs,
      },
    };

    const drawn: DrawnEntry[] = [];
    const origText = PDFDocument.prototype.text;
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

    try {
      const renderer = new MeasuredPdfKitBulletinRenderer();
      await renderer.render(snapshot, BILINGUAL_APC_V1, {
        className: preview.className,
        periodName: preview.periodName,
        yearName: preview.yearName,
        mention: preview.mention,
        language: 'fr',
        verifyUrl: 'https://verify.zekoulabia.cm/verify/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1234',
        shortVerifyCode: 'ZK-PT6-TEST',
        school: { schoolName: 'Lycée Bilingue Test', city: 'Garoua' },
      });
    } finally {
      PDFDocument.prototype.text = origText;
    }

    const parentHdr = drawn.find((d) => d.text === 'OBSERVATION & VISA DES PARENTS');
    const principalHdr = drawn.find((d) => d.text === "OBSERVATIONS DU CHEF D'ÉTABLISSEMENT");
    expect(parentHdr?.x).toBeDefined();
    expect(parentHdr?.y).toBeDefined();
    expect(principalHdr?.x).toBeDefined();

    // Aucun texte ne doit être dessiné dans la zone du cadre parents (sous son titre, entre parentHdr.x et principalHdr.x - 4)
    const textsInsideParentBox = drawn.filter(
      (d) =>
        d.x !== undefined &&
        d.y !== undefined &&
        d.y > parentHdr!.y! + 2 &&
        d.x >= parentHdr!.x! - 4 &&
        d.x < principalHdr!.x! - 4 &&
        d.text.trim().length > 0,
    );
    expect(textsInsideParentBox).toEqual([]);

    // Le texte d'observation doit apparaître dans la zone du chef d'établissement (x >= principalHdr.x - 4)
    const obsDrawn = drawn.find((d) => d.text.includes(customObs));
    expect(obsDrawn).toBeDefined();
    expect(obsDrawn!.x!).toBeGreaterThanOrEqual(principalHdr!.x! - 4);
  });
});

