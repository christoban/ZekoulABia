/**
 * Mapping du tableau de répartition élèves par âge (Eleves_ESG_Fr, II.1.1, codes 2100-2118).
 * Tableau de recoupement statistique (le fichier officiel vérifie sa cohérence contre les
 * tableaux par niveau/filière — bloc "VERIFICATION DES DONNEES"). Colonnes par NIVEAU
 * uniquement (pas de distinction filière/LV2 ici) : D/E=6ème, F/G=5ème, H/I=4ème, J/K=3ème,
 * L/M=2nde, N/O=1ère, P/Q=Terminale. R/S/T ("Ensemble") sont des FORMULES — jamais écrites.
 *
 * Codes 2100-2113 : une ligne par âge (11 ans et moins → 24 ans et +).
 * Code 2114 : Total des effectifs (par niveau/sexe — lui aussi une formule, exclu).
 * Codes 2115-2118 : dont OEV / handicapés / réfugiés / déplacés internes — colonne D
 * uniquement dans le fichier (une seule case globale, pas de ventilation par niveau).
 */

export const AGE_LEVEL_COLUMNS: { niveau: string; fillesCol: string; garconsCol: string }[] = [
  { niveau: '6e', fillesCol: 'D', garconsCol: 'E' },
  { niveau: '5e', fillesCol: 'F', garconsCol: 'G' },
  { niveau: '4e', fillesCol: 'H', garconsCol: 'I' },
  { niveau: '3e', fillesCol: 'J', garconsCol: 'K' },
  { niveau: '2nde', fillesCol: 'L', garconsCol: 'M' },
  { niveau: '1ere', fillesCol: 'N', garconsCol: 'O' },
  { niveau: 'Tle', fillesCol: 'P', garconsCol: 'Q' },
];

// row = ligne de la feuille (1-indexed), ageMin/ageMax = bornes incluses (null = pas de borne)
export const AGE_ROWS: { fieldCode: string; row: number; ageMin: number | null; ageMax: number | null }[] = [
  { fieldCode: '2100', row: 17, ageMin: null, ageMax: 11 },
  { fieldCode: '2101', row: 18, ageMin: 12, ageMax: 12 },
  { fieldCode: '2102', row: 19, ageMin: 13, ageMax: 13 },
  { fieldCode: '2103', row: 20, ageMin: 14, ageMax: 14 },
  { fieldCode: '2104', row: 21, ageMin: 15, ageMax: 15 },
  { fieldCode: '2105', row: 22, ageMin: 16, ageMax: 16 },
  { fieldCode: '2106', row: 23, ageMin: 17, ageMax: 17 },
  { fieldCode: '2107', row: 24, ageMin: 18, ageMax: 18 },
  { fieldCode: '2108', row: 25, ageMin: 19, ageMax: 19 },
  { fieldCode: '2109', row: 26, ageMin: 20, ageMax: 20 },
  { fieldCode: '2110', row: 27, ageMin: 21, ageMax: 21 },
  { fieldCode: '2111', row: 28, ageMin: 22, ageMax: 22 },
  { fieldCode: '2112', row: 29, ageMin: 23, ageMax: 23 },
  { fieldCode: '2113', row: 30, ageMin: 24, ageMax: null },
];
