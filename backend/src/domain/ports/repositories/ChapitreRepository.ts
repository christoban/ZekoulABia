/**
 * DOMAIN LAYER — Port Repository Chapitre (progression pédagogique)
 */
export interface ChapitreProps {
  id: string;
  programmeId: string;
  titre: string;
  ordre: number;
  volumeHeuresPrevu: number | null;
  sequenceCibleFin: number | null;
  officialProgressionId?: string | null;
  moduleOrdre?: number | null;
  moduleTitre?: string | null;
  positionDansModule?: number | null;
  numeroAffiche?: string | null;
  sourceUrl?: string | null;
  sourceKey?: string | null;
  createdAt: Date;
}

export type ChapitreCreateData = Omit<ChapitreProps, 'id' | 'createdAt'>;

export interface ChapitreUpdateData {
  id: string;
  titre?: string;
  ordre?: number;
  volumeHeuresPrevu?: number | null;
  sequenceCibleFin?: number | null;
}

export interface ChapitreRepository {
  findByIdAndSchool(id: string, schoolId: string): Promise<(ChapitreProps & { programme: { schoolId: string; subjectId?: string } }) | null>;
  findNextOrdre(programmeId: string): Promise<number>;
  create(data: ChapitreCreateData): Promise<ChapitreProps>;
  update(data: ChapitreUpdateData): Promise<ChapitreProps>;
  delete(id: string): Promise<void>;
}
