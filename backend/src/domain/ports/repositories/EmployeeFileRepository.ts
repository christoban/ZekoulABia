/**
 * DOMAIN LAYER — Port Repository EmployeeFile (fiche RH employé)
 */
export interface EmployeeFileData {
  id: string;
  userId: string;
  schoolId: string;
  dateNaissance: Date | null;
  gender: string | null;
  diplomes: unknown;
  numeroCNPS: string | null;
  typeContrat: string | null;
  dateEmbauche: Date | null;
  echelonActuel: string | null;
  documentsUrls: unknown;
  selfServiceCompletedAt: Date | null;
  remindersSentCount: number;
  lastReminderAt: Date | null;
  escalatedAt: Date | null;
}

export interface EmployeeFileRepository {
  findByUser(userId: string): Promise<EmployeeFileData | null>;
  findManyByUserIds(userIds: string[]): Promise<EmployeeFileData[]>;
  findByUserAndSchool(userId: string, schoolId: string): Promise<EmployeeFileData | null>;
  save(data: EmployeeFileData): Promise<EmployeeFileData>;
  /** Upsert partiel de la fiche employé — à la création la fiche est initialisée avec
   *  userId/schoolId + les champs fournis ; en update seuls les champs fournis
   *  (non-undefined) sont écrits, les autres sont laissés tels quels. */
  upsertByUser(userId: string, schoolId: string, data: Partial<EmployeeFileData>): Promise<EmployeeFileData>;
}
