/**
 * Mapping des champs eleves ESG francophone — 1er cycle (6eme, 5eme, 4eme, 3eme).
 */
import type { EsgFieldEntry } from './minesecEsgSharedFieldMap';

export const ESG_1ER_CYCLE_FIELDS: EsgFieldEntry[] = [
  {
    fieldCode: '2120', kind: 'TOTAL_ELEVES', levelLabel: "6ème",
    fillesCell: 'D43', garconsCell: 'E43', totalCell: 'F43',
    meta: { niveau: '6e', track: 'GENERAL' },
  },
  {
    fieldCode: '2121', kind: 'REDOUBLANTS', levelLabel: "6ème",
    fillesCell: 'D44', garconsCell: 'E44', totalCell: 'F44',
    meta: { niveau: '6e', track: 'GENERAL' },
  },
  {
    fieldCode: '2120', kind: 'TOTAL_ELEVES', levelLabel: "6ème Bilingue",
    fillesCell: 'G43', garconsCell: 'H43', totalCell: 'I43',
    meta: { niveau: '6e', track: 'BILINGUE' },
  },
  {
    fieldCode: '2121', kind: 'REDOUBLANTS', levelLabel: "6ème Bilingue",
    fillesCell: 'G44', garconsCell: 'H44', totalCell: 'I44',
    meta: { niveau: '6e', track: 'BILINGUE' },
  },
  {
    fieldCode: '2120', kind: 'TOTAL_ELEVES', levelLabel: "5ème",
    fillesCell: 'J43', garconsCell: 'K43', totalCell: 'L43',
    meta: { niveau: '5e', track: 'GENERAL' },
  },
  {
    fieldCode: '2121', kind: 'REDOUBLANTS', levelLabel: "5ème",
    fillesCell: 'J44', garconsCell: 'K44', totalCell: 'L44',
    meta: { niveau: '5e', track: 'GENERAL' },
  },
  {
    fieldCode: '2120', kind: 'TOTAL_ELEVES', levelLabel: "5ème Bilingue",
    fillesCell: 'M43', garconsCell: 'N43', totalCell: 'O43',
    meta: { niveau: '5e', track: 'BILINGUE' },
  },
  {
    fieldCode: '2121', kind: 'REDOUBLANTS', levelLabel: "5ème Bilingue",
    fillesCell: 'M44', garconsCell: 'N44', totalCell: 'O44',
    meta: { niveau: '5e', track: 'BILINGUE' },
  },
  {
    fieldCode: '2120', kind: 'TOTAL_ELEVES', levelLabel: "4ème Esp",
    fillesCell: 'P43', garconsCell: 'Q43', totalCell: 'R43',
    meta: { niveau: '4e', track: 'LV2', lv2: 'ESP' },
  },
  {
    fieldCode: '2121', kind: 'REDOUBLANTS', levelLabel: "4ème Esp",
    fillesCell: 'P44', garconsCell: 'Q44', totalCell: 'R44',
    meta: { niveau: '4e', track: 'LV2', lv2: 'ESP' },
  },
  {
    fieldCode: '2120', kind: 'TOTAL_ELEVES', levelLabel: "4ème All",
    fillesCell: 'S43', garconsCell: 'T43', totalCell: 'U43',
    meta: { niveau: '4e', track: 'LV2', lv2: 'ALL' },
  },
  {
    fieldCode: '2121', kind: 'REDOUBLANTS', levelLabel: "4ème All",
    fillesCell: 'S44', garconsCell: 'T44', totalCell: 'U44',
    meta: { niveau: '4e', track: 'LV2', lv2: 'ALL' },
  },
  {
    fieldCode: '2119', kind: 'DIVISIONS', levelLabel: "6ème",
    cell: 'D41',
    meta: { niveau: '6e', track: 'GENERAL' },
  },
  {
    fieldCode: '2119', kind: 'DIVISIONS', levelLabel: "6ème Bilingue",
    cell: 'G41',
    meta: { niveau: '6e', track: 'BILINGUE' },
  },
  {
    fieldCode: '2119', kind: 'DIVISIONS', levelLabel: "5ème",
    cell: 'J41',
    meta: { niveau: '5e', track: 'GENERAL' },
  },
  {
    fieldCode: '2119', kind: 'DIVISIONS', levelLabel: "5ème Bilingue",
    cell: 'M41',
    meta: { niveau: '5e', track: 'BILINGUE' },
  },
  {
    fieldCode: '2119', kind: 'DIVISIONS', levelLabel: "4ème Esp",
    cell: 'P41',
    meta: { niveau: '4e', track: 'LV2', lv2: 'ESP' },
  },
  {
    fieldCode: '2119', kind: 'DIVISIONS', levelLabel: "4ème All",
    cell: 'S41',
    meta: { niveau: '4e', track: 'LV2', lv2: 'ALL' },
  },
  {
    fieldCode: '2123', kind: 'TOTAL_ELEVES', levelLabel: "4ème Bilingue",
    fillesCell: 'D49', garconsCell: 'E49', totalCell: 'F49',
    meta: { niveau: '4e', track: 'BILINGUE' },
  },
  {
    fieldCode: '2124', kind: 'REDOUBLANTS', levelLabel: "4ème Bilingue",
    fillesCell: 'D50', garconsCell: 'E50', totalCell: 'F50',
    meta: { niveau: '4e', track: 'BILINGUE' },
  },
  {
    fieldCode: '2123', kind: 'TOTAL_ELEVES', levelLabel: "4ème Ang Renforcé",
    fillesCell: 'G49', garconsCell: 'H49', totalCell: 'I49',
    meta: { niveau: '4e', track: 'NON_COUVERT' },
  },
  {
    fieldCode: '2124', kind: 'REDOUBLANTS', levelLabel: "4ème Ang Renforcé",
    fillesCell: 'G50', garconsCell: 'H50', totalCell: 'I50',
    meta: { niveau: '4e', track: 'NON_COUVERT' },
  },
  {
    fieldCode: '2123', kind: 'TOTAL_ELEVES', levelLabel: "4ème Arabe",
    fillesCell: 'J49', garconsCell: 'K49', totalCell: 'L49',
    meta: { niveau: '4e', track: 'LV2', lv2: 'ARABE' },
  },
  {
    fieldCode: '2124', kind: 'REDOUBLANTS', levelLabel: "4ème Arabe",
    fillesCell: 'J50', garconsCell: 'K50', totalCell: 'L50',
    meta: { niveau: '4e', track: 'LV2', lv2: 'ARABE' },
  },
  {
    fieldCode: '2123', kind: 'TOTAL_ELEVES', levelLabel: "4ème Chinois",
    fillesCell: 'M49', garconsCell: 'N49', totalCell: 'O49',
    meta: { niveau: '4e', track: 'LV2', lv2: 'CHINOIS' },
  },
  {
    fieldCode: '2124', kind: 'REDOUBLANTS', levelLabel: "4ème Chinois",
    fillesCell: 'M50', garconsCell: 'N50', totalCell: 'O50',
    meta: { niveau: '4e', track: 'LV2', lv2: 'CHINOIS' },
  },
  {
    fieldCode: '2123', kind: 'TOTAL_ELEVES', levelLabel: "4ème Italien",
    fillesCell: 'P49', garconsCell: 'Q49', totalCell: 'R49',
    meta: { niveau: '4e', track: 'LV2', lv2: 'ITALIEN' },
  },
  {
    fieldCode: '2124', kind: 'REDOUBLANTS', levelLabel: "4ème Italien",
    fillesCell: 'P50', garconsCell: 'Q50', totalCell: 'R50',
    meta: { niveau: '4e', track: 'LV2', lv2: 'ITALIEN' },
  },
  {
    fieldCode: '2123', kind: 'TOTAL_ELEVES', levelLabel: "4ème Autres",
    fillesCell: 'S49', garconsCell: 'T49', totalCell: 'U49',
    meta: { niveau: '4e', track: 'LV2_AUTRES' },
  },
  {
    fieldCode: '2124', kind: 'REDOUBLANTS', levelLabel: "4ème Autres",
    fillesCell: 'S50', garconsCell: 'T50', totalCell: 'U50',
    meta: { niveau: '4e', track: 'LV2_AUTRES' },
  },
  {
    fieldCode: '2122', kind: 'DIVISIONS', levelLabel: "4ème Bilingue",
    cell: 'D47',
    meta: { niveau: '4e', track: 'BILINGUE' },
  },
  {
    fieldCode: '2122', kind: 'DIVISIONS', levelLabel: "4ème Ang Renforcé",
    cell: 'G47',
    meta: { niveau: '4e', track: 'NON_COUVERT' },
  },
  {
    fieldCode: '2122', kind: 'DIVISIONS', levelLabel: "4ème Arabe",
    cell: 'J47',
    meta: { niveau: '4e', track: 'LV2', lv2: 'ARABE' },
  },
  {
    fieldCode: '2122', kind: 'DIVISIONS', levelLabel: "4ème Chinois",
    cell: 'M47',
    meta: { niveau: '4e', track: 'LV2', lv2: 'CHINOIS' },
  },
  {
    fieldCode: '2122', kind: 'DIVISIONS', levelLabel: "4ème Italien",
    cell: 'P47',
    meta: { niveau: '4e', track: 'LV2', lv2: 'ITALIEN' },
  },
  {
    fieldCode: '2122', kind: 'DIVISIONS', levelLabel: "4ème Autres",
    cell: 'S47',
    meta: { niveau: '4e', track: 'LV2_AUTRES' },
  },
  {
    fieldCode: '2126', kind: 'TOTAL_ELEVES', levelLabel: "3ème Esp",
    fillesCell: 'D55', garconsCell: 'E55', totalCell: 'F55',
    meta: { niveau: '3e', track: 'LV2', lv2: 'ESP' },
  },
  {
    fieldCode: '2127', kind: 'REDOUBLANTS', levelLabel: "3ème Esp",
    fillesCell: 'D56', garconsCell: 'E56', totalCell: 'F56',
    meta: { niveau: '3e', track: 'LV2', lv2: 'ESP' },
  },
  {
    fieldCode: '2126', kind: 'TOTAL_ELEVES', levelLabel: "3ème All",
    fillesCell: 'G55', garconsCell: 'H55', totalCell: 'I55',
    meta: { niveau: '3e', track: 'LV2', lv2: 'ALL' },
  },
  {
    fieldCode: '2127', kind: 'REDOUBLANTS', levelLabel: "3ème All",
    fillesCell: 'G56', garconsCell: 'H56', totalCell: 'I56',
    meta: { niveau: '3e', track: 'LV2', lv2: 'ALL' },
  },
  {
    fieldCode: '2126', kind: 'TOTAL_ELEVES', levelLabel: "3ème Bilingue",
    fillesCell: 'J55', garconsCell: 'K55', totalCell: 'L55',
    meta: { niveau: '3e', track: 'BILINGUE' },
  },
  {
    fieldCode: '2127', kind: 'REDOUBLANTS', levelLabel: "3ème Bilingue",
    fillesCell: 'J56', garconsCell: 'K56', totalCell: 'L56',
    meta: { niveau: '3e', track: 'BILINGUE' },
  },
  {
    fieldCode: '2126', kind: 'TOTAL_ELEVES', levelLabel: "3ème Ang Renforcé",
    fillesCell: 'M55', garconsCell: 'N55', totalCell: 'O55',
    meta: { niveau: '3e', track: 'NON_COUVERT' },
  },
  {
    fieldCode: '2127', kind: 'REDOUBLANTS', levelLabel: "3ème Ang Renforcé",
    fillesCell: 'M56', garconsCell: 'N56', totalCell: 'O56',
    meta: { niveau: '3e', track: 'NON_COUVERT' },
  },
  {
    fieldCode: '2126', kind: 'TOTAL_ELEVES', levelLabel: "3ème Arabe",
    fillesCell: 'P55', garconsCell: 'Q55', totalCell: 'R55',
    meta: { niveau: '3e', track: 'LV2', lv2: 'ARABE' },
  },
  {
    fieldCode: '2127', kind: 'REDOUBLANTS', levelLabel: "3ème Arabe",
    fillesCell: 'P56', garconsCell: 'Q56', totalCell: 'R56',
    meta: { niveau: '3e', track: 'LV2', lv2: 'ARABE' },
  },
  {
    fieldCode: '2126', kind: 'TOTAL_ELEVES', levelLabel: "3ème Chinois",
    fillesCell: 'S55', garconsCell: 'T55', totalCell: 'U55',
    meta: { niveau: '3e', track: 'LV2', lv2: 'CHINOIS' },
  },
  {
    fieldCode: '2127', kind: 'REDOUBLANTS', levelLabel: "3ème Chinois",
    fillesCell: 'S56', garconsCell: 'T56', totalCell: 'U56',
    meta: { niveau: '3e', track: 'LV2', lv2: 'CHINOIS' },
  },
  {
    fieldCode: '2125', kind: 'DIVISIONS', levelLabel: "3ème Esp",
    cell: 'D53',
    meta: { niveau: '3e', track: 'LV2', lv2: 'ESP' },
  },
  {
    fieldCode: '2125', kind: 'DIVISIONS', levelLabel: "3ème All",
    cell: 'G53',
    meta: { niveau: '3e', track: 'LV2', lv2: 'ALL' },
  },
  {
    fieldCode: '2125', kind: 'DIVISIONS', levelLabel: "3ème Bilingue",
    cell: 'J53',
    meta: { niveau: '3e', track: 'BILINGUE' },
  },
  {
    fieldCode: '2125', kind: 'DIVISIONS', levelLabel: "3ème Ang Renforcé",
    cell: 'M53',
    meta: { niveau: '3e', track: 'NON_COUVERT' },
  },
  {
    fieldCode: '2125', kind: 'DIVISIONS', levelLabel: "3ème Arabe",
    cell: 'P53',
    meta: { niveau: '3e', track: 'LV2', lv2: 'ARABE' },
  },
  {
    fieldCode: '2125', kind: 'DIVISIONS', levelLabel: "3ème Chinois",
    cell: 'S53',
    meta: { niveau: '3e', track: 'LV2', lv2: 'CHINOIS' },
  },
  {
    fieldCode: '2129', kind: 'TOTAL_ELEVES', levelLabel: "3ème Italien",
    fillesCell: 'D61', garconsCell: 'E61', totalCell: 'F61',
    meta: { niveau: '3e', track: 'LV2', lv2: 'ITALIEN' },
  },
  {
    fieldCode: '2130', kind: 'REDOUBLANTS', levelLabel: "3ème Italien",
    fillesCell: 'D62', garconsCell: 'E62', totalCell: 'F62',
    meta: { niveau: '3e', track: 'LV2', lv2: 'ITALIEN' },
  },
  {
    fieldCode: '2129', kind: 'TOTAL_ELEVES', levelLabel: "3ème Autres",
    fillesCell: 'G61', garconsCell: 'H61', totalCell: 'I61',
    meta: { niveau: '3e', track: 'LV2_AUTRES' },
  },
  {
    fieldCode: '2130', kind: 'REDOUBLANTS', levelLabel: "3ème Autres",
    fillesCell: 'G62', garconsCell: 'H62', totalCell: 'I62',
    meta: { niveau: '3e', track: 'LV2_AUTRES' },
  },
];
