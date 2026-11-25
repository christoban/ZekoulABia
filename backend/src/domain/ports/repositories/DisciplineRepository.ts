export interface DisciplineSessionData {
  id: string;
  schoolId: string;
  studentId: string;
  presidedById: string;
  motif: string;
  composition: unknown;
  parentNotifiedAt: Date;
  scheduledAt: Date;
  status: string;
  heldAt: Date | null;
  decision: string | null;
  pv: string | null;
  disciplineRecordId: string | null;
  createdAt: Date;
  student?: { id: string; firstName: string; lastName: string };
  presidedBy?: { id: string; firstName: string; lastName: string };
}

export interface DisciplineRecordData {
  id: string;
  schoolId: string;
  studentId: string;
  type: string;
  reason: string;
  decidedById: string;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  student?: { id: string; firstName: string; lastName: string };
  decidedBy?: { id: string; firstName: string; lastName: string };
  status?: string | null;
}

export interface DisciplineRepository {
  verifierEleve(studentId: string, schoolId: string): Promise<boolean>;
  findRecordsBySchool(schoolId: string, filters: { studentId?: string; type?: string; status?: string; page: number; limit: number }): Promise<DisciplineRecordData[]>;
  countRecordsBySchool(schoolId: string, filters: { studentId?: string; type?: string; status?: string }): Promise<number>;
  trouverRecord(id: string, schoolId: string): Promise<DisciplineRecordData | null>;
  leverRecord(id: string): Promise<DisciplineRecordData>;
  findParentEmails(studentId: string): Promise<string[]>;

  creerSession(data: {
    schoolId: string;
    studentId: string;
    presidedById: string;
    motif: string;
    composition: unknown;
    parentNotifiedAt: Date;
    scheduledAt: Date;
  }): Promise<DisciplineSessionData>;

  trouverSession(id: string, schoolId: string): Promise<DisciplineSessionData | null>;

  listerSessions(schoolId: string, status?: string): Promise<DisciplineSessionData[]>;

  creerRecord(data: {
    schoolId: string;
    studentId: string;
    type: string;
    reason: string;
    decidedById: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<DisciplineRecordData>;

  mettreAJourSession(id: string, data: {
    heldAt: Date;
    decision: string;
    pv: string;
    status: string;
    disciplineRecordId: string;
  }): Promise<DisciplineSessionData & { disciplineRecord: DisciplineRecordData | null }>;
}
