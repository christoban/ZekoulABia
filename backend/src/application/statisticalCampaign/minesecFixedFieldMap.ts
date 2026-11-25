/**
 * Mapping des champs à cellule fixe des feuilles Identification, Infrastructures et
 * Financement-Funding du fichier officiel 1-DPPC-MINESEC-SECONDAIRE-2022.xls.
 * Codes et références de cellules extraits et vérifiés manuellement à partir du fichier
 * réel déchiffré (voir conversation — jamais recréés à partir d'une supposition).
 */

export type FixedFieldCategory = 'A_AUTO' | 'C_MANUAL';
export type SubsystemBlock = 'GEN_FR' | 'GEN_EN' | 'TECH_FR' | 'TECH_EN';

export const SUBSYSTEM_LABELS: Record<SubsystemBlock, string> = {
  GEN_FR: 'Général Francophone',
  GEN_EN: 'Général Anglophone',
  TECH_FR: 'Technique Francophone',
  TECH_EN: 'Technique Anglophone',
};

/**
 * Détermine les sous-systèmes pertinents pour une école donnée, pour éviter d'afficher
 * les 4 blocs à un établissement mono-système. Un établissement MIXED/BILINGUAL ou dont
 * educationType=MIXED peut avoir plusieurs blocs actifs simultanément.
 */
export function getRelevantSubsystems(school: { subsystem: string; educationType: string }): SubsystemBlock[] {
  const isFr = school.subsystem === 'FRANCOPHONE' || school.subsystem === 'BILINGUAL';
  const isEn = school.subsystem === 'ANGLOPHONE' || school.subsystem === 'BILINGUAL';
  const isGeneral = school.educationType === 'GENERAL' || school.educationType === 'MIXED';
  const isTechnical = school.educationType === 'TECHNICAL' || school.educationType === 'PROFESSIONAL' || school.educationType === 'MIXED';

  const result: SubsystemBlock[] = [];
  if (isGeneral && isFr) result.push('GEN_FR');
  if (isGeneral && isEn) result.push('GEN_EN');
  if (isTechnical && isFr) result.push('TECH_FR');
  if (isTechnical && isEn) result.push('TECH_EN');
  return result.length > 0 ? result : ['GEN_FR'];
}

export interface FixedFieldEntry {
  fieldCode: string;
  sheetName: 'Identification' | 'Infrastructures' | 'Financement-Funding';
  fieldLabel: string;
  cellReference: string;
  category: FixedFieldCategory;
  /** Clé du champ correspondant dans SchoolStatisticalSupplement (si C_MANUAL). */
  supplementKey?: string;
  /** Sous-système ciblé par la cellule (Infrastructures — 4 blocs parallèles par feuille). */
  subsystem?: SubsystemBlock;
}

