export interface SauvegardeRepository {
  listerEcoles(params: { schoolId?: string }): Promise<Array<{ id: string; name: string }>>;
  sauvegarderEcole(params: {
    schoolId: string;
    requestedByMasterId?: string | null;
    source?: 'cron' | 'manual';
  }): Promise<{ schoolId: string; fileName: string; filePath: string; createdAt: string }>;
}
