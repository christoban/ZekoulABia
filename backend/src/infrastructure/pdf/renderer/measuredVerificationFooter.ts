/**
 * INFRASTRUCTURE LAYER — Bande unifiée « Vérification d'authenticité » en pied de page
 *
 * Emplacement unique pour toutes les familles (A..F) :
 * - QR code à droite (>= 21 mm = 62 pt, zone blanche >= 4 modules, marge >= 8 mm = 23 pt des bords) ;
 * - Instructions de vérification localisées à gauche avec le code court et l'URL publique issue de la config.
 */
import type { BulletinRenderOptions } from '@domain/ports/services/BulletinRendererPort';
import type { VerifyQrBlockSpec } from '@domain/types/bulletinTemplateSpec';
import { deriveShortVerifyCode } from '@domain/policies/BulletinVerifyCrypto';
import type { FontSet, MeasuredPdfDoc } from './measuredHeaderHelpers';

/** 21,87 mm (>= 21 mm exigés) */
export const QR_MIN_SIZE_PT = 62;
/** 8,11 mm (>= 8 mm exigés du bord de la feuille) */
export const QR_MIN_EDGE_MARGIN_PT = 23;
/** Zone blanche ISO/IEC 18004 : au moins 4 modules tout autour du symbole QR */
export const QR_QUIET_ZONE_MODULES = 4;
/** Hauteur totale de la bande de vérification (QR 62 pt + 4 pt haut/bas) */
export const VERIFICATION_STRIP_HEIGHT_PT = 70;

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
  fonts: FontSet,
  qrSpec: VerifyQrBlockSpec | undefined,
  options: BulletinRenderOptions,
  qrBuffer: Buffer | null,
): VerificationStripGeometry | null {
  if (!qrSpec || !qrBuffer) return null;

  const isEn = options.language === 'en';
  const left = Math.max(doc.page.margins.left, QR_MIN_EDGE_MARGIN_PT);
  const rightLimit = Math.min(
    doc.page.width - doc.page.margins.right,
    doc.page.width - QR_MIN_EDGE_MARGIN_PT,
  );
  const stripW = rightLimit - left;
  const stripH = VERIFICATION_STRIP_HEIGHT_PT;
  const maxBottomY = doc.page.height - QR_MIN_EDGE_MARGIN_PT;

  let stripY = doc.y + 3;
  if (stripY + stripH > maxBottomY) {
    doc.addPage();
    stripY = Math.max(doc.page.margins.top, QR_MIN_EDGE_MARGIN_PT);
  }

  // Boîte unifiée de vérification d'authenticité
  doc.rect(left, stripY, stripW, stripH).fillAndStroke('#f8fafc', '#334155');

  // QR code à droite : >= 21 mm (62 pt), fond blanc pur, marge >= 8 mm des bords droit et bas
  const qrSize = QR_MIN_SIZE_PT;
  const qrX = rightLimit - qrSize - 4;
  const qrY = stripY + Math.floor((stripH - qrSize) / 2);
  doc.rect(qrX, qrY, qrSize, qrSize).fill('#ffffff');
  doc.image(qrBuffer, qrX, qrY, { fit: [qrSize, qrSize] });

  const displayCode =
    options.shortVerifyCode ||
    (options.verifyToken ? deriveShortVerifyCode(options.verifyToken) : '—');
  const publicAddress = resolvePublicVerifyDisplayAddress(options);

  const textX = left + 8;
  const textW = Math.max(120, qrX - textX - 10);
  const title = isEn ? 'AUTHENTICITY VERIFICATION' : "VÉRIFICATION D'AUTHENTICITÉ";
  const body = isEn
    ? `To verify the authenticity of this report card, scan the QR code or enter the code ${displayCode} at ${publicAddress}.`
    : `Pour vérifier l'authenticité de ce bulletin, scannez le QR code ou saisissez le code ${displayCode} sur ${publicAddress}.`;

  doc.font(fonts.bold).fontSize(7.5).fillColor('#0f172a')
    .text(title, textX, stripY + 8, { width: textW });
  doc.font(fonts.regular).fontSize(7.2).fillColor('#1e293b')
    .text(body, textX, stripY + 21, { width: textW, lineGap: 1.6 });

  if (qrSpec.showVerificationCode && displayCode !== '—') {
    doc.font(fonts.bold).fontSize(7.4).fillColor('#0f172a')
      .text(isEn ? `Verification code: ${displayCode}` : `Code de vérification : ${displayCode}`, textX, stripY + 51, {
        width: textW,
      });
  }

  doc.y = stripY + stripH + 2;
  return {
    stripRect: { x: left, y: stripY, w: stripW, h: stripH },
    qrRect: { x: qrX, y: qrY, w: qrSize, h: qrSize },
  };
}

