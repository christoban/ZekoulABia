export type TimetableGenerationRunStatus = 'PENDING' | 'RUNNING' | 'PARTIAL' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type TimetableGenerationRunData = {
  id: string;
  schoolId: string;
  academicYearId: string;
  status: TimetableGenerationRunStatus;
  requestedById: string;
  preflightReport?: unknown;
  results: unknown[];
  progress?: unknown;
  errorMessage?: string | null;
  budgetSeconds: number;
  heartbeatAt: Date;
  createdAt: Date;
  startedAt?: Date | null;
  finishedAt?: Date | null;
};

export interface TimetableGenerationRunRepository {
  create(params: { schoolId: string; academicYearId: string; requestedById: string; budgetSeconds?: number; progress?: unknown; preflightReport?: unknown }): Promise<TimetableGenerationRunData>;
  findById(id: string, schoolId: string): Promise<TimetableGenerationRunData | null>;
  findActive(schoolId: string, academicYearId: string): Promise<TimetableGenerationRunData | null>;
  appendResult(id: string, schoolId: string, result: unknown, status: TimetableGenerationRunStatus, progress: unknown): Promise<void>;
  markRunning(id: string, schoolId: string): Promise<void>;
  markFinished(id: string, schoolId: string, status: TimetableGenerationRunStatus, errorMessage?: string): Promise<void>;
  markCancelled(id: string, schoolId: string): Promise<void>;
  failStale(schoolId: string, olderThan: Date): Promise<number>;
}
