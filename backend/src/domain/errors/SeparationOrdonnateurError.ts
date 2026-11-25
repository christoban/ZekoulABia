/**
 * DOMAIN LAYER — Logique métier pure
 * Loi 2 — Art. 34 & 39 : Le Proviseur ordonne les dépenses.
 * L'Intendant les exécute. Ces deux actions ne peuvent jamais être faites par la même personne.
 */
export class SeparationOrdonnateurError extends Error {
  constructor(userId: string) {
    super(
      `Séparation ordonnateur/comptable violée (Art. 34 & 39). ` +
      `L'utilisateur ${userId} ne peut pas à la fois ordonner et exécuter une dépense.`
    );
    this.name = 'SeparationOrdonnateurError';
  }
}
