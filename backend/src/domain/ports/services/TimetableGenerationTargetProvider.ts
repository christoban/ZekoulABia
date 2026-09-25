export interface TargetClass {
  classId: string;
  className: string;
  timetableId?: string;
  status?: string;
  requiredHours: number;
  difficultyScore?: number;
}

export interface TimetableGenerationTargetProvider {
  listTargets(schoolId: string, academicYearId: string, classIds?: string[]): Promise<TargetClass[]>;
  buildPreflight(schoolId: string, academicYearId: string, targets: TargetClass[]): Promise<Record<string, unknown>>;
}
