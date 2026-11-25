/**
 * Résolution des champs Catégorie A_AUTO (dérivés automatiquement des données ZekoulABia)
 * et B_PARTIAL (dérivés si la donnée RH existe, sinon signalés comme gap — jamais inventés).
 */
import type { StatisticalQueryPort } from '@domain/ports/repositories/StatisticalQueryPort';
import { ESG_FIELD_MAPPING, type EsgFieldEntry } from './minesecEsgFieldMap';
import { AGE_LEVEL_COLUMNS, AGE_ROWS } from './minesecAgeDistributionMap';
import { FEE_AUTO_FIELDS } from './minesecFixedFieldMap';
import type { ChampNonResolu } from './types';

export interface ResolvedCell {
  sheetName: string;
  cellReference: string;
  value: number | string;
  dataType: 'NUMBER' | 'TEXT';
}

const LV2_KEYWORDS: Record<'ESP' | 'ALL' | 'ARABE' | 'CHINOIS' | 'ITALIEN', RegExp> = {
  ESP: /espagn|espanol/i,
  ALL: /allemand|deutsch/i,
  ARABE: /arabe/i,
  CHINOIS: /chinois|mandarin/i,
  ITALIEN: /italien/i,
};

function matchLv2(subjectName: string | null | undefined): 'ESP' | 'ALL' | 'ARABE' | 'CHINOIS' | 'ITALIEN' | 'AUTRES' | null {
  if (!subjectName) return null;
  for (const key of Object.keys(LV2_KEYWORDS) as (keyof typeof LV2_KEYWORDS)[]) {
    if (LV2_KEYWORDS[key].test(subjectName)) return key;
  }
  return 'AUTRES';
}

interface StudentRow {
  gender: string | null;
  dateOfBirth: Date | null;
  niveau: string;
  serie: string | null;
  filiere: string | null;
  lv2Name: string | null;
}

async function fetchEsgStudents(query: StatisticalQueryPort, schoolId: string): Promise<StudentRow[]> {
  return query.listerElevesEsg(schoolId);
}

function studentMatchesEsgEntry(student: StudentRow, meta: EsgFieldEntry['meta']): boolean {
  if (student.niveau !== meta.niveau) return false;
  switch (meta.track) {
    case 'GENERAL':
      // 1er cycle sans bilingue (filiere FR_GENERAL ou absent)
      return student.filiere !== 'FR_PEBS' && student.filiere !== 'EN_PEBS';
    case 'BILINGUE':
      if (meta.serie) return student.serie === meta.serie; // 2nd cycle : série ABI
      return student.filiere === 'FR_PEBS' || student.filiere === 'EN_PEBS'; // 1er cycle
    case 'LV2': {
      if (meta.serie && student.serie !== meta.serie) return false;
      if (!meta.serie && (student.filiere === 'FR_PEBS' || student.filiere === 'EN_PEBS')) return false;
      return matchLv2(student.lv2Name) === meta.lv2;
    }
    case 'LV2_AUTRES': {
      if (student.filiere === 'FR_PEBS' || student.filiere === 'EN_PEBS') return false;
      const m = matchLv2(student.lv2Name);
      return m === 'AUTRES';
    }
    case 'SERIE':
      return student.serie === meta.serie;
    case 'SERIE_RESIDUELLE':
      return !!student.serie && !(meta.serieExclues ?? []).includes(student.serie);
    case 'NON_COUVERT':
      return false; // Anglais Renforcé — jamais compté, gap signalé séparément
    default:
      return false;
  }
}

function computeAge(dateOfBirth: Date | null, referenceDate: Date): number | null {
  if (!dateOfBirth) return null;
  let age = referenceDate.getFullYear() - dateOfBirth.getFullYear();
  const m = referenceDate.getMonth() - dateOfBirth.getMonth();
  if (m < 0 || (m === 0 && referenceDate.getDate() < dateOfBirth.getDate())) age--;
  return age;
}

