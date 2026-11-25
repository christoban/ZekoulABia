/**
 * INFRASTRUCTURE LAYER — Sceau QR minimaliste en bas à droite (Option B, zéro texte)
 *
 * Emplacement unique et épuré pour toutes les familles (A..F) :
 * - QR code seul en bas à droite (>= 21 mm = 62 pt, zone blanche >= 4 modules, marge >= 8 mm = 23 pt des bords) ;
 * - Aucun bandeau pleine largeur, aucun cadre gris et aucun texte explicatif superflu.
 */
import type { BulletinRenderOptions } from '@domain/ports/services/BulletinRendererPort';
import type { VerifyQrBlockSpec } from '@domain/types/bulletinTemplateSpec';
import type { FontSet, MeasuredPdfDoc } from './measuredHeaderHelpers';

/** 21,87 mm (>= 21 mm exigés) */
export const QR_MIN_SIZE_PT = 62;
/** 8,11 mm (>= 8 mm exigés du bord de la feuille) */
export const QR_MIN_EDGE_MARGIN_PT = 23;
/** Zone blanche ISO/IEC 18004 : au moins 4 modules tout autour du symbole QR */
export const QR_QUIET_ZONE_MODULES = 4;
/** Hauteur réservée au sceau QR seul */
export const VERIFICATION_STRIP_HEIGHT_PT = QR_MIN_SIZE_PT;

export interface VerificationStripGeometry {
  stripRect: { x: number; y: number; w: number; h: number };
  qrRect: { x: number; y: number; w: number; h: number };
}

/**
 * Extrait l'adresse publique de vérification (ex. https://verify.zekoulabia.cm/verify)
 * depuis la configuration (`verifyBaseUrl`) ou l'URL signée (`verifyUrl`), sans aucune valeur en dur.
 */
export function resolvePublicVerifyDisplayAddress(options: Pick<BulletinRenderOptions, 'verifyBaseUrl' | 'verifyUrl'>): string {
  const rawBase = options.verifyBaseUrl?.trim();
  if (rawBase && rawBase.length > 0) {
    const clean = rawBase.replace(/\/+$/, '');
    return clean.endsWith('/verify') ? clean : `${clean}/verify`;
  }
  const rawUrl = options.verifyUrl?.trim();
  if (rawUrl && rawUrl.length > 0) {
    try {
      const parsed = new URL(rawUrl);
      return `${parsed.origin}/verify`;
    } catch {
      const idx = rawUrl.indexOf('/verify');
      return idx > 0 ? rawUrl.slice(0, idx + '/verify'.length) : rawUrl;
    }
  }
  return '/verify';
}

export function drawVerificationFooterStrip(
  doc: MeasuredPdfDoc,
  _fonts: FontSet,
  qrSpec: VerifyQrBlockSpec | undefined,
  _options: BulletinRenderOptions,
  qrBuffer: Buffer | null,
): VerificationStripGeometry | null {
  if (!qrSpec || !qrBuffer) return null;

  const qrSize = QR_MIN_SIZE_PT;
  const rightLimit = Math.min(
    doc.page.width - doc.page.margins.right,
    doc.page.width - QR_MIN_EDGE_MARGIN_PT,
  );
  const maxBottomY = doc.page.height - QR_MIN_EDGE_MARGIN_PT;

  let qrY = doc.y + 6;
  if (qrY + qrSize > maxBottomY) {
    doc.addPage();
    qrY = Math.max(doc.page.margins.top, QR_MIN_EDGE_MARGIN_PT);
  }

  const qrX = rightLimit - qrSize;
  // Fond blanc pur exact sous le QR (zéro bandeau, zéro cadre, zéro texte)
  doc.rect(qrX, qrY, qrSize, qrSize).fill('#ffffff');
  doc.image(qrBuffer, qrX, qrY, { fit: [qrSize, qrSize] });

  doc.y = qrY + qrSize + 2;
  const rect = { x: qrX, y: qrY, w: qrSize, h: qrSize };
  return {
    stripRect: rect,
    qrRect: rect,
  };
}

