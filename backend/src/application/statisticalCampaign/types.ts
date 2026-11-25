/**
 * APPLICATION — Types partagés du module d'interopérabilité statistique MINESEC.
 *
 * Principe non négociable (voir doc de spec) : on écrit toujours dans une copie du vrai
 * fichier officiel téléchargé depuis minesec.gov.cm (1-DPPC-MINESEC-SECONDAIRE-2022.xls),
 * jamais dans un fac-similé recréé. Le mapping se fait par code de champ officiel
 * (ex. "2100", "3100"), jamais par position de cellule brute.
 */

export type MappingCategory = 'A_AUTO' | 'B_PARTIAL' | 'C_MANUAL';

export interface ChampNonResolu {
  fieldCode: string;
  sheetName: string;
  cellReference: string;
  fieldLabel: string;
  raison: string; // ex. "Diplôme académique non renseigné pour cet enseignant"
}

export interface VerifierCompletudeSupplementCommande {
  schoolId: string;
}

export interface ChampSupplementManquant {
  champ: string; // clé du champ dans SchoolStatisticalSupplement
  label: string;
}

export interface VerifierCompletudeSupplementResultat {
  complet: boolean;
  champsManquants: ChampSupplementManquant[];
  supplementExiste: boolean;
  derniereMiseAJour: Date | null;
}

export interface GenererDeclarationStatistiqueCommande {
  schoolId: string;
  generatedByUserId: string;
}

export interface GenererDeclarationStatistiqueResultat {
  status: 'PENDING_MANUAL_DATA' | 'DRAFT';
  submissionId: string;
  filePath: string | null;
  champsManquants: ChampSupplementManquant[]; // si PENDING_MANUAL_DATA
  champsNonResolus: ChampNonResolu[]; // gaps B_PARTIAL — jamais inventés, toujours signalés
}
