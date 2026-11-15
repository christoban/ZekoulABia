/**
 * DOMAIN PORT — Service de rendu PDF officiel des reçus de paiement (bilingue FR/EN).
 */
import type { PaiementRecuData } from '@domain/ports/repositories/PaiementRepository';

export interface RenderReceiptOptions {
  payment: PaiementRecuData;
  isDuplicate?: boolean;
  language?: 'fr' | 'en' | 'bilingual';
}

export interface ReceiptPdfRendererPort {
  renderReceiptPdf(options: RenderReceiptOptions): Promise<Buffer>;
}

