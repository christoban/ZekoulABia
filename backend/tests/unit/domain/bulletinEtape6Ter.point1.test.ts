import { describe, it, expect } from 'bun:test';
import PDFDocument from 'pdfkit';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { listPublishedTemplateSpecs } from '@domain/templates/bulletinCatalog';
import { buildFictitiousPreviewSnapshot } from '@application/reportCard/bulletinAtelierPreview';
import {
  MeasuredPdfKitBulletinRenderer,
  generateBulletinQrPng,
} from '@infrastructure/pdf/renderer/MeasuredPdfKitBulletinRenderer';
import {
  QR_MIN_EDGE_MARGIN_PT,
  QR_MIN_SIZE_PT,
  QR_QUIET_ZONE_MODULES,
} from '@infrastructure/pdf/renderer/measuredVerificationFooter';

const MM_TO_PT = 72 / 25.4;
const MIN_QR_MM = 21;
const MIN_EDGE_MM = 8;

interface RectBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

function rectsOverlap(a: RectBox, b: RectBox): boolean {
  return a.x < b.x + b.w - 0.5 && a.x + a.w > b.x + 0.5 && a.y < b.y + b.h - 0.5 && a.y + a.h > b.y + 0.5;
}

function rectsAlmostEqual(a: RectBox, b: RectBox): boolean {
  return Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.w - b.w) < 1 && Math.abs(a.h - b.h) < 1;
}

function containsRect(outer: RectBox, inner: RectBox): boolean {
  return (
    outer.x <= inner.x + 0.5 &&
    outer.y <= inner.y + 0.5 &&
    outer.x + outer.w >= inner.x + inner.w - 0.5 &&
    outer.y + outer.h >= inner.y + inner.h - 0.5
  );
}

