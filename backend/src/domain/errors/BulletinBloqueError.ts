/**
 * DOMAIN LAYER — Logique métier pure
 * Loi 4 : Si une seule note de la classe est en DRAFT,
 * la génération de bulletin est bloquée pour toute la classe.
 */
export class BulletinBloqueError extends Error {
  public readonly notesBloquantes: { matiereNom: string; enseignantNom: string; statut: string }[];

  constructor(
    classeNom: string,
    notesBloquantes: { matiereNom: string; enseignantNom: string; statut: string }[]
  ) {
    const liste = notesBloquantes
      .map(n => `${n.matiereNom} (${n.enseignantNom}) — statut : ${n.statut}`)
      .join(', ');
    super(
      `Génération de bulletin bloquée pour la classe "${classeNom}". ` +
      `Notes non validées : ${liste}`
    );
    this.name = 'BulletinBloqueError';
    this.notesBloquantes = notesBloquantes;
  }
}