// ── Identification (I- IDENTIFICATION ET LOCALISATION DE L'ETABLISSEMENT) ──────────────
// 1100-1107 dérivés de School (nom/commune/ville/quartier/téléphone/année) — Catégorie A.
// 1108-1116 + 1200 = faits administratifs rares → SchoolStatisticalSupplement (Catégorie C).
export const IDENTIFICATION_FIELDS: FixedFieldEntry[] = [
  { fieldCode: '1100', sheetName: 'Identification', fieldLabel: "Nom de l'établissement", cellReference: 'C3', category: 'A_AUTO' },
  { fieldCode: '1101', sheetName: 'Identification', fieldLabel: 'Commune', cellReference: 'C4', category: 'A_AUTO' },
  { fieldCode: '1102', sheetName: 'Identification', fieldLabel: 'Ville/Village', cellReference: 'C5', category: 'A_AUTO' },
  { fieldCode: '1103', sheetName: 'Identification', fieldLabel: 'Quartier', cellReference: 'C6', category: 'A_AUTO' },
  { fieldCode: '1105', sheetName: 'Identification', fieldLabel: 'Poste Comptable', cellReference: 'C8', category: 'C_MANUAL', supplementKey: 'posteComptable' },
  { fieldCode: '1106', sheetName: 'Identification', fieldLabel: 'Téléphone établissement', cellReference: 'C9', category: 'A_AUTO' },
  { fieldCode: '1108', sheetName: 'Identification', fieldLabel: "Ordre d'enseignement", cellReference: 'F3', category: 'A_AUTO' },
  { fieldCode: '1109', sheetName: 'Identification', fieldLabel: 'Titre foncier (Oui/Non)', cellReference: 'F4', category: 'C_MANUAL', supplementKey: 'hasTitreFoncier' },
  { fieldCode: '1110', sheetName: 'Identification', fieldLabel: 'Site provisoire (Oui/Non)', cellReference: 'F5', category: 'C_MANUAL', supplementKey: 'siteProvisoire' },
  { fieldCode: '1111', sheetName: 'Identification', fieldLabel: 'Distance au + proche établissement public', cellReference: 'F6', category: 'C_MANUAL', supplementKey: 'distanceEtablissementProchePublic' },
  { fieldCode: '1112', sheetName: 'Identification', fieldLabel: 'Superficie totale du terrain (m²)', cellReference: 'F7', category: 'C_MANUAL', supplementKey: 'superficieTerrainM2' },
  { fieldCode: '1113', sheetName: 'Identification', fieldLabel: "Superficie disponible pour extension (m²)", cellReference: 'F8', category: 'C_MANUAL', supplementKey: 'superficieExtensionM2' },
  { fieldCode: '1114', sheetName: 'Identification', fieldLabel: 'Nombre de cycles', cellReference: 'F9', category: 'C_MANUAL', supplementKey: 'nombreCycles' },
  { fieldCode: '1115', sheetName: 'Identification', fieldLabel: "Dispose d'un internat (Oui/Non)", cellReference: 'F10', category: 'C_MANUAL', supplementKey: 'hasInternat' },
  { fieldCode: '1116', sheetName: 'Identification', fieldLabel: "Nature des voies d'accès", cellReference: 'F13', category: 'C_MANUAL', supplementKey: 'natureVoiesAcces' },
  { fieldCode: '1200', sheetName: 'Identification', fieldLabel: 'Nombre d\'écoles primaires < 1km', cellReference: 'C22', category: 'C_MANUAL', supplementKey: 'ecolesPrimairesProximite.moins1km' },
];

// ── Infrastructures (III.1 — type et qualité des locaux, codes 3100-3119) ──────────────
// Répété 4 fois (Général Fr, Général En, Technique Fr, Technique En) selon subsystem/ownership
// de l'école — Catégorie C intégrale (inventaire physique, jamais géré au quotidien dans
// ZekoulABia, voir doc section 1.3).
export const INFRA_ROWS: { code: string; label: string; row: number }[] = [
  { code: '3100', label: 'Salles de classe ordinaires', row: 16 },
  { code: '3101', label: 'Salles spécialisées — Labo scientifique', row: 17 },
  { code: '3102', label: 'Salles spécialisées — Labo de langues', row: 18 },
  { code: '3103', label: 'Salle informatique', row: 19 },
  { code: '3104', label: 'Centre de Ressources Multimédia', row: 20 },
  { code: '3105', label: 'Bureaux administratifs', row: 21 },
  { code: '3106', label: 'Bibliothèque', row: 22 },
  { code: '3107', label: 'Salle des professeurs', row: 23 },
  { code: '3108', label: 'Salle de réunion', row: 24 },
  { code: '3109', label: 'Cantine scolaire', row: 25 },
  { code: '3110', label: 'Infirmerie', row: 26 },
  { code: '3111', label: 'Internat', row: 27 },
  { code: '3112', label: 'Toilettes Filles', row: 28 },
  { code: '3113', label: 'Toilettes Garçons', row: 29 },
  { code: '3114', label: 'Toilettes Mixtes élèves', row: 30 },
  { code: '3115', label: 'Toilettes Personnel Femme', row: 31 },
  { code: '3116', label: 'Toilettes Personnel Homme', row: 32 },
  { code: '3117', label: 'Toilettes Mixtes Personnel', row: 33 },
  { code: '3118', label: 'Logement de fonction', row: 34 },
  { code: '3119', label: 'Gymnase', row: 35 },
];
// La 1ère colonne de chaque bloc sous-système ("Nombre de locaux") est en réalité une
// FORMULE (SUM des 6 colonnes de répartition matériau × état) — jamais une cellule
// d'entrée. Vérifié directement sur le fichier réel : F16 = "SUM(H16:M16)", idem N/V/AD.
// La vraie saisie porte sur 7 colonnes par sous-système, à décalage constant depuis la
// colonne de base : +1 = places disponibles, +2/+3/+4 = Définitif Bon/Acceptable/Mauvais,
// +5/+6/+7 = Provisoire Bon/Acceptable/Mauvais (English : Permanent/Temporal — même axe).
export const SUBSYSTEM_BASE_COL: Record<SubsystemBlock, string> = { GEN_FR: 'F', GEN_EN: 'N', TECH_FR: 'V', TECH_EN: 'AD' };
const INFRA_BREAKDOWN_OFFSETS: { key: string; label: string; offset: number }[] = [
  { key: 'placesDisponibles', label: 'Places disponibles', offset: 1 },
  { key: 'definitifBon', label: 'Définitif — Bon état', offset: 2 },
  { key: 'definitifAcceptable', label: 'Définitif — Acceptable', offset: 3 },
  { key: 'definitifMauvais', label: 'Définitif — Mauvais état', offset: 4 },
  { key: 'provisoireBon', label: 'Provisoire — Bon état', offset: 5 },
  { key: 'provisoireAcceptable', label: 'Provisoire — Acceptable', offset: 6 },
  { key: 'provisoireMauvais', label: 'Provisoire — Mauvais état', offset: 7 },
];

