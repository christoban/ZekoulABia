/**
 * DOMAIN LAYER — Port Repository Chapitre (progression pédagogique)
 */
export interface ChapitreProps {
  id: string;
  programmeId: string;
  titre: string;
  ordre: number;
  volumeHeuresPrevu: number;
  sequenceCibleFin: number | null;
  createdAt: Date;
}

export type ChapitreCreateData = Omit<ChapitreProps, 'id' | 'createdAt'>;

export interface ChapitreUpdateData {
  id: string;
  titre?: string;
  ordre?: number;
  volumeHeuresPrevu?: number;
  sequenceCibleFin?: number | null;
}

export interface ChapitreRepository {
  findByIdAndSchool(id: string, schoolId: string): Promise<(ChapitreProps & { programme: { schoolId: string } }) | null>;
  findNextOrdre(programmeId: string): Promise<number>;
  create(data: ChapitreCreateData): Promise<ChapitreProps>;
  update(data: ChapitreUpdateData): Promise<ChapitreProps>;
  delete(id: string): Promise<void>;
}
