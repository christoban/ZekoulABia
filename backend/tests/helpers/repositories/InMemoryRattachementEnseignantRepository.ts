import type {
  RattachementEnseignantRepository,
  VerifierRattachementOptions,
  ClassePourAffectation,
  CoefficientAvecMatiere,
  OverrideAvecMatiere,
  AffectationAvecEnseignant,
  EnseignantEligible,
  ValidationAffectationResultat,
} from '@domain/ports/repositories/RattachementEnseignantRepository';

export class InMemoryRattachementEnseignantRepository implements RattachementEnseignantRepository {
  private assignations: { teacherId: string; classId: string; subjectId: string; schoolId?: string; academicYearId?: string; source: 'MANUAL' | 'GENERATED' | 'UNKNOWN'; createdAt: Date | null }[] = [];
  private professeursPrincipaux: { classId: string; professorPrincipalId: string }[] = [];
  private classes: ClassePourAffectation[] = [];
  private coefficients: CoefficientAvecMatiere[] = [];
  private overrides: Map<string, OverrideAvecMatiere[]> = new Map();
  private eligibleBySubject: Map<string, EnseignantEligible[]> = new Map();
  private enseignantsValides: Set<string> = new Set();

  ajouterAssignation(teacherId: string, classId: string, subjectId: string): void {
    this.assignations.push({ teacherId, classId, subjectId, source: 'UNKNOWN', createdAt: null });
  }

  ajouterProfesseurPrincipal(classId: string, professorPrincipalId: string): void {
    this.professeursPrincipaux.push({ classId, professorPrincipalId });
  }

  // Helpers for teaching assignment tests
  ajouterClasse(c: ClassePourAffectation): void {
    this.classes.push(c);
  }
  ajouterCoefficient(c: CoefficientAvecMatiere): void {
    this.coefficients.push(c);
  }
  definirOverrides(classId: string, overrides: OverrideAvecMatiere[]): void {
    this.overrides.set(classId, overrides);
  }
  definirEnseignantsEligibles(subjectId: string, enseignants: EnseignantEligible[]): void {
    this.eligibleBySubject.set(subjectId, enseignants);
  }
  ajouterEnseignantValide(teacherId: string): void {
    this.enseignantsValides.add(teacherId);
  }

  async trouverClasse(classId: string, schoolId: string): Promise<ClassePourAffectation | null> {
    return this.classes.find(c => c.id === classId) ?? null;
  }

  async listerCoefficients(params: { schoolId: string; classLevel?: string | null; serieCode: string | null }): Promise<CoefficientAvecMatiere[]> {
    return this.coefficients;
  }

  async listerOverrides(classId: string, _schoolId: string): Promise<OverrideAvecMatiere[]> {
    return this.overrides.get(classId) ?? [];
  }

  async listerAffectations(classId: string, _schoolId: string): Promise<AffectationAvecEnseignant[]> {
    return this.assignations
      .filter(a => a.classId === classId)
      .map(a => ({
        subjectId: a.subjectId,
        teacherId: a.teacherId,
        teacher: { id: a.teacherId, firstName: 'Prenom', lastName: 'Nom' },
        source: a.source,
        createdAt: a.createdAt,
      }));
  }

  async listerIssuesAffectations(_params: { schoolId: string; academicYearId?: string; status?: string }) {
    return [];
  }

  async enregistrerIssueAffectation(_params: {
    schoolId: string;
    academicYearId: string;
    classId: string;
    subjectId: string;
    reason: string;
    details?: Record<string, unknown>;
  }): Promise<void> {}

  async listerUtilisateursAffectations(_schoolId: string): Promise<{ id: string }[]> {
    return [];
  }

  async listerEnseignantsEligibles(_schoolId: string, subjectId: string): Promise<EnseignantEligible[]> {
    return this.eligibleBySubject.get(subjectId) ?? [];
  }

  async verifierEnseignant(teacherId: string, _schoolId: string): Promise<boolean> {
    if (this.enseignantsValides.size === 0) return true;
    return this.enseignantsValides.has(teacherId);
  }

  async assigner(params: { classId: string; subjectId: string; teacherId: string; schoolId: string; academicYearId: string }): Promise<void> {
    const existing = this.assignations.find(a => a.classId === params.classId && a.subjectId === params.subjectId);
    if (existing) {
      existing.teacherId = params.teacherId;
      existing.source = 'MANUAL';
      existing.createdAt = new Date();
    } else {
      this.assignations.push({ teacherId: params.teacherId, classId: params.classId, subjectId: params.subjectId, schoolId: params.schoolId, academicYearId: params.academicYearId, source: 'MANUAL', createdAt: new Date() });
    }
  }

  async retirer(params: { classId: string; subjectId: string; schoolId: string }): Promise<void> {
    this.assignations = this.assignations.filter(a => !(a.classId === params.classId && a.subjectId === params.subjectId));
  }

  async supprimerToutesLesAffectationsDeLaClasse(params: { classId: string; schoolId: string }): Promise<number> {
    const before = this.assignations.length;
    this.assignations = this.assignations.filter(a => a.classId !== params.classId || (a.schoolId !== undefined && a.schoolId !== params.schoolId));
    return before - this.assignations.length;
  }

  async supprimerToutesLesAffectationsDeLEtablissement(params: { schoolId: string; academicYearId: string }): Promise<number> {
    const before = this.assignations.length;
    this.assignations = this.assignations.filter(a => a.schoolId !== params.schoolId || (a.academicYearId !== undefined && a.academicYearId !== params.academicYearId));
    return before - this.assignations.length;
  }

  async resoudreIssueAffectation(_params: {
    schoolId: string;
    academicYearId: string;
    classId: string;
    subjectId: string;
    userId: string;
  }): Promise<void> {}

  async estRattacheALaClasse(
    teacherId: string,
    classId: string,
    subjectId: string | undefined,
    options: VerifierRattachementOptions,
  ): Promise<boolean> {
    const assignation = this.assignations.some(
      (a) =>
        a.teacherId === teacherId &&
        a.classId === classId &&
        (subjectId === undefined || a.subjectId === subjectId),
    );
    if (assignation) return true;
    if (!options.autoriserProfesseurPrincipal) return false;

    return this.professeursPrincipaux.some(
      (p) => p.classId === classId && p.professorPrincipalId === teacherId,
    );
  }

  async validerAffectationPossible(): Promise<ValidationAffectationResultat> {
    // Le in-memory ne simule pas la charge AP ; les tests dédiés utilisent l'adaptateur Prisma.
    return { ok: true };
  }
}
