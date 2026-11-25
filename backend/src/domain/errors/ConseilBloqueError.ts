/**
 * DOMAIN LAYER — Logique métier pure
 * Loi 5 : Si une seule note de la classe n'est pas LOCKED,
 * la création d'une session de Conseil de Classe est bloquée.
 */
export class ConseilBloqueError extends Error {
  public readonly notesManquantes: { matiereNom: string; enseignantNom: string }[];

  constructor(
    classeNom: string,
    notesManquantes: { matiereNom: string; enseignantNom: string }[]
  ) {
    const liste = notesManquantes
      .map(n => `${n.matiereNom} (${n.enseignantNom})`)
      .join(', ');
    super(
      `Conseil de Classe bloqué pour la classe "${classeNom}". ` +
      `Notes pas encore validées : ${liste}`
    );
    this.name = 'ConseilBloqueError';
    this.notesManquantes = notesManquantes;
  }
}
