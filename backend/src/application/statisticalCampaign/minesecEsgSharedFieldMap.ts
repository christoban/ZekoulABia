/**
 * Types partages pour le mapping des champs eleves ESG (feuille Eleves_ESG_Fr).
 *
 * track "NON_COUVERT" = "Anglais Renforce", gap confirme non modelise dans ZekoulABia
 * (ni pebsFiliere, ni lv2SubjectId ne le couvrent) -- decision actee : cellule laissee
 * vide, signalee dans le rapport d accompagnement comme pour un gap RH classique.
 */

export type EsgTrack =
  | 'GENERAL'
  | 'BILINGUE'
  | 'LV2'
  | 'LV2_AUTRES'
  | 'SERIE'
  | 'SERIE_RESIDUELLE'
  | 'NON_COUVERT';

export interface EsgLevelMeta {
  niveau: string;
  serie?: string;
  track: EsgTrack;
  lv2?: 'ESP' | 'ALL' | 'ARABE' | 'CHINOIS' | 'ITALIEN';
  serieExclues?: string[];
}

export interface EsgFieldEntry {
  fieldCode: string;
  kind: 'DIVISIONS' | 'TOTAL_ELEVES' | 'REDOUBLANTS';
  levelLabel: string;
  cell?: string; // pour kind === 'DIVISIONS'
  totalCell?: string | null; // cellule "Total" (ex-formule Excel -- valeur statique ou formule preservee)
  fillesCell?: string;
  garconsCell?: string;
  meta: EsgLevelMeta;
}
