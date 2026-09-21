/**
 * DOMAIN LAYER — Port Repository Rapports Scolarité
 *
 * Fournit les requêtes d'agrégation nécessaires aux rapports du secrétariat et de l'administration :
 * effectifs par classe/cycle/genre, dossiers incomplets et statistiques des concours d'entrée.
 */

export interface EffectifClasseRow {
  classId: string;
  className: string;
  level: string | null;
  serie: string | null;
  filiere: string | null;
  capacity: number;
  totalInscrits: number;
  garcons: number;
  filles: number;
}

export interface DossierIncompletRow {
  id: string;
  nomProvisoire: string;
  className: string | null;
  contactTelephone: string | null;
  completenessScore: number | null;
  validableSousReserve: boolean;
  status: string;
  createdAt: Date;
  piecesManquantes: string[];
}

export interface StatConcoursRow {
  sessionId: string;
  sessionName: string;
  examDate: Date;
  capacity: number;
  totalCandidats: number;
  admis: number;
  listeAttente: number;
  refuses: number;
  tauxReussitePercent: number;
  moyenneGenerale: number;
}

export interface RapportsScolariteRepository {
  getEffectifsParClasse(schoolId: string, academicYearId?: string): Promise<EffectifClasseRow[]>;
  getDossiersIncomplets(schoolId: string): Promise<DossierIncompletRow[]>;
  getStatistiquesConcours(schoolId: string): Promise<StatConcoursRow[]>;
}
