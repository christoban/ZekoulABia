/**
 * DOMAIN LAYER — Erreur métier : matière sans groupe dans le schéma sélectionné.
 * Empêche tout repli silencieux vers un groupe « Autres » lors de la génération.
 */
export class MatiereSansGroupeError extends Error {
  readonly subjectId: string;
  readonly subjectName: string;
  readonly subjectCode: string | null;
  readonly groupingScheme: string;

  constructor(params: {
    subjectId: string;
    subjectName: string;
    subjectCode: string | null | undefined;
    groupingScheme: string;
  }) {
    const codeLabel = params.subjectCode?.trim() || 'AUCUN';
    super(
      `Matière "${params.subjectName}" (code : ${codeLabel}) sans groupe dans le schéma "${params.groupingScheme}". ` +
      'Configurez un code matière reconnu ou renseignez son groupe sur la matière / les coefficients de niveau.',
    );
    this.name = 'MatiereSansGroupeError';
    this.subjectId = params.subjectId;
    this.subjectName = params.subjectName;
    this.subjectCode = params.subjectCode?.trim() || null;
    this.groupingScheme = params.groupingScheme;
  }
}