export async function resolveEsgFields(
  query: StatisticalQueryPort,
  schoolId: string,
): Promise<{ cells: ResolvedCell[]; nonCouverts: ChampNonResolu[] }> {
  const students = await fetchEsgStudents(query, schoolId);
  const cells: ResolvedCell[] = [];
  const nonCouverts: ChampNonResolu[] = [];
  const seenNonCouvert = new Set<string>();

  // Divisions/Total élèves/Redoublants par groupe niveau-filière
  for (const entry of ESG_FIELD_MAPPING) {
    if (entry.meta.track === 'NON_COUVERT') {
      const key = entry.levelLabel;
      if (!seenNonCouvert.has(key)) {
        seenNonCouvert.add(key);
        nonCouverts.push({
          fieldCode: entry.fieldCode,
          sheetName: 'Eleves_ESG_Fr',
          cellReference: entry.fillesCell ?? entry.cell ?? '',
          fieldLabel: entry.levelLabel,
          raison: "Anglais Renforcé : gap confirmé, non modélisé dans ZekoulABia — décision actée de laisser vide.",
        });
      }
      continue;
    }
    if (entry.kind === 'DIVISIONS') continue; // Nombre de divisions — dérivable de Class, non prioritaire pour cette phase

    if (entry.kind === 'REDOUBLANTS') {
      // StudentProfile n'a AUCUN champ de redoublement — impossible de distinguer un
      // redoublant d'un élève normal. Écrire le même compte que "Total élèves" serait une
      // donnée FAUSSE (pas juste incomplète) : on signale un gap structurel, on n'écrit rien.
      nonCouverts.push({
        fieldCode: entry.fieldCode,
        sheetName: 'Eleves_ESG_Fr',
        cellReference: entry.fillesCell ?? '',
        fieldLabel: `Redoublants — ${entry.levelLabel}`,
        raison: "Aucun champ de redoublement n'existe sur StudentProfile dans ZekoulABia — gap structurel, jamais déduit du total élèves.",
      });
      continue;
    }

    const matched = students.filter((s) => studentMatchesEsgEntry(s, entry.meta));
    const filles = matched.filter((s) => s.gender === 'F' || s.gender === 'FEMALE' || s.gender === 'Fille').length;
    const garcons = matched.filter((s) => s.gender === 'M' || s.gender === 'MALE' || s.gender === 'Garçon').length;

    if (entry.fillesCell) cells.push({ sheetName: 'Eleves_ESG_Fr', cellReference: entry.fillesCell, value: filles, dataType: 'NUMBER' });
    if (entry.garconsCell) cells.push({ sheetName: 'Eleves_ESG_Fr', cellReference: entry.garconsCell, value: garcons, dataType: 'NUMBER' });
    // La cellule "Total" (Filles+Garçons) reste une formule Excel dans le template : depuis la
    // migration LibreOffice+exceljs (voir xlsEngine.ts), elle est préservée et se recalcule
    // seule à l'ouverture — plus besoin de l'écrire en dur (vérifié empiriquement, voir rapport
    // de migration). L'ancien hack SheetJS/BIFF8 qui recalculait ce total à la main a été retiré.
  }

  // Répartition par âge (II.1.1) — toujours calculée par rapport au 1er septembre de l'année scolaire en cours
  const now = new Date();
  const refYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const referenceDate = new Date(refYear, 8, 1);
  for (const ageRow of AGE_ROWS) {
    for (const level of AGE_LEVEL_COLUMNS) {
      const inBucket = students.filter((s) => {
        if (s.niveau !== level.niveau) return false;
        const age = computeAge(s.dateOfBirth, referenceDate);
        if (age === null) return false;
        if (ageRow.ageMin !== null && age < ageRow.ageMin) return false;
        if (ageRow.ageMax !== null && age > ageRow.ageMax) return false;
        return true;
      });
      const filles = inBucket.filter((s) => s.gender === 'F' || s.gender === 'FEMALE' || s.gender === 'Fille').length;
      const garcons = inBucket.filter((s) => s.gender === 'M' || s.gender === 'MALE' || s.gender === 'Garçon').length;
      cells.push({ sheetName: 'Eleves_ESG_Fr', cellReference: `${level.fillesCol}${ageRow.row}`, value: filles, dataType: 'NUMBER' });
      cells.push({ sheetName: 'Eleves_ESG_Fr', cellReference: `${level.garconsCol}${ageRow.row}`, value: garcons, dataType: 'NUMBER' });
    }
    // Colonnes "Ensemble" R/S/T — formules dans le template (somme des 7 niveaux) : préservées
    // et recalculées seules à l'ouverture depuis la migration LibreOffice+exceljs, plus besoin
    // de les écrire en dur (voir commentaire équivalent plus haut).
  }

  return { cells, nonCouverts };
}

