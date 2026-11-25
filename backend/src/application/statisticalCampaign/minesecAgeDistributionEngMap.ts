/**
 * Mapping du tableau de repartition eleves par age (Students_ESG_Eng, II.2.1, codes 2200-2213).
 * Miroir anglophone de minesecAgeDistributionMap.ts (codes 2100-2118).
 * Colonnes par niveau : D/E=Form1, F/G=Form2, H/I=Form3, J/K=Form4, L/M=Form5,
 * N/O=Lower Sixth, P/Q=Upper Sixth. R/S/T sont des FORMULES — jamais ecrites.
 */

export const AGE_ENG_LEVEL_COLUMNS: { niveau: string; fillesCol: string; garconsCol: string }[] = [
  { niveau: 'Form1', fillesCol: 'D', garconsCol: 'E' },
  { niveau: 'Form2', fillesCol: 'F', garconsCol: 'G' },
  { niveau: 'Form3', fillesCol: 'H', garconsCol: 'I' },
  { niveau: 'Form4', fillesCol: 'J', garconsCol: 'K' },
  { niveau: 'Form5', fillesCol: 'L', garconsCol: 'M' },
  { niveau: 'LowerSixth', fillesCol: 'N', garconsCol: 'O' },
  { niveau: 'UpperSixth', fillesCol: 'P', garconsCol: 'Q' },
];

export const AGE_ENG_ROWS: { fieldCode: string; row: number; ageMin: number | null; ageMax: number | null }[] = [
  { fieldCode: '2200', row: 17, ageMin: null, ageMax: 11 },
  { fieldCode: '2201', row: 18, ageMin: 12, ageMax: 12 },
  { fieldCode: '2202', row: 19, ageMin: 13, ageMax: 13 },
  { fieldCode: '2203', row: 20, ageMin: 14, ageMax: 14 },
  { fieldCode: '2204', row: 21, ageMin: 15, ageMax: 15 },
  { fieldCode: '2205', row: 22, ageMin: 16, ageMax: 16 },
  { fieldCode: '2206', row: 23, ageMin: 17, ageMax: 17 },
  { fieldCode: '2207', row: 24, ageMin: 18, ageMax: 18 },
  { fieldCode: '2208', row: 25, ageMin: 19, ageMax: 19 },
  { fieldCode: '2209', row: 26, ageMin: 20, ageMax: 20 },
  { fieldCode: '2210', row: 27, ageMin: 21, ageMax: 21 },
  { fieldCode: '2211', row: 28, ageMin: 22, ageMax: 22 },
  { fieldCode: '2212', row: 29, ageMin: 23, ageMax: 23 },
  { fieldCode: '2213', row: 30, ageMin: 24, ageMax: null },
];
