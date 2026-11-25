export interface JournalMaintenanceRepository {
  purgerTousLesJournaux(): Promise<Array<{
    schoolId: string;
    logRetentionDays: number;
    cutoff: string;
    emailDeleted: number;
    smsDeleted: number;
  }>>;
  purgerJournauxEcole(schoolId: string): Promise<{
    schoolId: string;
    logRetentionDays: number;
    cutoff: string;
    emailDeleted: number;
    smsDeleted: number;
  }>;
  listerEcolesActives(): Promise<Array<{ id: string; name: string }>>;
}