describe('Étape 6 ter — Point 1 : bande unique de vérification d’authenticité, QR >= 21 mm, zone blanche >= 4 modules, marge >= 8 mm, 0 chevauchement & décodage JS', () => {
  it('génère un PNG QR avec une zone blanche >= 4 modules sur les 4 côtés et décodable en JavaScript (jsQR)', async () => {
    const verifyUrl = 'https://verify.zekoulabia.cm/verify/0123456789abcdef0123456789abcdef0123456789abcdef';
    const pngBuf = await generateBulletinQrPng(verifyUrl);
    expect(pngBuf).not.toBeNull();

    const parsed = PNG.sync.read(pngBuf!);
    // Décodage 100% JavaScript
    const decoded = jsQR(new Uint8ClampedArray(parsed.data), parsed.width, parsed.height);
    expect(decoded).not.toBeNull();
    expect(decoded!.data).toBe(verifyUrl);

    // Vérification pixel par pixel de la zone blanche >= 4 modules (scale=6 => >= 24 px blancs de chaque côté)
    const isWhite = (x: number, y: number): boolean => {
      const idx = (parsed.width * y + x) << 2;
      return parsed.data[idx]! >= 250 && parsed.data[idx + 1]! >= 250 && parsed.data[idx + 2]! >= 250;
    };

    let minDarkX = parsed.width;
    let maxDarkX = -1;
    let minDarkY = parsed.height;
    let maxDarkY = -1;
    for (let y = 0; y < parsed.height; y++) {
      for (let x = 0; x < parsed.width; x++) {
        if (!isWhite(x, y)) {
          if (x < minDarkX) minDarkX = x;
          if (x > maxDarkX) maxDarkX = x;
          if (y < minDarkY) minDarkY = y;
          if (y > maxDarkY) maxDarkY = y;
        }
      }
    }
    const minQuietPx = QR_QUIET_ZONE_MODULES * 6; // scale: 6 dans generateBulletinQrPng
    expect(minDarkX).toBeGreaterThanOrEqual(minQuietPx);
    expect(parsed.width - 1 - maxDarkX).toBeGreaterThanOrEqual(minQuietPx);
    expect(minDarkY).toBeGreaterThanOrEqual(minQuietPx);
    expect(parsed.height - 1 - maxDarkY).toBeGreaterThanOrEqual(minQuietPx);
  });

  for (const spec of listPublishedTemplateSpecs()) {
    it(`${spec.id} : bande unique en pied, QR >= 21 mm, marge >= 8 mm des bords, 0 chevauchement avec tout cadre, décodable JS et 1 page`, async () => {
      const preview = buildFictitiousPreviewSnapshot(spec);
      const renderer = new MeasuredPdfKitBulletinRenderer();
      const lang: 'fr' | 'en' = spec.language === 'en' ? 'en' : 'fr';
      const verifyBaseUrl = 'https://verify.ecole-config.cm';
      const verifyUrl = `${verifyBaseUrl}/verify/fedcba9876543210fedcba9876543210fedcba9876543210`;
      const shortVerifyCode = 'ZK-6TER-0001';

      const rects: RectBox[] = [];
      const qrImages: Array<RectBox & { src: Buffer }> = [];
      const texts: string[] = [];
      let pageCount = 0;
      let pageW = 595.28;
      let pageH = 841.89;

      const origRect = PDFDocument.prototype.rect;
      const origImage = PDFDocument.prototype.image;
      const origText = PDFDocument.prototype.text;
      const origAddPage = PDFDocument.prototype.addPage;

      PDFDocument.prototype.rect = function patchedRect(
        this: PDFKit.PDFDocument,
        x: number,
        y: number,
        w: number,
        h: number,
      ) {
        rects.push({ x, y, w, h });
        return origRect.call(this, x, y, w, h);
      } as typeof PDFDocument.prototype.rect;

      PDFDocument.prototype.image = function patchedImage(
        this: PDFKit.PDFDocument,
        src: unknown,
        x?: number,
        y?: number,
        opts?: { fit?: [number, number] },
      ) {
        if (Buffer.isBuffer(src) && typeof x === 'number' && typeof y === 'number' && opts?.fit) {
          qrImages.push({ x, y, w: opts.fit[0], h: opts.fit[1], src });
        }
        return (origImage as (...a: unknown[]) => PDFKit.PDFDocument).call(this, src, x, y, opts);
      } as typeof PDFDocument.prototype.image;

      PDFDocument.prototype.text = function patchedText(this: PDFKit.PDFDocument, t: string, ...rest: unknown[]) {
        if (typeof t === 'string') texts.push(t);
        return (origText as (...a: unknown[]) => PDFKit.PDFDocument).call(this, t, ...rest);
      } as typeof PDFDocument.prototype.text;

      PDFDocument.prototype.addPage = function patchedAddPage(this: PDFKit.PDFDocument, ...rest: unknown[]) {
        pageCount++;
        const r = (origAddPage as (...a: unknown[]) => PDFKit.PDFDocument).apply(this, rest);
        pageW = this.page.width;
        pageH = this.page.height;
        return r;
      } as typeof PDFDocument.prototype.addPage;

      try {
        await renderer.render(preview.snapshot, spec, {
          className: preview.className,
          periodName: preview.periodName,
          yearName: preview.yearName,
          isAnnual: spec.familyKey === 'D',
          isPreview: true,
          mention: preview.mention,
          language: lang,
          verifyBaseUrl,
          verifyUrl,
          shortVerifyCode,
          school: { schoolName: 'Établissement Test QR', city: 'Garoua' },
        });
      } finally {
        PDFDocument.prototype.rect = origRect;
        PDFDocument.prototype.image = origImage;
        PDFDocument.prototype.text = origText;
        PDFDocument.prototype.addPage = origAddPage;
      }

      // 1. Tient sur 1 page et contient exactement 1 QR (aucun QR résiduel dans Proviseur / Classe)
      expect(pageCount).toBe(1);
      expect(qrImages).toHaveLength(1);
      const qr = qrImages[0]!;

      // 2. Taille >= 21 mm et marges >= 8 mm des bords droit et bas de la feuille
      expect(qr.w).toBeGreaterThanOrEqual(MIN_QR_MM * MM_TO_PT);
      expect(qr.h).toBeGreaterThanOrEqual(MIN_QR_MM * MM_TO_PT);
      expect(qr.w).toBe(QR_MIN_SIZE_PT);
      expect(pageW - (qr.x + qr.w)).toBeGreaterThanOrEqual(MIN_EDGE_MM * MM_TO_PT);
      expect(pageH - (qr.y + qr.h)).toBeGreaterThanOrEqual(MIN_EDGE_MM * MM_TO_PT);
      expect(pageW - (qr.x + qr.w)).toBeGreaterThanOrEqual(QR_MIN_EDGE_MARGIN_PT);
      expect(pageH - (qr.y + qr.h)).toBeGreaterThanOrEqual(QR_MIN_EDGE_MARGIN_PT);

      // 3. Zéro chevauchement du rectangle QR avec tout autre cadre (hors sa propre bande englobante et son fond blanc)
      const overlappingOtherRects = rects.filter((r) => {
        if (rectsAlmostEqual(r, qr)) return false; // fond blanc exact du QR
        if (containsRect(r, qr) && Math.abs(r.h - 70) < 2) return false; // bande de vérification englobante
        return rectsOverlap(r, qr);
      });
      expect(overlappingOtherRects).toEqual([]);

      // 4. Texte localisé dans la bande avec le code court et l'adresse publique issue de la config
      const joined = texts.join('\n');
      if (lang === 'en') {
        expect(joined).toContain('AUTHENTICITY VERIFICATION');
        expect(joined).toContain(`enter the code ${shortVerifyCode} at ${verifyBaseUrl}/verify`);
      } else {
        expect(joined).toContain("VÉRIFICATION D'AUTHENTICITÉ");
        expect(joined).toContain(`saisissez le code ${shortVerifyCode} sur ${verifyBaseUrl}/verify`);
      }

      // 5. Le buffer QR intégré dans le PDF est décodable par jsQR vers l'URL exacte
      const parsedQr = PNG.sync.read(qr.src);
      const decoded = jsQR(new Uint8ClampedArray(parsedQr.data), parsedQr.width, parsedQr.height);
      expect(decoded?.data).toBe(verifyUrl);
    });
  }
});

