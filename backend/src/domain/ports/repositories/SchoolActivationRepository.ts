/**
 * DOMAIN LAYER — Port Repository Activation d'Établissement
 *
 * Le flux d'activation (APPROVED → ACTIVE) est UNE transaction unique (§4.12) qui crée
 * l'année, les périodes, séquences, classes, matières, coefficients, départements, formules,
 * configuration et plans de frais. Le port expose donc :
 *  - `findSchoolForActivation` : lecture de l'école (hors tx).
 *  - `mettreAJourOnboardingConfig` : persistance du config onboarding (ConfigurerEtablissement).
 *  - `activerEtablissement` : exécute la transaction et expose un `SchoolActivationTx`
 *    (Unit of Work scopé à cette transaction) à la logique applicative.
 */
import type { SubjectAssignmentRepository } from './SubjectAssignmentRepository';

export interface SchoolActivationData {
  id: string;
  name: string;
  status: string;
  onboardingConfig: unknown;
  templateCode: string | null;
  template: { config: unknown } | null;
  configurationForm: { schoolId: string } | null;
  features: unknown;
}

export interface SubjectRecord {
  id: string;
  name: string;
  code: string;
  coefficient: number;
  hoursPerWeek: number;
  isLV2: boolean;
}

export interface SchoolActivationTx {
  // Année / périodes / séquences
  creerAnnee(data: { name: string; startDate: Date; endDate: Date }): Promise<{ id: string }>;
  creerPeriode(data: { academicYearId: string; name: string; type: string; orderIndex: number; startDate: Date; endDate: Date; isCurrent: boolean }): Promise<{ id: string }>;
  creerSequence(data: { academicPeriodId: string; name: string; type: string; orderIndex: number; isCurrent: boolean }): Promise<void>;

  // Références
  findBacCombos(): Promise<{ serie: string; niveau: string }[]>;
  findSchoolTemplate(code: string): Promise<{ config: unknown } | null>;
  findAnglophoneStreamCombinations(filieres: string[]): Promise<{ filiere: string; coreSubjects: unknown; electiveGroup: unknown }[]>;
  findAnglophoneSubjectLoads(templateCode: string, classLevel: string, filiere: string): Promise<{ subjectName: string; coefficient: number; weeklyPeriods: number | null }[]>;

  // Classes
  creerClasse(data: { name: string; level: string; academicYearId: string; serie: string | null; filiere: string | null; pebsMixte: boolean }): Promise<void>;
  findClasses(levels?: string[]): Promise<{ id: string; name: string; level: string; serie: string | null }[]>;

  // Matières
  creerMatiere(data: { name: string; code: string; coefficient: number; hoursPerWeek: number; subjectType?: string; departmentId?: string | null; isLV2?: boolean }): Promise<{ id: string }>;
  findMatieres(options?: { excludeIds?: string[]; onlyLV2?: boolean }): Promise<SubjectRecord[]>;
  findMatiereParNom(name: string, isLV2?: boolean): Promise<SubjectRecord | null>;
  mettreAJourMatiere(id: string, data: { departmentId?: string | null; isLV2?: boolean }): Promise<void>;
  supprimerMatiere(id: string): Promise<void>;

  // Coefficients
  findCoefficient(subjectId: string, classLevel: string, serieCode: string | null): Promise<{ id: string } | null>;
  creerCoefficient(data: { subjectId: string; classLevel: string; serieCode: string | null; coefficient: number }): Promise<void>;
  findSubjectsCoefficient(classLevel: string, serieCode: string): Promise<{ subjectId: string }[]>;
  findCoefficientsMatiere(subjectId: string, classLevels: string[]): Promise<{ classLevel: string; serieCode: string | null; coefficient: number }[]>;
  supprimerCoefficientsMatiere(subjectId: string, classLevels: string[]): Promise<void>;
  compterCoefficientsMatiere(subjectId: string): Promise<number>;

  // Départements
  creerDepartement(data: { name: string; color: string }): Promise<{ id: string }>;
  findDepartementParNom(names: string[]): Promise<{ id: string } | null>;

  // Overrides de classe
  findClassSubjectOverride(classId: string, subjectId: string): Promise<{ id: string } | null>;
  creerClassSubjectOverride(data: { classId: string; subjectId: string; coefficient: number }): Promise<void>;

  // Formules / mentions
  findGradeFormula(id: string): Promise<{ label: string; evaluations: unknown } | null>;
  creerGradeFormula(data: { label: string; evaluations: unknown }): Promise<void>;
  findMentionRule(id: string): Promise<{ rules: unknown } | null>;
  creerMentionRule(data: { rules: unknown }): Promise<void>;

  // Configuration / settings / frais
  creerSchoolConfig(data: {
    passMark: number; councilPassMark: number; termsPerYear: number; maxAbsences: number;
    gradesPerTerm: number; attendanceLateAsAbsence: boolean; schoolLanguageMode: string; bulletinTemplate: string;
  }): Promise<void>;
  creerSchoolSettings(data: { timezone: string; locale: string; currency: string }): Promise<void>;
  findFeePlan(feeType: string): Promise<{ id: string } | null>;
  creerFeePlan(data: { name: string; amount: number; feeType: string; isRefundable: boolean; description: string }): Promise<void>;

  // Finalisation
  mettreAJourEcole(data: { status: string; hasPEBSFrancophone: boolean; hasPEBSAnglophone: boolean; features?: unknown }): Promise<void>;
  marquerFormulaireComplet(): Promise<void>;

  /** Repository d'assignation matières/coefficients scopé à cette transaction (pour SubjectAssignmentHelper). */
  subjectAssignment(): SubjectAssignmentRepository;
}

export interface SchoolActivationRepository {
  findSchoolForActivation(schoolId: string): Promise<SchoolActivationData | null>;
  mettreAJourOnboardingConfig(schoolId: string, data: { onboardingConfig: unknown; templateCode?: string }): Promise<void>;
  activerEtablissement<T>(schoolId: string, operation: (tx: SchoolActivationTx) => Promise<T>): Promise<T>;
}