function colToIdx(col: string): number {
  let idx = 0;
  for (const ch of col) idx = idx * 26 + (ch.charCodeAt(0) - 64);
  return idx - 1;
}
function idxToCol(idx: number): string {
  let n = idx + 1;
  let col = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    n = Math.floor((n - 1) / 26);
  }
  return col;
}

export const INFRASTRUCTURE_FIELDS: FixedFieldEntry[] = INFRA_ROWS.flatMap((r) =>
  (Object.keys(SUBSYSTEM_BASE_COL) as SubsystemBlock[]).flatMap((sub) => {
    const baseIdx = colToIdx(SUBSYSTEM_BASE_COL[sub]);
    return INFRA_BREAKDOWN_OFFSETS.map((b) => ({
      fieldCode: r.code,
      sheetName: 'Infrastructures' as const,
      fieldLabel: `${r.label} — ${sub} — ${b.label}`,
      cellReference: `${idxToCol(baseIdx + b.offset)}${r.row}`,
      category: 'C_MANUAL' as const,
      supplementKey: `infrastructuresDetail.${sub}.${r.code}.${b.key}`,
      subsystem: sub,
    }));
  }),
);

export const INFRA_BREAKDOWN_KEYS = INFRA_BREAKDOWN_OFFSETS.map((b) => ({ key: b.key, label: b.label }));

// Autres équipements/commodités (III.3, codes 3300-3311) — Oui/Non, une seule cellule (F),
// pas de déclinaison par sous-système.
export const COMMODITES_ROWS: { code: string; label: string; row: number }[] = [
  { code: '3300', label: 'Branchement électrique fonctionnel', row: 61 },
  { code: '3302', label: 'Aires de jeu aménagées', row: 64 },
  { code: '3303', label: 'Établissement clôturé', row: 65 },
  { code: '3304', label: 'Connexion Internet', row: 66 },
  { code: '3305', label: "Source d'approvisionnement en eau", row: 67 },
  { code: '3307', label: 'Boîte à pharmacie premiers soins', row: 69 },
  { code: '3308', label: 'Cantine scolaire fonctionnelle', row: 70 },
  { code: '3310', label: 'Infrastructures adaptées handicapés', row: 73 },
  { code: '3311', label: 'Installations de lavage des mains', row: 74 },
];
for (const r of COMMODITES_ROWS) {
  INFRASTRUCTURE_FIELDS.push({
    fieldCode: r.code,
    sheetName: 'Infrastructures',
    fieldLabel: r.label,
    cellReference: `F${r.row}`,
    category: 'C_MANUAL',
    supplementKey: `infrastructuresDetail.commodites.${r.code}`,
  });
}

