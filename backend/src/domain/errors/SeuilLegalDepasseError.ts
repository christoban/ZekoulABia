/**
 * DOMAIN LAYER — Logique métier pure
 * Loi 3 — Art. 48 : Aucune facturation supérieure aux seuils légaux MINESEC.
 */
export class SeuilLegalDepasseError extends Error {
  constructor(montantDemande: number, montantLegal: number, typeFrais: string) {
    super(
      `Seuil légal MINESEC dépassé (Art. 48). ` +
      `Frais "${typeFrais}" : montant demandé ${montantDemande} XAF, ` +
      `seuil légal ${montantLegal} XAF.`
    );
    this.name = 'SeuilLegalDepasseError';
  }
}