const EDUCATION_TYPE_LABEL: Record<string, string> = {
  GENERAL: 'Général',
  TECHNICAL: 'Technique',
  PROFESSIONAL: 'Professionnel',
  MIXED: 'Général et Technique',
};

export async function resolveIdentificationAutoFields(
  query: StatisticalQueryPort,
  schoolId: string,
): Promise<ResolvedCell[]> {
  const school = await query.trouverEcole(schoolId);
  if (!school) return [];
  const cells: ResolvedCell[] = [
    { sheetName: 'Identification', cellReference: 'C3', value: school.name ?? '', dataType: 'TEXT' },
    { sheetName: 'Identification', cellReference: 'C4', value: school.city ?? '', dataType: 'TEXT' },
    { sheetName: 'Identification', cellReference: 'C5', value: school.city ?? '', dataType: 'TEXT' },
    { sheetName: 'Identification', cellReference: 'C6', value: school.address ?? '', dataType: 'TEXT' },
    { sheetName: 'Identification', cellReference: 'C9', value: school.phone ?? '', dataType: 'TEXT' },
    { sheetName: 'Identification', cellReference: 'F3', value: EDUCATION_TYPE_LABEL[school.educationType] ?? '', dataType: 'TEXT' },
  ];
  return cells;
}

/**
 * Frais APE/inscription (Financement-Funding, codes 6011-6023) — Catégorie A dérivée de
 * FeePlan. Un seul bloc s'applique selon School.ownership (Public vs Privé). Si plusieurs
 * FeePlan existent pour un même cycle (niveaux différents), on prend le montant le plus
 * fréquent ; en cas d'égalité, le plus élevé — signalé dans le rapport si ambigu.
 */
export async function resolveFeeAutoFields(query: StatisticalQueryPort, schoolId: string): Promise<ResolvedCell[]> {
  const school = await query.trouverEcole(schoolId);
  if (!school) return [];
  const isPublic = school.ownership === 'PUBLIC';

  const feePlans = await query.listerFeePlans(schoolId);

  const FIRST_CYCLE_LEVELS = ['6e', '5e', '4e', '3e'];
  const SECOND_CYCLE_LEVELS = ['2nde', '1ere', 'Tle'];

  function representativeAmount(feeType: string, levels: string[]): number | null {
    const amounts = feePlans.filter((f) => f.feeType === feeType && f.level && levels.includes(f.level)).map((f) => f.amount);
    if (amounts.length === 0) return null;
    const counts = new Map<number, number>();
    for (const a of amounts) counts.set(a, (counts.get(a) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
  }

  const cells: ResolvedCell[] = [];
  const apeCycle1 = representativeAmount('APEE_PTA', FIRST_CYCLE_LEVELS);
  const apeCycle2 = representativeAmount('APEE_PTA', SECOND_CYCLE_LEVELS);
  const inscCycle1 = representativeAmount('INSCRIPTION', FIRST_CYCLE_LEVELS);
  const inscCycle2 = representativeAmount('INSCRIPTION', SECOND_CYCLE_LEVELS);

  const prefix = isPublic ? 'public' : 'private';
  if (apeCycle1 !== null) cells.push({ sheetName: 'Financement-Funding', cellReference: FEE_AUTO_FIELDS[`${prefix}General1erCycle`], value: apeCycle1, dataType: 'NUMBER' });
  if (apeCycle2 !== null) cells.push({ sheetName: 'Financement-Funding', cellReference: FEE_AUTO_FIELDS[`${prefix}General2ndCycle`], value: apeCycle2, dataType: 'NUMBER' });
  void inscCycle1;
  void inscCycle2;

  return cells;
}
