/**
 * DOMAIN LAYER — Logique métier pure
 * Loi 1 — Art. 30 : Seul le Chef d'Établissement (ADMIN) peut prononcer une exclusion.
 */
export class ExclusionNonAutoriseeError extends Error {
  constructor(roleActuel: string) {
    super(
      `Seul le Chef d'Établissement peut prononcer une exclusion (Art. 30). ` +
      `Rôle actuel : ${roleActuel}`
    );
    this.name = 'ExclusionNonAutoriseeError';
  }
}
