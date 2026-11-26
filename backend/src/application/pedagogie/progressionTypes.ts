/**
 * APPLICATION LAYER — Types DTO pour le calcul de progression des programmes
 * et les alertes de retard (extraits pour maintenir chaque fichier <= 500 lignes).
 */
import type { SourceRealisationLecon } from './BasculerAvancementChapitreUseCase';
import type { PedagogieActor } from './PedagogieAccessGuard';

export interface ProgressionChapitreDetail {
  id: string;
  ordre: number;
  titre: string;
  volumeHeuresPrevu: number | null;
  sequenceCibleFin: number | null;
  moduleOrdre: number | null;
  moduleTitre: string | null;
  positionDansModule: number | null;
  numeroAffiche: string | null;
  sourceUrl: string | null;
  moduleActif: boolean;
  /** Leçon retirée du référentiel national : visible, exclue du taux, jamais supprimée. */
  retireDuReferentiel: boolean;
  retireDuReferentielLe: Date | null;
  realise: boolean;
  cocheDirecte: boolean;
  nbSeancesCahier: number;
  sourceRealisation: SourceRealisationLecon;
  cocheLe: Date | null;
}

export interface ProgressionModuleDetail {
  moduleOrdre: number;
  moduleTitre: string;
  actif: boolean;
  leconsTotal: number;
  leconsRealisees: number;
  progressionPct: number | null;
  modifieLe: Date | null;
  modifieParId: string | null;
}

export interface ProgressionAvecProgramme {
  programme: {
    id: string;
    titre: string;
    source?: string;
    officialProgressionId?: string | null;
    filiere?: string | null;
  } | null;
  chapitresTotal: number;
  chapitresRealises: number;
  leconsTotal: number;
  leconsRealisees: number;
  modulesDesactivesCount: number;
  leconsRetireesCount: number;
  totalHeuresPrevu: number | null;
  heuresRealisees: number | null;
  hasHeuresPrevu: boolean;
  progressionPct: number | null;
  attenduPct: number | null;
  retardPct: number | null;
  modules: ProgressionModuleDetail[];
  chapitres: ProgressionChapitreDetail[];
  entries: { chapitreId: string | null; date: Date }[];
}

export interface CalculerProgressionInput {
  schoolId: string;
  classId: string;
  subjectId: string;
  academicYearId?: string;
  actor?: PedagogieActor;
}

export interface AlerteRetardProgramme {
  programmeId: string;
  programmeTitre: string;
  subjectId: string;
  subjectName: string;
  className: string;
  classId: string;
  chapitresTotal: number;
  chapitresRealises: number;
  modulesDesactivesCount: number;
  progressionPct: number;
  attenduPct: number;
  retardPct: number;
  niveau: 'CRITIQUE' | 'MODERE';
}

