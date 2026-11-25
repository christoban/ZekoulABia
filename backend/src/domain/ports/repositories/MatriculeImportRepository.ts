export interface MatriculeImportJobData {
  id: string;
  schoolId: string;
  uploadedBy: string;
  fileName: string;
  status: string;
  totalRows: number;
  matchedRows: number;
  matchedRowsExact: number;
  matchedRowsFuzzyConfirmed: number;
  flaggedForCorrection: number;
  unmatchedRows: number;
  errorRows: number;
  resultDetails: unknown;
  processedAt: Date | null;
}

export interface StudentProfileMatriculeData {
  id: string;
  userId: string;
  matricule: string | null;
  matriculeSource: string | null;
  matriculeMatchType: string | null;
  dateOfBirth: Date | null;
  user?: { firstName: string; lastName: string } | null;
}

export interface MatriculeImportRepository {
  creerJob(data: { schoolId: string; uploadedBy: string; fileName: string; totalRows: number }): Promise<MatriculeImportJobData>;
  trouverJob(jobId: string): Promise<MatriculeImportJobData | null>;
  listerJobs(schoolId: string, limit?: number): Promise<MatriculeImportJobData[]>;
  trouverJobPourEcole(jobId: string, schoolId: string): Promise<MatriculeImportJobData | null>;
  mettreAJourJob(jobId: string, data: Record<string, unknown>): Promise<void>;
  listerProfilsEcole(schoolId: string): Promise<StudentProfileMatriculeData[]>;
  trouverProfilParId(profileId: string, schoolId: string): Promise<StudentProfileMatriculeData | null>;
  trouverProfilMatricule(userId: string, schoolId: string): Promise<StudentProfileMatriculeData | null>;
  mettreAJourMatricule(profileId: string, data: { matricule: string; matriculeSource: string; matriculeMatchType: string }): Promise<void>;
  listerProfilsActifsAvecMatricule(schoolId: string): Promise<{ id: string; matricule: string }[]>;
  findByMatricules(schoolId: string, matricules: string[], classId: string): Promise<{ matricule: string; userId: string }[]>;
  compterProfilsActifs(schoolId: string): Promise<number>;
  trouverEcoleCodeMinesec(schoolId: string): Promise<{ minesecSchoolCode: string | null } | null>;
}