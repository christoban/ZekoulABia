/**
 * Mapping des champs eleves ESG Anglais, feuille Students_ESG_Eng.
 * Genere a partir d une extraction automatisee et auto-verifiee du fichier officiel
 * 1-DPPC-MINESEC-SECONDAIRE-2022.xls (formules Excel utilisees comme controle croise).
 *
 * Codes 2200-2232. Miroir anglophone de minesecEsgFieldMap.ts (codes 2100-2148).
 * Pas de track LV2/LV2_AUTRES/NON_COUVERT/SERIE_RESIDUELLE dans le systeme anglais :
 * seuls GENERAL, BILINGUE et SERIE existent.
 */

export type EsgEngTrack = 'GENERAL' | 'BILINGUE' | 'SERIE';

export interface EsgEngLevelMeta {
  niveau: string;
  serie?: string;
  track: EsgEngTrack;
}

export interface EsgEngFieldEntry {
  fieldCode: string;
  kind: 'DIVISIONS' | 'TOTAL_ELEVES' | 'REDOUBLANTS';
  levelLabel: string;
  cell?: string;
  totalCell?: string | null;
  fillesCell?: string;
  garconsCell?: string;
  meta: EsgEngLevelMeta;
}

export const ESG_ENG_FIELD_MAPPING: EsgEngFieldEntry[] = [
  // ── II.2.2.a First Cycle ──
  // Form1
  { fieldCode: '2220', kind: 'TOTAL_ELEVES', levelLabel: 'Form 1', fillesCell: 'D43', garconsCell: 'E43', meta: { niveau: 'Form1', track: 'GENERAL' }, totalCell: 'F43' },
  { fieldCode: '2221', kind: 'REDOUBLANTS', levelLabel: 'Form 1', fillesCell: 'D44', garconsCell: 'E44', meta: { niveau: 'Form1', track: 'GENERAL' }, totalCell: 'F44' },
  { fieldCode: '2219', kind: 'DIVISIONS', levelLabel: 'Form 1', cell: 'D41', meta: { niveau: 'Form1', track: 'GENERAL' } },
  // Bilingual Form1
  { fieldCode: '2220', kind: 'TOTAL_ELEVES', levelLabel: 'Bilingual Form 1', fillesCell: 'G43', garconsCell: 'H43', meta: { niveau: 'Form1', track: 'BILINGUE' }, totalCell: 'I43' },
  { fieldCode: '2221', kind: 'REDOUBLANTS', levelLabel: 'Bilingual Form 1', fillesCell: 'G44', garconsCell: 'H44', meta: { niveau: 'Form1', track: 'BILINGUE' }, totalCell: 'I44' },
  { fieldCode: '2219', kind: 'DIVISIONS', levelLabel: 'Bilingual Form 1', cell: 'G41', meta: { niveau: 'Form1', track: 'BILINGUE' } },
  // Form2
  { fieldCode: '2220', kind: 'TOTAL_ELEVES', levelLabel: 'Form 2', fillesCell: 'J43', garconsCell: 'K43', meta: { niveau: 'Form2', track: 'GENERAL' }, totalCell: 'L43' },
  { fieldCode: '2221', kind: 'REDOUBLANTS', levelLabel: 'Form 2', fillesCell: 'J44', garconsCell: 'K44', meta: { niveau: 'Form2', track: 'GENERAL' }, totalCell: 'L44' },
  { fieldCode: '2219', kind: 'DIVISIONS', levelLabel: 'Form 2', cell: 'J41', meta: { niveau: 'Form2', track: 'GENERAL' } },
  // Bilingual Form2
  { fieldCode: '2220', kind: 'TOTAL_ELEVES', levelLabel: 'Bilingual Form 2', fillesCell: 'M43', garconsCell: 'N43', meta: { niveau: 'Form2', track: 'BILINGUE' }, totalCell: 'O43' },
  { fieldCode: '2221', kind: 'REDOUBLANTS', levelLabel: 'Bilingual Form 2', fillesCell: 'M44', garconsCell: 'N44', meta: { niveau: 'Form2', track: 'BILINGUE' }, totalCell: 'O44' },
  { fieldCode: '2219', kind: 'DIVISIONS', levelLabel: 'Bilingual Form 2', cell: 'M41', meta: { niveau: 'Form2', track: 'BILINGUE' } },
  // Form3
  { fieldCode: '2220', kind: 'TOTAL_ELEVES', levelLabel: 'Form 3', fillesCell: 'P43', garconsCell: 'Q43', meta: { niveau: 'Form3', track: 'GENERAL' }, totalCell: 'R43' },
  { fieldCode: '2221', kind: 'REDOUBLANTS', levelLabel: 'Form 3', fillesCell: 'P44', garconsCell: 'Q44', meta: { niveau: 'Form3', track: 'GENERAL' }, totalCell: 'R44' },
  { fieldCode: '2219', kind: 'DIVISIONS', levelLabel: 'Form 3', cell: 'P41', meta: { niveau: 'Form3', track: 'GENERAL' } },
  // Bilingual Form3
  { fieldCode: '2220', kind: 'TOTAL_ELEVES', levelLabel: 'Bilingual Form 3', fillesCell: 'S43', garconsCell: 'T43', meta: { niveau: 'Form3', track: 'BILINGUE' }, totalCell: 'U43' },
  { fieldCode: '2221', kind: 'REDOUBLANTS', levelLabel: 'Bilingual Form 3', fillesCell: 'S44', garconsCell: 'T44', meta: { niveau: 'Form3', track: 'BILINGUE' }, totalCell: 'U44' },
  { fieldCode: '2219', kind: 'DIVISIONS', levelLabel: 'Bilingual Form 3', cell: 'S41', meta: { niveau: 'Form3', track: 'BILINGUE' } },
  // Form4
  { fieldCode: '2222', kind: 'TOTAL_ELEVES', levelLabel: 'Form 4', fillesCell: 'D50', garconsCell: 'E50', meta: { niveau: 'Form4', track: 'GENERAL' }, totalCell: 'F50' },
  { fieldCode: '2223', kind: 'REDOUBLANTS', levelLabel: 'Form 4', fillesCell: 'D51', garconsCell: 'E51', meta: { niveau: 'Form4', track: 'GENERAL' }, totalCell: 'F51' },
  { fieldCode: '2221', kind: 'DIVISIONS', levelLabel: 'Form 4', cell: 'D48', meta: { niveau: 'Form4', track: 'GENERAL' } },
  // Bilingual Form4
  { fieldCode: '2222', kind: 'TOTAL_ELEVES', levelLabel: 'Bilingual Form 4', fillesCell: 'G50', garconsCell: 'H50', meta: { niveau: 'Form4', track: 'BILINGUE' }, totalCell: 'I50' },
  { fieldCode: '2223', kind: 'REDOUBLANTS', levelLabel: 'Bilingual Form 4', fillesCell: 'G51', garconsCell: 'H51', meta: { niveau: 'Form4', track: 'BILINGUE' }, totalCell: 'I51' },
  { fieldCode: '2221', kind: 'DIVISIONS', levelLabel: 'Bilingual Form 4', cell: 'G48', meta: { niveau: 'Form4', track: 'BILINGUE' } },
  // Form5
  { fieldCode: '2222', kind: 'TOTAL_ELEVES', levelLabel: 'Form 5', fillesCell: 'J50', garconsCell: 'K50', meta: { niveau: 'Form5', track: 'GENERAL' }, totalCell: 'L50' },
  { fieldCode: '2223', kind: 'REDOUBLANTS', levelLabel: 'Form 5', fillesCell: 'J51', garconsCell: 'K51', meta: { niveau: 'Form5', track: 'GENERAL' }, totalCell: 'L51' },
  { fieldCode: '2221', kind: 'DIVISIONS', levelLabel: 'Form 5', cell: 'J48', meta: { niveau: 'Form5', track: 'GENERAL' } },
  // Bilingual Form5
  { fieldCode: '2222', kind: 'TOTAL_ELEVES', levelLabel: 'Bilingual Form 5', fillesCell: 'M50', garconsCell: 'N50', meta: { niveau: 'Form5', track: 'BILINGUE' }, totalCell: 'O50' },
  { fieldCode: '2223', kind: 'REDOUBLANTS', levelLabel: 'Bilingual Form 5', fillesCell: 'M51', garconsCell: 'N51', meta: { niveau: 'Form5', track: 'BILINGUE' }, totalCell: 'O51' },
  { fieldCode: '2221', kind: 'DIVISIONS', levelLabel: 'Bilingual Form 5', cell: 'M48', meta: { niveau: 'Form5', track: 'BILINGUE' } },

  // ── II.2.2.c Second Cycle ──
  // Lower sixth Arts
  { fieldCode: '2228', kind: 'TOTAL_ELEVES', levelLabel: 'Lower sixth Arts', fillesCell: 'D67', garconsCell: 'E67', meta: { niveau: 'LowerSixth', track: 'SERIE', serie: 'Arts' }, totalCell: 'F67' },
  { fieldCode: '2229', kind: 'REDOUBLANTS', levelLabel: 'Lower sixth Arts', fillesCell: 'D68', garconsCell: 'E68', meta: { niveau: 'LowerSixth', track: 'SERIE', serie: 'Arts' }, totalCell: 'F68' },
  { fieldCode: '2227', kind: 'DIVISIONS', levelLabel: 'Lower sixth Arts', cell: 'D65', meta: { niveau: 'LowerSixth', track: 'SERIE', serie: 'Arts' } },
  // Lower Sixth Arts Bilingual
  { fieldCode: '2228', kind: 'TOTAL_ELEVES', levelLabel: 'Lower Sixth Arts Bilingual', fillesCell: 'G67', garconsCell: 'H67', meta: { niveau: 'LowerSixth', track: 'BILINGUE' }, totalCell: 'I67' },
  { fieldCode: '2229', kind: 'REDOUBLANTS', levelLabel: 'Lower Sixth Arts Bilingual', fillesCell: 'G68', garconsCell: 'H68', meta: { niveau: 'LowerSixth', track: 'BILINGUE' }, totalCell: 'I68' },
  { fieldCode: '2227', kind: 'DIVISIONS', levelLabel: 'Lower Sixth Arts Bilingual', cell: 'G65', meta: { niveau: 'LowerSixth', track: 'BILINGUE' } },
  // Lower sixth Sciences
  { fieldCode: '2228', kind: 'TOTAL_ELEVES', levelLabel: 'Lower sixth Sciences', fillesCell: 'J67', garconsCell: 'K67', meta: { niveau: 'LowerSixth', track: 'SERIE', serie: 'Sciences' }, totalCell: 'L67' },
  { fieldCode: '2229', kind: 'REDOUBLANTS', levelLabel: 'Lower sixth Sciences', fillesCell: 'J68', garconsCell: 'K68', meta: { niveau: 'LowerSixth', track: 'SERIE', serie: 'Sciences' }, totalCell: 'L68' },
  { fieldCode: '2227', kind: 'DIVISIONS', levelLabel: 'Lower sixth Sciences', cell: 'J65', meta: { niveau: 'LowerSixth', track: 'SERIE', serie: 'Sciences' } },
  // Upper sixth Arts
  { fieldCode: '2228', kind: 'TOTAL_ELEVES', levelLabel: 'Upper sixth Arts', fillesCell: 'M67', garconsCell: 'N67', meta: { niveau: 'UpperSixth', track: 'SERIE', serie: 'Arts' }, totalCell: 'O67' },
  { fieldCode: '2229', kind: 'REDOUBLANTS', levelLabel: 'Upper sixth Arts', fillesCell: 'M68', garconsCell: 'N68', meta: { niveau: 'UpperSixth', track: 'SERIE', serie: 'Arts' }, totalCell: 'O68' },
  { fieldCode: '2227', kind: 'DIVISIONS', levelLabel: 'Upper sixth Arts', cell: 'M65', meta: { niveau: 'UpperSixth', track: 'SERIE', serie: 'Arts' } },
  // Upper Sixth Arts Bilingual
  { fieldCode: '2228', kind: 'TOTAL_ELEVES', levelLabel: 'Upper Sixth Arts Bilingual', fillesCell: 'P67', garconsCell: 'Q67', meta: { niveau: 'UpperSixth', track: 'BILINGUE' }, totalCell: 'R67' },
  { fieldCode: '2229', kind: 'REDOUBLANTS', levelLabel: 'Upper Sixth Arts Bilingual', fillesCell: 'P68', garconsCell: 'Q68', meta: { niveau: 'UpperSixth', track: 'BILINGUE' }, totalCell: 'R68' },
  { fieldCode: '2227', kind: 'DIVISIONS', levelLabel: 'Upper Sixth Arts Bilingual', cell: 'P65', meta: { niveau: 'UpperSixth', track: 'BILINGUE' } },
  // Upper sixth Sciences
  { fieldCode: '2228', kind: 'TOTAL_ELEVES', levelLabel: 'Upper sixth Sciences', fillesCell: 'S67', garconsCell: 'T67', meta: { niveau: 'UpperSixth', track: 'SERIE', serie: 'Sciences' }, totalCell: 'U67' },
  { fieldCode: '2229', kind: 'REDOUBLANTS', levelLabel: 'Upper sixth Sciences', fillesCell: 'S68', garconsCell: 'T68', meta: { niveau: 'UpperSixth', track: 'SERIE', serie: 'Sciences' }, totalCell: 'U68' },
  { fieldCode: '2227', kind: 'DIVISIONS', levelLabel: 'Upper sixth Sciences', cell: 'S65', meta: { niveau: 'UpperSixth', track: 'SERIE', serie: 'Sciences' } },
];
