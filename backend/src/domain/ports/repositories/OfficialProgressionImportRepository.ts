/**
 * DOMAIN LAYER — Port Repository Import Progressions Officielles
 * Contrat de persistance et de résolution de référence pour l'import JSON
 * du référentiel national (OfficialProgrammeProgression).
 */

export interface OfficialProgressionChapterRecord {
  ordre: number;
  titre: string;
  volumeHeuresPrevu?: number | null;
  sequenceCibleFin?: number | null;
  moduleOrdre?: number | null;
  moduleTitre?: string | null;
  leconNumero?: number | string | null;
  numeroAffiche?: string | null;
  positionDansModule?: number | null;
  positionSource?: number | null;
  sourceUrl?: string | null;
}

export interface OfficialProgressionNaturalKey {
  templateCode: string;
  level: string;
  filiere: string;
  subjectName: string;
}

export interface OfficialProgressionSnapshot {
  id: string;
  templateCode: string;
  level: string;
  filiere: string;
  subjectName: string;
  titre: string;
  chapitres: unknown;
  source: string | null;
  manuallyEdited: boolean;
  importChecksum: string | null;
  active: boolean;
  updatedAt: Date;
}

export interface OfficialProgressionUpsertMutation {
  mode: 'CREATE' | 'UPDATE' | 'OVERWRITE_MANUAL';
  existingId?: string;
  templateCode: string;
  level: string;
  filiere: string;
  subjectName: string;
  titre: string;
  chapitres: OfficialProgressionChapterRecord[];
  source: string;
  importChecksum: string;
  active: boolean;
}

export interface OfficialProgressionImportRepository {
  /** Retourne la liste des codes SchoolTemplate existants (incluant "__ALL__" si seedé). */
  listExistingTemplateCodes(): Promise<string[]>;

  /**
   * Retourne les noms canoniques des matières officielles reconnues pour le périmètre donné.
   * Quand templateCode === "__ALL__", agrège les matières officielles de tous les templates
   * correspondant au couple (level, filiere).
   */
  listKnownSubjectsForScope(params: {
    templateCode: string;
    level: string;
    filiere: string;
  }): Promise<string[]>;

  /** Recherche les progressions déjà présentes pour un lot de clés naturelles. */
  findProgressionsByKeys(
    keys: OfficialProgressionNaturalKey[],
  ): Promise<OfficialProgressionSnapshot[]>;

  /**
   * Applique toutes les créations/mises à jour dans une transaction unique et atomique.
   * Tout échec sur une ligne doit annuler l'ensemble du lot.
   */
  applyImportTransaction(
    mutations: OfficialProgressionUpsertMutation[],
  ): Promise<OfficialProgressionSnapshot[]>;
}

