import { describe, it, expect } from 'bun:test';
import PDFDocument from 'pdfkit';
import {
  GENERAL_GROUPED_V1,
  PRIMARY_POINTS_RATIO_EN_V1,
  PRIMARY_POINTS_RATIO_FR_LABELS_V1,
} from '@domain/templates/bulletinCatalog';
import { buildFictitiousPreviewSnapshot } from '@application/reportCard/bulletinAtelierPreview';
import { MeasuredPdfKitBulletinRenderer } from '@infrastructure/pdf/renderer/MeasuredPdfKitBulletinRenderer';
import { HEADER_EMBLEM_GAP, resolveHeaderEmblemBox } from '@infrastructure/pdf/renderer/measuredHeaderHelpers';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FAAhKDveksOjmAAAAAElFTkSuQmCC',
  'base64',
);

interface CapturedDraw {
  texts: Array<{ text: string; y?: number }>;
  images: Array<{ y: number; fitH: number }>;
}

async function renderWithLogoAndCapture(params: {
  spec: typeof GENERAL_GROUPED_V1;
  language: 'fr' | 'en';
  schoolName: string;
  withDelegations: boolean;
  withCoat?: boolean;
  issuedAt?: Date;
}): Promise<CapturedDraw> {
  const preview = buildFictitiousPreviewSnapshot(params.spec);
  const renderer = new MeasuredPdfKitBulletinRenderer();
  const texts: Array<{ text: string; y?: number }> = [];
  const images: Array<{ y: number; fitH: number }> = [];

  const origText = PDFDocument.prototype.text;
  const origImage = PDFDocument.prototype.image;

  PDFDocument.prototype.text = function patchedText(
    this: PDFKit.PDFDocument,
    t: string,
    xOrOpts?: number | PDFKit.Mixins.TextOptions,
    y?: number,
    ...rest: unknown[]
  ) {
    if (typeof t === 'string') {
      texts.push({ text: t, y: typeof y === 'number' ? y : undefined });
    }
    return (origText as (...a: unknown[]) => PDFKit.PDFDocument).call(this, t, xOrOpts, y, ...rest);
  } as typeof PDFDocument.prototype.text;

  PDFDocument.prototype.image = function patchedImage(
    this: PDFKit.PDFDocument,
    src: unknown,
    x?: number,
    y?: number,
    opts?: { fit?: [number, number] },
  ) {
    if (typeof y === 'number' && opts?.fit) {
      images.push({ y, fitH: opts.fit[1] });
    }
    return (origImage as (...a: unknown[]) => PDFKit.PDFDocument).call(this, src, x, y, opts);
  } as typeof PDFDocument.prototype.image;

  try {
    await renderer.render(preview.snapshot, params.spec, {
      className: preview.className,
      periodName: preview.periodName,
      yearName: preview.yearName,
      mention: preview.mention,
      language: params.language,
      isPreview: true,
      issuedAt: params.issuedAt ?? new Date('2026-11-20T10:00:00Z'),
      school: {
        schoolName: params.schoolName,
        city: 'Yaoundé',
        phone: '+237 699 00 11 22',
        regionalDelegation: params.withDelegations ? 'Délégation Régionale du Centre' : null,
        departmentalDelegation: params.withDelegations ? 'Inspection d’Arrondissement' : null,
        logoBuffer: TINY_PNG,
        coatOfArmsEnabled: Boolean(params.withCoat),
        coatOfArmsBuffer: params.withCoat ? TINY_PNG : null,
      },
    });
  } finally {
    PDFDocument.prototype.text = origText;
    PDFDocument.prototype.image = origImage;
  }

  return { texts, images };
}

