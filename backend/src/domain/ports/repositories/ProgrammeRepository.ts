/**
 * DOMAIN LAYER — Port Repository Programme (progression pédagogique)
 */
export interface ProgrammeChapitreProps {
  id: string;
  titre: string;
  ordre: number;
  volumeHeuresPrevu: number;
  sequenceCibleFin: number | null;
  createdAt: Date;
}

export interface ProgrammeProps {
  id: string;
  schoolId: string;
  subjectId: string;
  classId: string | null;
  level: string | null;
  academicYearId: string;
  titre: string;
  createdAt: Date;
  updatedAt: Date;
  subject?: { id: string; name: string };
  class?: { id: string; name: string } | null;
  chapitres?: ProgrammeChapitreProps[];
}

export type ProgrammeCreateData = Omit<ProgrammeProps, 'id' | 'createdAt' | 'updatedAt'>;

export interface ProgrammeUpdateData {
  id: string;
  titre?: string;
  classId?: string | null;
  level?: string | null;
  subjectId?: string;
  academicYearId?: string;
}

export interface ProgrammeFilters {
  academicYearId?: string;
  classId?: string;
  level?: string;
  subjectId?: string;
}

export interface ProgrammeRepository {
  findByFilters(schoolId: string, filters: ProgrammeFilters): Promise<ProgrammeProps[]>;
  findByIdAndSchool(id: string, schoolId: string): Promise<ProgrammeProps | null>;
  findByClassSubject(schoolId: string, subjectId: string, academicYearId: string, classId: string, level: string | null): Promise<ProgrammeProps | null>;
  findBySubject(schoolId: string, subjectId: string, academicYearId: string): Promise<ProgrammeProps | null>;
  save(data: ProgrammeCreateData): Promise<ProgrammeProps>;
  update(data: ProgrammeUpdateData): Promise<ProgrammeProps>;
  delete(id: string): Promise<void>;
}
