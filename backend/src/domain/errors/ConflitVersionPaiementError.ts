/**
 * DOMAIN LAYER — Erreur de conflit de version lors d'un encaissement.
 * V3.2 : jamais de résolution automatique silencieuse sur les paiements —
 * si la facture a changé depuis la lecture du client, on refuse et on laisse
 * l'humain arbitrer (409 CONFLIT_VERSION, comme pour les notes).
 */
export class ConflitVersionPaiementError extends Error {
  readonly factureId: string;
  readonly versionServeur: Date;
  readonly versionLocale: Date | null;
  readonly montantSaisi: number;
  readonly totalPaye: number;
  readonly resteARegler: number;

  constructor(params: {
    factureId: string;
    versionServeur: Date;
    versionLocale: Date | null;
    montantSaisi: number;
    totalPaye: number;
    resteARegler: number;
  }) {
    super(
      `Conflit de version détecté : la facture ${params.factureId} a été modifiée depuis l'affichage. ` +
      `Rechargez la facture avant d'encaisser.`
    );
    this.name = 'ConflitVersionPaiementError';
    this.factureId = params.factureId;
    this.versionServeur = params.versionServeur;
    this.versionLocale = params.versionLocale;
    this.montantSaisi = params.montantSaisi;
    this.totalPaye = params.totalPaye;
    this.resteARegler = params.resteARegler;
  }
}