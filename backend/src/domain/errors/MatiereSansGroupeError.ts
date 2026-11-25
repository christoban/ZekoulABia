/**
 * DOMAIN LAYER — Erreur métier : matière(s) sans groupe dans le schéma sélectionné.
 * Collecte TOUTES les matières sans groupe en une seule réponse bloquante, sans repli vers « Autres ».
 */
export interface MissingSubjectGroupItem {
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
}

export class MatiereSansGroupeError extends Error {
  readonly subjectId: string;
  readonly subjectName: string;
  readonly subjectCode: string | null;
  readonly groupingScheme: string;
  readonly missingSubjects: readonly MissingSubjectGroupItem[];

  constructor(params: {
    subjectId?: string;
    subjectName?: string;
    subjectCode?: string | null | undefined;
    groupingScheme: string;
    missingSubjects?: MissingSubjectGroupItem[];
  }) {
    const list: MissingSubjectGroupItem[] =
      params.missingSubjects && params.missingSubjects.length > 0
        ? params.missingSubjects.map((m) => ({
            subjectId: m.subjectId,
            subjectName: m.subjectName,
            subjectCode: m.subjectCode?.trim() || null,
          }))
        : [
            {
              subjectId: params.subjectId ?? 'unknown',
              subjectName: params.subjectName ?? 'Matière inconnue',
              subjectCode: params.subjectCode?.trim() || null,
            },
          ];

    const formattedList = list
      .map((m) => `"${m.subjectName}" (code : ${m.subjectCode ?? 'AUCUN'})`)
      .join(', ');

    super(
      `${list.length} matière(s) sans groupe dans le schéma "${params.groupingScheme}" : ${formattedList}. ` +
        'Configurez un code matière reconnu ou renseignez leur groupe sur la matière / les coefficients de niveau.',
    );
    this.name = 'MatiereSansGroupeError';
    this.missingSubjects = list;
    this.subjectId = list[0]!.subjectId;
    this.subjectName = list[0]!.subjectName;
    this.subjectCode = list[0]!.subjectCode;
    this.groupingScheme = params.groupingScheme;
  }
}
