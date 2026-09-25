import type { TimetableGenerationRunData, TimetableGenerationRunRepository, TimetableGenerationRunStatus } from '@domain/ports/repositories/TimetableGenerationRunRepository';

export class InMemoryTimetableGenerationRunRepository implements TimetableGenerationRunRepository {
  private runs: TimetableGenerationRunData[] = [];
  private nextId = 1;

  async create(params: { schoolId: string; academicYearId: string; requestedById: string; budgetSeconds?: number; progress?: unknown }): Promise<TimetableGenerationRunData> {
    const run: TimetableGenerationRunData = {
      id: `run-${this.nextId++}`,
      schoolId: params.schoolId,
      academicYearId: params.academicYearId,
      status: 'PENDING',
      requestedById: params.requestedById,
      budgetSeconds: params.budgetSeconds ?? 300,
      progress: params.progress,
      results: [],
      heartbeatAt: new Date(),
      createdAt: new Date(),
    };
    this.runs.push(run);
    return run;
  }

  setCreatedAt(id: string, date: Date): void {
    const run = this.runs.find(item => item.id === id);
    if (run) run.createdAt = date;
  }

  setHeartbeatAt(id: string, date: Date): void {
    const run = this.runs.find(item => item.id === id);
    if (run) run.heartbeatAt = date;
  }

  async findById(id: string, schoolId: string): Promise<TimetableGenerationRunData | null> {
    const run = this.runs.find(r => r.id === id && r.schoolId === schoolId);
    return run ? { ...run, progress: run.progress ? JSON.parse(JSON.stringify(run.progress)) : run.progress, results: [...run.results] } : null;
  }

  async findActive(schoolId: string, academicYearId: string): Promise<TimetableGenerationRunData | null> {
    const terminal: TimetableGenerationRunStatus[] = ['COMPLETED', 'FAILED', 'CANCELLED'];
    return this.runs.find(r => r.schoolId === schoolId && r.academicYearId === academicYearId && !terminal.includes(r.status)) ?? null;
  }

  async appendResult(id: string, schoolId: string, result: unknown, status: TimetableGenerationRunStatus, progress: unknown): Promise<void> {
    const run = this.runs.find(r => r.id === id && r.schoolId === schoolId);
    if (!run) throw new Error('Run introuvable');
    run.results.push(result);
    run.status = status;
    run.progress = progress;
    run.heartbeatAt = new Date();
  }

  async markRunning(id: string, schoolId: string): Promise<void> {
    const run = this.runs.find(r => r.id === id && r.schoolId === schoolId);
    if (!run) throw new Error('Run introuvable');
    run.status = 'RUNNING';
    run.startedAt = new Date();
    run.heartbeatAt = new Date();
  }

  async markFinished(id: string, schoolId: string, status: TimetableGenerationRunStatus, errorMessage?: string): Promise<void> {
    const run = this.runs.find(r => r.id === id && r.schoolId === schoolId);
    if (!run) throw new Error('Run introuvable');
    run.status = status;
    run.finishedAt = new Date();
    run.heartbeatAt = new Date();
    if (errorMessage) run.errorMessage = errorMessage;
  }

  async markCancelled(id: string, schoolId: string): Promise<void> {
    const run = this.runs.find(r => r.id === id && r.schoolId === schoolId);
    if (!run) throw new Error('Run introuvable');
    run.status = 'CANCELLED';
    run.heartbeatAt = new Date();
  }

  async failStale(schoolId: string, olderThan: Date): Promise<number> {
    let count = 0;
    for (const run of this.runs) {
      if (run.schoolId === schoolId && run.heartbeatAt < olderThan && !['COMPLETED', 'FAILED', 'CANCELLED'].includes(run.status)) {
        run.status = 'FAILED';
        run.finishedAt = new Date();
        count++;
      }
    }
    return count;
  }
}