// ── Financement-Funding (VI — codes 6000-6010 = historique BIP, Catégorie C) ───────────
// 6011-6023 (frais APE/inscription) volontairement absents d'ici : Catégorie A, résolus
// directement depuis FeePlan par le use case (voir resolveAutoFields.ts), pas de cellule
// fixe unique car le bloc Public/Privé applicable dépend de School.ownership.
export const FINANCEMENT_FIELDS: FixedFieldEntry[] = [
  { fieldCode: '6000', sheetName: 'Financement-Funding', fieldLabel: 'A bénéficié d\'un BIP (Oui/Non)', cellReference: 'D11', category: 'C_MANUAL', supplementKey: 'historiqueBip.length>0' },
  { fieldCode: '6001', sheetName: 'Financement-Funding', fieldLabel: 'Désignation BIP 1', cellReference: 'D12', category: 'C_MANUAL', supplementKey: 'historiqueBip[0].designation' },
  { fieldCode: '6002', sheetName: 'Financement-Funding', fieldLabel: 'Année obtention BIP 1', cellReference: 'D13', category: 'C_MANUAL', supplementKey: 'historiqueBip[0].anneeObtention' },
  { fieldCode: '6003', sheetName: 'Financement-Funding', fieldLabel: 'Désignation BIP 2', cellReference: 'D14', category: 'C_MANUAL', supplementKey: 'historiqueBip[1].designation' },
  { fieldCode: '6004', sheetName: 'Financement-Funding', fieldLabel: 'Année obtention BIP 2', cellReference: 'D15', category: 'C_MANUAL', supplementKey: 'historiqueBip[1].anneeObtention' },
  { fieldCode: '6005', sheetName: 'Financement-Funding', fieldLabel: 'Désignation BIP 3', cellReference: 'D16', category: 'C_MANUAL', supplementKey: 'historiqueBip[2].designation' },
  { fieldCode: '6006', sheetName: 'Financement-Funding', fieldLabel: 'Année obtention BIP 3', cellReference: 'D17', category: 'C_MANUAL', supplementKey: 'historiqueBip[2].anneeObtention' },
  { fieldCode: '6007', sheetName: 'Financement-Funding', fieldLabel: 'Désignation BIP 4', cellReference: 'D18', category: 'C_MANUAL', supplementKey: 'historiqueBip[3].designation' },
  { fieldCode: '6008', sheetName: 'Financement-Funding', fieldLabel: 'Année obtention BIP 4', cellReference: 'D19', category: 'C_MANUAL', supplementKey: 'historiqueBip[3].anneeObtention' },
  { fieldCode: '6009', sheetName: 'Financement-Funding', fieldLabel: 'Désignation BIP 5', cellReference: 'D20', category: 'C_MANUAL', supplementKey: 'historiqueBip[4].designation' },
  { fieldCode: '6010', sheetName: 'Financement-Funding', fieldLabel: 'Année obtention BIP 5', cellReference: 'D21', category: 'C_MANUAL', supplementKey: 'historiqueBip[4].anneeObtention' },
];

// Frais APE/inscription (Catégorie A, dérivés de FeePlan) — cellules par bloc
// Public (lignes 11-15) / Privé (lignes 19-23), sous-bloc Général (G) / Technique (G, +3 lignes).
// Un seul bloc est rempli selon School.ownership (PUBLIC vs PRIVATE_*).
export const FEE_AUTO_FIELDS = {
  publicGeneral1erCycle: 'G11',
  publicGeneral2ndCycle: 'G12',
  publicTechnique1erCycle: 'G14',
  publicTechnique2ndCycle: 'G15',
  privateGeneral1erCycle: 'G19',
  privateGeneral2ndCycle: 'G20',
  privateTechnique1erCycle: 'G22',
  privateTechnique2ndCycle: 'G23',
} as const;
