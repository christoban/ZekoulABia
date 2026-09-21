import type {
  AffectationPedagogiqueData,
  ImportContexte,
  ImportContexteValidation,
  ImportUtilisateursRepository,
} from '@domain/ports/repositories/ImportUtilisateursRepository';
import type { PebsFiliere } from '@domain/types/enums';

type ClasseMemoire = {
  id: string;
  schoolId: string;
  name: string;
  professorPrincipalId: string | null;
  level: string | null;
  serie: string | null;
  filiere: string | null;
  academicYearId: string;
  capacity?: number;
  currentEnrollments?: number;
};

type MatiereMemoire = { id: string; schoolId: string; name: string; isLV2: boolean };
type DepartmentMemoire = { id: string; schoolId: string; name: string };
type SectionMemoire = { id: string; schoolId: string; name: string };
type EleveMemoire = { schoolId: string; matricule?: string; email?: string; studentProfileId: string };

export class InMemoryImportUtilisateursRepository implements ImportUtilisateursRepository {
  private schoolNames = new Map<string, string>();
  private pebsBySchool = new Map<string, boolean>();
  private classes = new Map<string, ClasseMemoire>();
  private subjects = new Map<string, MatiereMemoire>();
  private departments = new Map<string, DepartmentMemoire>();
  private sections = new Map<string, SectionMemoire>();
  private parentsByEmail = new Map<string, string>();
  private students: EleveMemoire[] = [];
  private studentProfileIds = new Map<string, string>();
  private programmeSubjects = new Map<string, string[]>();
  private nomsUtilisateurs = new Map<string, string>();
  private autreClassePPForcee: { name: string } | null = null;

  affectations: AffectationPedagogiqueData[] = [];
  pebsUpdates: { userId: string; pebsFiliere: string }[] = [];
  lv2Updates: { userId: string; lv2SubjectId: string }[] = [];

  definirEcole(schoolId: string, name = 'École test', hasPEBS = false): void {
    this.schoolNames.set(schoolId, name);
    this.pebsBySchool.set(schoolId, hasPEBS);
  }

  ajouterClasse(input: Partial<ClasseMemoire> & Pick<ClasseMemoire, 'id' | 'schoolId' | 'name'>): void {
    this.classes.set(input.id, {
      professorPrincipalId: null,
      level: null,
      serie: null,
      filiere: null,
      academicYearId: 'annee-1',
      ...input,
    });
  }

  ajouterMatiere(input: Omit<MatiereMemoire, 'isLV2'> & { isLV2?: boolean }): void {
    this.subjects.set(input.id, { ...input, isLV2: input.isLV2 ?? false });
  }

  ajouterDepartment(input: DepartmentMemoire): void { this.departments.set(input.id, input); }
  ajouterSection(input: SectionMemoire): void { this.sections.set(input.id, input); }
  ajouterParent(schoolId: string, email: string, userId: string): void { this.parentsByEmail.set(`${schoolId}:${email.toLowerCase()}`, userId); }
  ajouterEleve(input: EleveMemoire): void { this.students.push({ ...input, email: input.email?.toLowerCase() }); }
  definirProfilEleve(userId: string, studentProfileId: string): void { this.studentProfileIds.set(userId, studentProfileId); }
  definirProgrammeClasse(classId: string, subjectIds: string[]): void { this.programmeSubjects.set(classId, subjectIds); }
  definirNomUtilisateur(userId: string, nomComplet: string): void { this.nomsUtilisateurs.set(userId, nomComplet); }
  forcerAutreClasseDePP(name: string | null): void { this.autreClassePPForcee = name ? { name } : null; }

  async chargerContexte(schoolId: string): Promise<ImportContexte> {
    return {
      schoolName: this.schoolNames.get(schoolId) ?? 'ZekoulABia',
      hasPEBS: this.pebsBySchool.get(schoolId) ?? false,
      classes: [...this.classes.values()].filter(c => c.schoolId === schoolId).map(c => ({ id: c.id, name: c.name, capacity: c.capacity, currentEnrollments: c.currentEnrollments })),
      lv2Subjects: [...this.subjects.values()].filter(s => s.schoolId === schoolId && s.isLV2).map(s => ({ id: s.id, name: s.name })),
    };
  }

  async findParentParEmail(schoolId: string, email: string): Promise<string | null> {
    return this.parentsByEmail.get(`${schoolId}:${email.toLowerCase()}`) ?? null;
  }

  async findStudentProfileId(userId: string): Promise<string | null> { return this.studentProfileIds.get(userId) ?? null; }
  async updatePeBSFiliere(userId: string, pebsFiliere: string): Promise<void> { this.pebsUpdates.push({ userId, pebsFiliere }); }
  async updateLv2Subject(userId: string, lv2SubjectId: string): Promise<void> { this.lv2Updates.push({ userId, lv2SubjectId }); }
  async updatePeBSAndLv2(userId: string, pebsFiliere: PebsFiliere | null, lv2SubjectId: string | null): Promise<void> {
    if (pebsFiliere !== null) this.pebsUpdates.push({ userId, pebsFiliere });
    if (lv2SubjectId !== null) this.lv2Updates.push({ userId, lv2SubjectId });
  }

