export interface Lv2ChoiceWindowRef {
  id: string;
  schoolId: string;
  level: string;
  academicYearId: string;
  openDate: Date;
  closeDate: Date;
  status: string;
}

export interface Lv2ChoiceSubmissionRef {
  id: string;
  windowId: string;
  studentProfileId: string;
  chosenSubjectId: string;
  submissionMethod: string;
  submittedByUserId: string | null;
  submittedAt: Date | null;
  chosenSubject?: { name: string } | null;
}

export interface Lv2ChoiceRepository {
  listerFenetres(schoolId: string): Promise<Lv2ChoiceWindowRef[]>;
  trouverProfilEleveAvecClasse(userId: string, schoolId: string): Promise<{ id: string; classId: string | null; level: string | null } | null>;
  trouverFenetreOuverteParNiveauExacte(schoolId: string, level: string): Promise<Lv2ChoiceWindowRef | null>;
  trouverSoumission(windowId: string, studentProfileId: string): Promise<Lv2ChoiceSubmissionRef | null>;
  listerMatieresLV2(schoolId: string): Promise<{ id: string; name: string }[]>;
  trouverFenetre(fenetreId: string): Promise<Lv2ChoiceWindowRef | null>;
  trouverFenetreOuverteParNiveau(schoolId: string, level: string, academicYearId: string): Promise<Lv2ChoiceWindowRef | null>;
  trouverFenetreOuverteActive(schoolId: string, level: string): Promise<Lv2ChoiceWindowRef | null>;
  creerFenetre(data: { schoolId: string; level: string; academicYearId: string; openDate: Date; closeDate: Date }): Promise<Lv2ChoiceWindowRef>;
  cloreFenetre(fenetreId: string): Promise<void>;
  mettreAJourCloture(fenetreId: string, closeDate: Date): Promise<void>;
  listerSoumissions(fenetreId: string): Promise<Lv2ChoiceSubmissionRef[]>;
  upsertSoumission(data: {
    windowId: string;
    studentProfileId: string;
    chosenSubjectId: string;
    submissionMethod: string;
    submittedByUserId?: string;
  }): Promise<void>;
  listerElevesDuNiveau(schoolId: string, level: string): Promise<{ studentUserId: string; studentName: string }[]>;
  suivreFenetre(fenetreId: string, schoolId: string): Promise<{
    window: { id: string; level: string; status: string; openDate: Date; closeDate: Date };
    total: number;
    submitted: number;
    pending: number;
    students: {
      studentProfileId: string;
      userId: string;
      firstName: string;
      lastName: string;
      className: string;
      hasSubmitted: boolean;
      submissionMethod?: string;
      chosenSubjectName?: string;
    }[];
  }>;
}