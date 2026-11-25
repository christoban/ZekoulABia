/**
 * Mapping des champs eleves ESG francophone — 1ere et Terminale.
 */
import type { EsgFieldEntry } from './minesecEsgSharedFieldMap';

export const ESG_1ERE_TLE_FIELDS: EsgFieldEntry[] = [
  {
    fieldCode: '2138', kind: 'TOTAL_ELEVES', levelLabel: "1ère A4 All",
    fillesCell: 'M88', garconsCell: 'N88', totalCell: 'O88',
    meta: { niveau: '1ere', serie: 'A4', track: 'LV2', lv2: 'ALL' },
  },
  {
    fieldCode: '2139', kind: 'REDOUBLANTS', levelLabel: "1ère A4 All",
    fillesCell: 'M89', garconsCell: 'N89', totalCell: 'O89',
    meta: { niveau: '1ere', serie: 'A4', track: 'LV2', lv2: 'ALL' },
  },
  {
    fieldCode: '2138', kind: 'TOTAL_ELEVES', levelLabel: "1ère A4 Esp",
    fillesCell: 'P88', garconsCell: 'Q88', totalCell: 'R88',
    meta: { niveau: '1ere', serie: 'A4', track: 'LV2', lv2: 'ESP' },
  },
  {
    fieldCode: '2139', kind: 'REDOUBLANTS', levelLabel: "1ère A4 Esp",
    fillesCell: 'P89', garconsCell: 'Q89', totalCell: 'R89',
    meta: { niveau: '1ere', serie: 'A4', track: 'LV2', lv2: 'ESP' },
  },
  {
    fieldCode: '2138', kind: 'TOTAL_ELEVES', levelLabel: "1èreA Bilingue",
    fillesCell: 'S88', garconsCell: 'T88', totalCell: 'U88',
    meta: { niveau: '1ere', serie: 'ABI', track: 'BILINGUE' },
  },
  {
    fieldCode: '2139', kind: 'REDOUBLANTS', levelLabel: "1èreA Bilingue",
    fillesCell: 'S89', garconsCell: 'T89', totalCell: 'U89',
    meta: { niveau: '1ere', serie: 'ABI', track: 'BILINGUE' },
  },
  {
    fieldCode: '2141', kind: 'TOTAL_ELEVES', levelLabel: "1ère Ang Renforcé",
    fillesCell: 'D94', garconsCell: 'E94', totalCell: 'F94',
    meta: { niveau: '1ere', track: 'NON_COUVERT' },
  },
  {
    fieldCode: '2142', kind: 'REDOUBLANTS', levelLabel: "1ère Ang Renforcé",
    fillesCell: 'D95', garconsCell: 'E95', totalCell: 'F95',
    meta: { niveau: '1ere', track: 'NON_COUVERT' },
  },
  {
    fieldCode: '2141', kind: 'TOTAL_ELEVES', levelLabel: "1ère Arabe",
    fillesCell: 'G94', garconsCell: 'H94', totalCell: 'I94',
    meta: { niveau: '1ere', serie: 'A4', track: 'LV2', lv2: 'ARABE' },
  },
  {
    fieldCode: '2142', kind: 'REDOUBLANTS', levelLabel: "1ère Arabe",
    fillesCell: 'G95', garconsCell: 'H95', totalCell: 'I95',
    meta: { niveau: '1ere', serie: 'A4', track: 'LV2', lv2: 'ARABE' },
  },
  {
    fieldCode: '2141', kind: 'TOTAL_ELEVES', levelLabel: "1ère Chinois",
    fillesCell: 'J94', garconsCell: 'K94', totalCell: 'L94',
    meta: { niveau: '1ere', serie: 'A4', track: 'LV2', lv2: 'CHINOIS' },
  },
  {
    fieldCode: '2142', kind: 'REDOUBLANTS', levelLabel: "1ère Chinois",
    fillesCell: 'J95', garconsCell: 'K95', totalCell: 'L95',
    meta: { niveau: '1ere', serie: 'A4', track: 'LV2', lv2: 'CHINOIS' },
  },
  {
    fieldCode: '2141', kind: 'TOTAL_ELEVES', levelLabel: "1ère Italien",
    fillesCell: 'M94', garconsCell: 'N94', totalCell: 'O94',
    meta: { niveau: '1ere', serie: 'A4', track: 'LV2', lv2: 'ITALIEN' },
  },
  {
    fieldCode: '2142', kind: 'REDOUBLANTS', levelLabel: "1ère Italien",
    fillesCell: 'M95', garconsCell: 'N95', totalCell: 'O95',
    meta: { niveau: '1ere', serie: 'A4', track: 'LV2', lv2: 'ITALIEN' },
  },
  {
    fieldCode: '2141', kind: 'TOTAL_ELEVES', levelLabel: "1ère C",
    fillesCell: 'P94', garconsCell: 'Q94', totalCell: 'R94',
    meta: { niveau: '1ere', serie: 'C', track: 'SERIE' },
  },
  {
    fieldCode: '2142', kind: 'REDOUBLANTS', levelLabel: "1ère C",
    fillesCell: 'P95', garconsCell: 'Q95', totalCell: 'R95',
    meta: { niveau: '1ere', serie: 'C', track: 'SERIE' },
  },
  {
    fieldCode: '2141', kind: 'TOTAL_ELEVES', levelLabel: "1ère D",
    fillesCell: 'S94', garconsCell: 'T94', totalCell: 'U94',
    meta: { niveau: '1ere', serie: 'D', track: 'SERIE' },
  },
  {
    fieldCode: '2142', kind: 'REDOUBLANTS', levelLabel: "1ère D",
    fillesCell: 'S95', garconsCell: 'T95', totalCell: 'U95',
    meta: { niveau: '1ere', serie: 'D', track: 'SERIE' },
  },
  {
    fieldCode: '2144', kind: 'TOTAL_ELEVES', levelLabel: "1ère TI",
    fillesCell: 'D100', garconsCell: 'E100', totalCell: 'F100',
    meta: { niveau: '1ere', serie: 'TI', track: 'SERIE' },
  },
  {
    fieldCode: '2145', kind: 'REDOUBLANTS', levelLabel: "1ère TI",
    fillesCell: 'D101', garconsCell: 'E101', totalCell: 'F101',
    meta: { niveau: '1ere', serie: 'TI', track: 'SERIE' },
  },
  {
    fieldCode: '2144', kind: 'TOTAL_ELEVES', levelLabel: "Autres 1ère",
    fillesCell: 'G100', garconsCell: 'H100', totalCell: 'I100',
    meta: { niveau: '1ere', track: 'SERIE_RESIDUELLE', serieExclues: ['A4', 'ABI', 'C', 'D', 'TI'] },
  },
  {
    fieldCode: '2145', kind: 'REDOUBLANTS', levelLabel: "Autres 1ère",
    fillesCell: 'G101', garconsCell: 'H101', totalCell: 'I101',
    meta: { niveau: '1ere', track: 'SERIE_RESIDUELLE', serieExclues: ['A4', 'ABI', 'C', 'D', 'TI'] },
  },
  {
    fieldCode: '2144', kind: 'TOTAL_ELEVES', levelLabel: "Terminale A4 All",
    fillesCell: 'J100', garconsCell: 'K100', totalCell: 'L100',
    meta: { niveau: 'Tle', serie: 'A4', track: 'LV2', lv2: 'ALL' },
  },
  {
    fieldCode: '2145', kind: 'REDOUBLANTS', levelLabel: "Terminale A4 All",
    fillesCell: 'J101', garconsCell: 'K101', totalCell: 'L101',
    meta: { niveau: 'Tle', serie: 'A4', track: 'LV2', lv2: 'ALL' },
  },
  {
    fieldCode: '2144', kind: 'TOTAL_ELEVES', levelLabel: "Terminale A4 Esp",
    fillesCell: 'M100', garconsCell: 'N100', totalCell: 'O100',
    meta: { niveau: 'Tle', serie: 'A4', track: 'LV2', lv2: 'ESP' },
  },
  {
    fieldCode: '2145', kind: 'REDOUBLANTS', levelLabel: "Terminale A4 Esp",
    fillesCell: 'M101', garconsCell: 'N101', totalCell: 'O101',
    meta: { niveau: 'Tle', serie: 'A4', track: 'LV2', lv2: 'ESP' },
  },
  {
    fieldCode: '2144', kind: 'TOTAL_ELEVES', levelLabel: "Terminale A Bilingue",
    fillesCell: 'P100', garconsCell: 'Q100', totalCell: 'R100',
    meta: { niveau: 'Tle', serie: 'ABI', track: 'BILINGUE' },
  },
  {
    fieldCode: '2145', kind: 'REDOUBLANTS', levelLabel: "Terminale A Bilingue",
    fillesCell: 'P101', garconsCell: 'Q101', totalCell: 'R101',
    meta: { niveau: 'Tle', serie: 'ABI', track: 'BILINGUE' },
  },
  {
    fieldCode: '2144', kind: 'TOTAL_ELEVES', levelLabel: "Terminale Ang Renforcé",
    fillesCell: 'S100', garconsCell: 'T100', totalCell: 'U100',
    meta: { niveau: 'Tle', track: 'NON_COUVERT' },
  },
  {
    fieldCode: '2145', kind: 'REDOUBLANTS', levelLabel: "Terminale Ang Renforcé",
    fillesCell: 'S101', garconsCell: 'T101', totalCell: 'U101',
    meta: { niveau: 'Tle', track: 'NON_COUVERT' },
  },
  {
    fieldCode: '2147', kind: 'TOTAL_ELEVES', levelLabel: "Terminale Arabe",
    fillesCell: 'D106', garconsCell: 'E106', totalCell: 'F106',
    meta: { niveau: 'Tle', serie: 'A4', track: 'LV2', lv2: 'ARABE' },
  },
  {
    fieldCode: '2148', kind: 'REDOUBLANTS', levelLabel: "Terminale Arabe",
    fillesCell: 'D107', garconsCell: 'E107', totalCell: 'F107',
    meta: { niveau: 'Tle', serie: 'A4', track: 'LV2', lv2: 'ARABE' },
  },
  {
    fieldCode: '2147', kind: 'TOTAL_ELEVES', levelLabel: "Terminale Chinois",
    fillesCell: 'G106', garconsCell: 'H106', totalCell: 'I106',
    meta: { niveau: 'Tle', serie: 'A4', track: 'LV2', lv2: 'CHINOIS' },
  },
  {
    fieldCode: '2148', kind: 'REDOUBLANTS', levelLabel: "Terminale Chinois",
    fillesCell: 'G107', garconsCell: 'H107', totalCell: 'I107',
    meta: { niveau: 'Tle', serie: 'A4', track: 'LV2', lv2: 'CHINOIS' },
  },
  {
    fieldCode: '2147', kind: 'TOTAL_ELEVES', levelLabel: "Terminale Italien",
    fillesCell: 'J106', garconsCell: 'K106', totalCell: 'L106',
    meta: { niveau: 'Tle', serie: 'A4', track: 'LV2', lv2: 'ITALIEN' },
  },
  {
    fieldCode: '2148', kind: 'REDOUBLANTS', levelLabel: "Terminale Italien",
    fillesCell: 'J107', garconsCell: 'K107', totalCell: 'L107',
    meta: { niveau: 'Tle', serie: 'A4', track: 'LV2', lv2: 'ITALIEN' },
  },
  {
    fieldCode: '2147', kind: 'TOTAL_ELEVES', levelLabel: "Terminale C",
    fillesCell: 'M106', garconsCell: 'N106', totalCell: 'O106',
    meta: { niveau: 'Tle', serie: 'C', track: 'SERIE' },
  },
  {
    fieldCode: '2148', kind: 'REDOUBLANTS', levelLabel: "Terminale C",
    fillesCell: 'M107', garconsCell: 'N107', totalCell: 'O107',
    meta: { niveau: 'Tle', serie: 'C', track: 'SERIE' },
  },
  {
    fieldCode: '2147', kind: 'TOTAL_ELEVES', levelLabel: "Terminale D",
    fillesCell: 'P106', garconsCell: 'Q106', totalCell: 'R106',
    meta: { niveau: 'Tle', serie: 'D', track: 'SERIE' },
  },
  {
    fieldCode: '2148', kind: 'REDOUBLANTS', levelLabel: "Terminale D",
    fillesCell: 'P107', garconsCell: 'Q107', totalCell: 'R107',
    meta: { niveau: 'Tle', serie: 'D', track: 'SERIE' },
  },
  {
    fieldCode: '2147', kind: 'TOTAL_ELEVES', levelLabel: "Terminale TI",
    fillesCell: 'S106', garconsCell: 'T106', totalCell: 'U106',
    meta: { niveau: 'Tle', serie: 'TI', track: 'SERIE' },
  },
  {
    fieldCode: '2148', kind: 'REDOUBLANTS', levelLabel: "Terminale TI",
    fillesCell: 'S107', garconsCell: 'T107', totalCell: 'U107',
    meta: { niveau: 'Tle', serie: 'TI', track: 'SERIE' },
  },
];
