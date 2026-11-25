import type { OfficialProgressionChapterRecord } from '@domain/ports/repositories/OfficialProgressionImportRepository';

export interface ChapitreImportEntree {
  ordre?: number;
  titre: string;
  volumeHeuresPrevu?: number | null;
  sequenceCibleFin?: number | null;
  moduleOrdre?: number | null;
  moduleTitre?: string | null;
  titreModuleParasite?: boolean;
  leconNumero?: number | string | null;
  numeroAffiche?: string | null;
  positionDansModule?: number | null;
  positionSource?: number | null;
  sourceUrl?: string | null;
  exclure?: boolean;
}

export interface ProgressionImportItemEntree {
  templateCode: string;
  level: string;
  filiere: string;
  subjectName: string;
  subjectNameSource?: string | null;
  titre: string;
  source?: string | null;
  active?: boolean;
  chapitres: ChapitreImportEntree[];
}

export interface ProposerImportProgressionsCommande {
  source: string;
  level?: string;
  items: ProgressionImportItemEntree[];
}

export interface AppliquerImportProgressionsCommande extends ProposerImportProgressionsCommande {
  confirmOverwriteManualIds?: string[];
  skipManuallyEdited?: boolean;
}

export interface DiagnosticLeconSansNumero {
  cleProgression: string;
  subjectName: string;
  moduleOrdre: number | null;
  moduleTitre: string | null;
  positionDansModule: number;
  positionSource: number;
  titre: string;
  numeroAffiche: string | null;
}

export interface DiagnosticNumeroDuplique {
  cleProgression: string;
  subjectName: string;
  leconNumero: string;
  portee: 'MEME_MODULE' | 'INTER_MODULES' | 'MIXTE';
  occurrences: Array<{
    moduleOrdre: number | null;
    moduleTitre: string | null;
    positionDansModule: number;
    positionSource: number;
    titre: string;
    numeroAffiche: string | null;
  }>;
}

export interface DiagnosticModuleParasite {
  cleProgression: string;
  subjectName: string;
  moduleOrdre: number | null;
  moduleTitre: string | null;
  nbLecons: number;
}

export interface DiagnosticElementExclu {
  cleProgression: string;
  subjectName: string;
  moduleOrdre: number | null;
  moduleTitre: string | null;
  positionDansModule: number;
  positionSource: number;
  titre: string;
  leconNumero: number | string | null;
  numeroAffiche: string | null;
}

export interface ImportProgressionsDiagnostics {
  leconsSansNumero: DiagnosticLeconSansNumero[];
  numerosDupliques: DiagnosticNumeroDuplique[];
  modulesParasites: DiagnosticModuleParasite[];
  elementsExclus: DiagnosticElementExclu[];
}

export type CodeRejetImportProgression =
  | 'EMPTY_BATCH'
  | 'MULTI_LEVEL_BATCH'
  | 'LEVEL_MISMATCH'
  | 'UNKNOWN_TEMPLATE'
  | 'SUBJECT_NOT_FOUND'
  | 'DUPLICATE_PROGRESSION_IN_BATCH'
  | 'DUPLICATE_CHAPTER_NATURAL_KEY'
  | 'NO_ACTIVE_CHAPTERS';

export const SOURCE_IMPORT_OFFICIEL = 'minesec-distance-learning' as const;

export interface RejetImportProgression {
  index: number;
  templateCode: string;
  level: string;
  filiere: string;
  subjectName: string;
  subjectNameSource: string | null;
  code: CodeRejetImportProgression;
  message: string;
  /** Liste des matières connues pour ce (templateCode, level, filiere) en cas de SUBJECT_NOT_FOUND. */
  matieresConnues?: string[];
}

export type TypeActionImport = 'CREATE' | 'UPDATE' | 'UNCHANGED' | 'CONFLICT_MANUAL';

export interface ActionPlanifieeImport {
  index: number;
  action: TypeActionImport;
  cleProgression: string;
  existingId: string | null;
  existingUpdatedAt: Date | null;
  templateCode: string;
  level: string;
  filiere: string;
  subjectName: string;
  subjectNameSource: string | null;
  titre: string;
  source: string;
  active: boolean;
  manuallyEdited: boolean;
  nbChapitresRetenus: number;
  nbChapitresExclus: number;
  importChecksum: string;
  chapitres: OfficialProgressionChapterRecord[];
}

export interface ResumePropositionImport {
  totalItems: number;
  valides: number;
  aCreer: number;
  aMettreAJour: number;
  inchanges: number;
  conflitsManuels: number;
  rejetes: number;
  leconsRetenues: number;
  leconsExclues: number;
}

export interface ResultatPropositionImport {
  dryRun: true;
  level: string | null;
  source: string;
  peutAppliquer: boolean;
  resume: ResumePropositionImport;
  actions: ActionPlanifieeImport[];
  conflitsManuels: ActionPlanifieeImport[];
  rejets: RejetImportProgression[];
  diagnostics: ImportProgressionsDiagnostics;
}

export interface ResultatApplicationImport {
  applied: true;
  level: string;
  source: string;
  createdCount: number;
  updatedCount: number;
  overwrittenManualCount: number;
  unchangedCount: number;
  skippedManualCount: number;
  totalAffected: number;
  items: Array<{
    id: string;
    mode: 'CREATE' | 'UPDATE' | 'OVERWRITE_MANUAL';
    templateCode: string;
    level: string;
    filiere: string;
    subjectName: string;
    titre: string;
    nbChapitres: number;
    importChecksum: string;
  }>;
  diagnostics: ImportProgressionsDiagnostics;
}

export class ImportProgressionsValidationError extends Error {
  constructor(
    message: string,
    public readonly rejets: RejetImportProgression[],
  ) {
    super(message);
    this.name = 'ImportProgressionsValidationError';
  }
}

export type CodeConflitImportProgression = 'MANUAL_EDIT_CONFLICT';

export class ImportProgressionsConflictError extends Error {
  constructor(
    public readonly code: CodeConflitImportProgression,
    message: string,
    public readonly conflitsManuels: ActionPlanifieeImport[] = [],
  ) {
    super(message);
    this.name = 'ImportProgressionsConflictError';
  }
}