describe('Étape 6 bis — Point 8 : Famille F en-tête MINEDUB, renommage variante libellés FR, pied "Imprimé le" & anti-chevauchement logo', () => {
  it('Famille F affiche l’en-tête officiel MINEDUB configurable (ministère, nom, téléphone, logo) et "Printed on / Imprimé le <date>" en pied', async () => {
    const outEn = await renderWithLogoAndCapture({
      spec: PRIMARY_POINTS_RATIO_EN_V1,
      language: 'en',
      schoolName: 'GSB Le Québécois Primaire',
      withDelegations: true,
      issuedAt: new Date('2026-11-20T10:00:00Z'),
    });
    const joinedEn = outEn.texts.map((t) => t.text).join('\n');
    expect(joinedEn).toContain("MINISTÈRE DE L'ÉDUCATION DE BASE");
    expect(joinedEn).toContain('MINISTRY OF BASIC EDUCATION');
    expect(joinedEn).not.toContain('MINISTÈRE DES ENSEIGNEMENTS SECONDAIRES');
    expect(joinedEn).toContain('GSB LE QUÉBÉCOIS PRIMAIRE');
    expect(joinedEn).toContain('Tel : +237 699 00 11 22');
    expect(joinedEn).toContain('Printed on 20/11/2026');

    const outFr = await renderWithLogoAndCapture({
      spec: PRIMARY_POINTS_RATIO_FR_LABELS_V1,
      language: 'fr',
      schoolName: 'GSB Primaire Spécimen',
      withDelegations: false,
      issuedAt: new Date('2026-11-20T10:00:00Z'),
    });
    const joinedFr = outFr.texts.map((t) => t.text).join('\n');
    expect(joinedFr).toContain("MINISTÈRE DE L'ÉDUCATION DE BASE");
    expect(joinedFr).toContain('Tél : +237 699 00 11 22');
    expect(joinedFr).toContain('Imprimé le 20/11/2026');
    expect(joinedFr).not.toContain('À VALIDER SUR UN BULLETIN RÉEL');
  });

  it('nomme la variante libellés FR avec précision (modèle ratio de points validé sur barèmes CM2 MINEDUB, distinct du livret annuel)', () => {
    expect(PRIMARY_POINTS_RATIO_FR_LABELS_V1.id).toBe('PRIMARY_POINTS_RATIO_FR_LABELS_V1');
    expect(PRIMARY_POINTS_RATIO_FR_LABELS_V1.validationStatus).toBe('VALIDATED');
    expect(PRIMARY_POINTS_RATIO_FR_LABELS_V1.name.toLowerCase()).toContain('anglophone');
    expect(PRIMARY_POINTS_RATIO_FR_LABELS_V1.name.toLowerCase()).toContain('libellés français');
    expect(PRIMARY_POINTS_RATIO_FR_LABELS_V1.name.toLowerCase()).not.toContain('francophone');
  });

  it('le logo d’en-tête ne chevauche JAMAIS le nom du lycée ou les délégations (secondaire MINESEC et primaire MINEDUB)', async () => {
    const scenarios = [
      { spec: GENERAL_GROUPED_V1, lang: 'fr' as const, withDelegations: false, withCoat: false },
      { spec: GENERAL_GROUPED_V1, lang: 'fr' as const, withDelegations: true, withCoat: true },
      { spec: PRIMARY_POINTS_RATIO_EN_V1, lang: 'en' as const, withDelegations: false, withCoat: false },
    ];
    for (const sc of scenarios) {
      const schoolName = 'Lycée Bilingue de Test Anti-Chevauchement';
      const out = await renderWithLogoAndCapture({
        spec: sc.spec,
        language: sc.lang,
        schoolName,
        withDelegations: sc.withDelegations,
        withCoat: sc.withCoat,
      });
      const logoImg = out.images[0];
      const schoolTitle = out.texts.find((t) => t.text === schoolName.toUpperCase());
      expect(logoImg).toBeDefined();
      expect(schoolTitle?.y).toBeDefined();
      const box = resolveHeaderEmblemBox(true, sc.withCoat);
      const logoBottom = logoImg!.y + box.height;
      // Le nom de l'établissement doit impérativement commencer sous le bas du logo + marge de sécurité
      expect(schoolTitle!.y!).toBeGreaterThanOrEqual(logoBottom + HEADER_EMBLEM_GAP);
    }
  });
});

