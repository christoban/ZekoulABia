/**
 * Mapping Atelier_Workshop — C_MANUAL ligne par ligne (V2.14 suite).
 *
 * Preuve dump (backend/scripts/dump-atelier-workshop-headers.ts, TEMPLATE_PATH=storage/.../1-DPPC-MINESEC-SECONDAIRE-2022.xls):
 * {
 *   "sheet": "Atelier_Workshop",
 *   "rows": [
 *     {"row":7,"cells":{"C7":"N°","D7":"Atelier","E7":"Etat de l'atelier","F7":"Désignation équipements lourds (Pour chaque équipement saisir une ligne différen","G7":"Quantités","H7":"Etat de l'équipement","I7":"Nombre de Postes de travail","J7":"Workshop","K7":"State of the workshop","L7":"Heavy equipment designation (for each equipment use a new line)","Q7":"Quantities","R7":"State of Equipment","S7":"Number of work post"}},
 *     {"row":8,"cells":{"C8":"1"}},
 *     {"row":9,"cells":{"C9":"2"}}
 *   ]
 * }
 * Dimensions: columns C(3)→S(19) pour la zone de saisie, W→AD pour le catalogue spécialités.
 * Première ligne de données = 8 (sous l'en-tête 7). Technique: 1 entrée supplement = 1 ligne Excel
 * (équipement[0] si présent, car le formulaire dit "pour chaque équipement saisir une ligne différente"
 * mais le JSON ateliersDetail groupe les équipements sous un même atelier — on écrit le premier).
 *
 * Contrat Prisma ateliersDetail: [{ atelier, etat, equipements: [{ designation, quantite, etat }], nombrePostesTravail }]
 */

export const ATELIER_SHEET = 'Atelier_Workshop' as const;

/** Première ligne de données (sous l'en-tête R7). */
export const ATELIER_FIRST_DATA_ROW = 8;

/** Capacité max lignes utiles du formulaire (au-delà → champsNonResolus). */
export const ATELIER_MAX_ROWS = 50;

export const ATELIER_COLS = {
  numero: 'C', // N°
  atelier: 'D', // Atelier / nom
  etatAtelier: 'E', // Etat de l'atelier (FR)
  designationEquipement: 'F', // Désignation équipements lourds FR
  quantite: 'G', // Quantités FR
  etatEquipement: 'H', // Etat de l'équipement FR
  nombrePostes: 'I', // Nombre de Postes de travail FR
  workshop: 'J', // Workshop (EN miroir de D)
  stateEn: 'K', // State of the workshop (EN miroir de E)
  designationEn: 'L', // Heavy equipment designation EN
  quantiteEn: 'Q', // Quantities EN
  etatEquipementEn: 'R', // State of Equipment EN
  nombrePostesEn: 'S', // Number of work post EN
} as const;

export type AtelierDetailEntry = {
  atelier?: string;
  etat?: string;
  nombrePostesTravail?: number;
  equipements?: Array<{ designation?: string; quantite?: number; etat?: string }>;
};

export function isAtelierMappingReady(): boolean {
  return Boolean(ATELIER_COLS.atelier && ATELIER_FIRST_DATA_ROW >= 2);
}

// Déprécié — gardé pour compatibilité import existant (vide depuis V2.14 suite)
export const ATELIER_GRID_BLOCKS: readonly unknown[] = [];