  async findSubjectsParNoms(schoolId: string, noms: string[]): Promise<{ id: string; name: string }[]> {
    return [...this.subjects.values()].filter(s => s.schoolId === schoolId && noms.includes(s.name)).map(({ id, name }) => ({ id, name }));
  }

  async findClassePourPP(schoolId: string, name: string): Promise<{ id: string; professorPrincipalId: string | null } | null> {
    const classe = this.trouverClasse(schoolId, name);
    return classe ? { id: classe.id, professorPrincipalId: classe.professorPrincipalId } : null;
  }

  async findNomProfesseurPrincipal(userId: string): Promise<string | null> { return this.nomsUtilisateurs.get(userId) ?? null; }

  async findAutreClasseDePP(teacherId: string, schoolId: string, excludeClassId: string): Promise<{ name: string } | null> {
    if (this.autreClassePPForcee) return this.autreClassePPForcee;
    const classe = [...this.classes.values()].find(c => c.schoolId === schoolId && c.id !== excludeClassId && c.professorPrincipalId === teacherId);
    return classe ? { name: classe.name } : null;
  }

  async assignerProfesseurPrincipal(classId: string, teacherId: string): Promise<void> {
    const classe = this.classes.get(classId);
    if (!classe) throw new Error('Classe introuvable');
    classe.professorPrincipalId = teacherId;
  }

  async findClasseProgramme(schoolId: string, name: string): Promise<{ id: string; level: string | null; serie: string | null; filiere: string | null; academicYearId: string } | null> {
    const classe = this.trouverClasse(schoolId, name);
    return classe ? { id: classe.id, level: classe.level, serie: classe.serie, filiere: classe.filiere, academicYearId: classe.academicYearId } : null;
  }

  async findSubjectsDuProgramme(_schoolId: string, _level: string | null, _codeSerie: string | null, classId: string): Promise<string[]> {
    return this.programmeSubjects.get(classId) ?? [];
  }

  async creerAffectations(assignments: AffectationPedagogiqueData[]): Promise<number> {
    this.affectations.push(...assignments);
    return assignments.length;
  }

  async findStudentsParMatricules(schoolId: string, matricules: string[]): Promise<{ matricule: string; studentProfileId: string }[]> {
    return this.students.filter(s => s.schoolId === schoolId && s.matricule && matricules.includes(s.matricule)).map(s => ({ matricule: s.matricule!, studentProfileId: s.studentProfileId }));
  }

  async findStudentsParEmails(schoolId: string, emails: string[]): Promise<{ email: string; studentProfileId: string }[]> {
    return this.students.filter(s => s.schoolId === schoolId && s.email && emails.includes(s.email)).map(s => ({ email: s.email!, studentProfileId: s.studentProfileId }));
  }

  async findSectionParNom(schoolId: string, nom: string): Promise<{ id: string } | null> {
    const section = [...this.sections.values()].find(s => s.schoolId === schoolId && s.name === nom);
    return section ? { id: section.id } : null;
  }

  async findDepartmentsParNoms(schoolId: string, noms: string[]): Promise<{ id: string; name: string }[]> {
    return [...this.departments.values()].filter(d => d.schoolId === schoolId && noms.includes(d.name)).map(({ id, name }) => ({ id, name }));
  }

  async chargerContexteValidation(schoolId: string): Promise<ImportContexteValidation> {
    const classes = [...this.classes.values()].filter(c => c.schoolId === schoolId);
    const existingParents = new Map<string, string>();
    for (const [key, userId] of this.parentsByEmail) {
      const [parentSchoolId, email] = key.split(':');
      if (parentSchoolId === schoolId && email) existingParents.set(email, userId);
    }
    return {
      classes: classes.map(c => ({ id: c.id, name: c.name, level: c.level, serie: c.serie, filiere: c.filiere, academicYearId: c.academicYearId })),
      lv2Subjects: [...this.subjects.values()].filter(s => s.schoolId === schoolId && s.isLV2).map(({ id, name }) => ({ id, name })),
      hasPEBS: this.pebsBySchool.get(schoolId) ?? false,
      existingParents,
      existingStudents: this.students.filter(s => s.schoolId === schoolId).map(s => ({ id: s.studentProfileId, matricule: s.matricule, email: s.email })),
      subjects: [...this.subjects.values()].filter(s => s.schoolId === schoolId).map(({ id, name }) => ({ id, name })),
      departementsAp: [...this.departments.values()].filter(d => d.schoolId === schoolId).map(({ id, name }) => ({ id, name })),
    };
  }

  private trouverClasse(schoolId: string, name: string): ClasseMemoire | undefined {
    return [...this.classes.values()].find(c => c.schoolId === schoolId && c.name === name);
  }
}
