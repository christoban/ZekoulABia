/**
 * Mapping des champs eleves ESG (Enseignement Secondaire General), feuille Eleves_ESG_Fr.
 * Genere a partir d une extraction automatisee et auto-verifiee du fichier officiel
 * 1-DPPC-MINESEC-SECONDAIRE-2022.xls (formules Excel utilisees comme controle croise).
 *
 * Chaque groupe niveau/filiere/LV2 produit jusqu a 3 entrees : nombre de divisions, total
 * eleves (F/G) et redoublants (F/G). Les colonnes "Total"/"Ensemble" du fichier sont des
 * FORMULES Excel dans le template original -- mais SheetJS (ecriture BIFF8) ne preserve PAS
 * les formules au round-trip (verifie empiriquement, pas seulement le formatage). La cellule
 * totalCell doit donc etre calculee cote code et ecrite comme valeur statique, jamais laissee
 * a un recalcul Excel qui n aura pas lieu (la formule est litteralement absente du fichier
 * de sortie, pas juste "en attente de recalcul").
 *
 * track "NON_COUVERT" = "Anglais Renforce", gap confirme non modelise dans ZekoulABia
 * (ni pebsFiliere, ni lv2SubjectId ne le couvrent) -- decision actee : cellule laissee
 * vide, signalee dans le rapport d accompagnement comme pour un gap RH classique.
 */

import type { EsgFieldEntry } from './minesecEsgSharedFieldMap';
import { ESG_1ER_CYCLE_FIELDS } from './minesecEsg1erCycleFieldMap';
import { ESG_2NDE_FIELDS } from './minesecEsg2ndeFieldMap';
import { ESG_1ERE_TLE_FIELDS } from './minesecEsg1ereTleFieldMap';

export type { EsgTrack, EsgLevelMeta, EsgFieldEntry } from './minesecEsgSharedFieldMap';

export const ESG_FIELD_MAPPING: EsgFieldEntry[] = [
  ...ESG_1ER_CYCLE_FIELDS,
  ...ESG_2NDE_FIELDS,
  ...ESG_1ERE_TLE_FIELDS,
];
