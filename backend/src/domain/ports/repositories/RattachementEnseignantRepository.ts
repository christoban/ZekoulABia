export interface VerifierRattachementOptions {
  /**
   * true  : un professeur principal de la classe est aussi autorisé, même sans assignation sur
   *         cette matière précise (présences, rattrapage sans matière précisée — l'usage réel).
   * false : seule une assignation classe+matière (TeachingAssignment) compte — pour tout ce qui
   *         est intrinsèquement lié à UNE matière (notes, cahier de texte).
   */
  autoriserProfesseurPrincipal: boolean;
}

export type ClassePourAffectation = {
  id: string;
  name: string;
  level: string | null;
  serie: string | null;
  filiere: string | null;
  academicYearId: string;
};

export type CoefficientAvecMatiere = {
  subjectId: string;
  coefficient: number;
  subject: { id: string; name: string };
};

export type OverrideAvecMatiere = {
  subjectId: string;
  coefficient: number;
  subject: { id: string; name: string };
};

export type AffectationAvecEnseignant = {
  subjectId: string;
  teacherId: string;
  teacher: { id: string; firstName: string; lastName: string };
  source: 'MANUAL' | 'GENERATED' | 'UNKNOWN';
  createdAt: Date | null;
};

export type EnseignantEligible = {
  id: string;
  firstName: string;
  lastName: string;
};

export type SuggestionEnseignant = {
  teacherId: string;
  firstName: string;
  lastName: string;
  chargeHeures: number;
};

export type IssueAffectation = {
  id: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  reason: string;
  status: string;
  detectedAt: Date;
  resolvedAt: Date | null;
};

export type ValidationAffectationResultat =
  | { ok: true }
  | { ok: false; code: 'AP_WEEKLY_CAP_EXCEEDED' | 'TEACHER_WEEKLY_CAP_EXCEEDED'; currentLoad: number; candidateLoad: number; suggestions: SuggestionEnseignant[] };

export interface RattachementEnseignantRepository {
  /**
   * Vérifie qu'un enseignant est réellement rattaché à une classe (et matière optionnelle).
   * Source unique de vérité pour notes, présences, cahier de texte, rattrapage.
   */
  estRattacheALaClasse(
    teacherId: string,
    classId: string,
    subjectId: string | undefined,
    options: VerifierRattachementOptions,
  ): Promise<boolean>;

  trouverClasse(classId: string, schoolId: string): Promise<ClassePourAffectation | null>;

  listerCoefficients(params: {
    schoolId: string;
    classLevel?: string | null;
    serieCode: string | null;
  }): Promise<CoefficientAvecMatiere[]>;

  listerOverrides(classId: string, schoolId: string): Promise<OverrideAvecMatiere[]>;

  listerAffectations(classId: string, schoolId: string): Promise<AffectationAvecEnseignant[]>;

  listerIssuesAffectations(params: {
    schoolId: string;
    academicYearId?: string;
    status?: string;
  }): Promise<IssueAffectation[]>;

  enregistrerIssueAffectation(params: {
    schoolId: string;
    academicYearId: string;
    classId: string;
    subjectId: string;
    reason: string;
    details?: Record<string, unknown>;
  }): Promise<void>;

  listerUtilisateursAffectations(schoolId: string): Promise<{ id: string }[]>;

  listerEnseignantsEligibles(schoolId: string, subjectId: string): Promise<EnseignantEligible[]>;

  verifierEnseignant(teacherId: string, schoolId: string): Promise<boolean>;

  assigner(params: {
    classId: string;
    subjectId: string;
    teacherId: string;
    schoolId: string;
    academicYearId: string;
  }): Promise<void>;

  retirer(params: { classId: string; subjectId: string; schoolId: string }): Promise<void>;

  supprimerToutesLesAffectationsDeLaClasse(params: { classId: string; schoolId: string }): Promise<number>;

  supprimerToutesLesAffectationsDeLEtablissement(params: { schoolId: string; academicYearId: string }): Promise<number>;

  resoudreIssueAffectation(params: {
    schoolId: string;
    academicYearId: string;
    classId: string;
    subjectId: string;
    userId: string;
  }): Promise<void>;

  validerAffectationPossible(params: {
    classId: string;
    subjectId: string;
    teacherId: string;
    schoolId: string;
    academicYearId: string;
  }): Promise<ValidationAffectationResultat>;
}
