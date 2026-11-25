import { describe, expect, it } from 'bun:test';
import { ImporterMatriculesUseCase } from '../../../../src/application/matricule/ImporterMatriculesUseCase.ts';
import type { MatriculeImportRepository, MatriculeImportJobData, StudentProfileMatriculeData } from '../../../../src/domain/ports/repositories/MatriculeImportRepository.ts';

class FakeMatriculeRepository implements MatriculeImportRepository {
  readonly updates: string[] = [];
  readonly jobs: MatriculeImportJobData[] = [];
  private nextId = 0;
  constructor(private readonly profiles: StudentProfileMatriculeData[]) {}

  async creerJob(data: { schoolId: string; uploadedBy: string; fileName: string; totalRows: number }): Promise<MatriculeImportJobData> {
    const job = { id: `job-${++this.nextId}`, ...data, status: 'PROCESSING', matchedRows: 0, matchedRowsExact: 0, matchedRowsFuzzyConfirmed: 0, flaggedForCorrection: 0, unmatchedRows: 0, errorRows: 0, resultDetails: null, processedAt: null };
    this.jobs.push(job);
    return job;
  }
  async trouverJob(jobId: string) { return this.jobs.find((job) => job.id === jobId) ?? null; }
  async listerJobs() { return this.jobs; }
  async trouverJobPourEcole(jobId: string) { return this.trouverJob(jobId); }
  async mettreAJourJob(jobId: string, data: Record<string, unknown>) { Object.assign(this.jobs.find((job) => job.id === jobId)!, data); }
  async listerProfilsEcole() { return this.profiles; }
  async trouverProfilParId() { return null; }
  async trouverProfilMatricule() { return null; }
  async mettreAJourMatricule(profileId: string) { this.updates.push(profileId); }
  async listerProfilsActifsAvecMatricule() { return []; }
  async findByMatricules() { return []; }
  async compterProfilsActifs() { return 0; }
  async trouverEcoleCodeMinesec() { return null; }
}

describe('ImporterMatriculesUseCase', () => {
  it('rejette explicitement une ligne invalide dans le rapport sans la faire disparaître', async () => {
    const repository = new FakeMatriculeRepository([]);
    const result = await new ImporterMatriculesUseCase(repository).execute('school-1', [{ ligne: 2, nom: 'Test', prenom: 'Awa', matricule: 'MAT-INVALID' }], 'user-1', 'import.xlsx');

    expect(result.errors).toBe(1);
    expect(result.unmatchedDetails).toEqual([{ ligne: 2, nom: 'Test', prenom: 'Awa', raison: 'Le matricule national doit être alphanumérique et non vide.' }]);
    expect(repository.updates).toEqual([]);
    expect(repository.jobs[0].errorRows).toBe(1);
  });

  it('persiste les lignes ignorées par le parser dans le job', async () => {
    const repository = new FakeMatriculeRepository([]);
    await new ImporterMatriculesUseCase(repository).execute(
      'school-1',
      [],
      'user-1',
      'import.xlsx',
      ['Ligne 5 : nom ou prénom manquant'],
    );

    const details = repository.jobs[0].resultDetails as { parseErrors: string[] };
    expect(details.parseErrors).toEqual(['Ligne 5 : nom ou prénom manquant']);
  });
});
