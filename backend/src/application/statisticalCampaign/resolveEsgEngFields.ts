/**
 * Resolution des champs ESG Anglais (Students_ESG_Eng, codes 2200-2232).
 * Miroir de resolveEsgFields pour les eleves anglophones (Form1-UpperSixth).
 */
import type { StatisticalQueryPort } from '@domain/ports/repositories/StatisticalQueryPort';
import { ESG_ENG_FIELD_MAPPING, type EsgEngFieldEntry } from './minesecEsgEngFieldMap';
import { AGE_ENG_LEVEL_COLUMNS, AGE_ENG_ROWS } from './minesecAgeDistributionEngMap';
import type { ChampNonResolu } from './types';
import type { ResolvedCell } from './resolveAutoFields';

interface StudentRow {
  gender: string | null;
  dateOfBirth: Date | null;
  niveau: string;
  serie: string | null;
  filiere: string | null;
  lv2Name: string | null;
}

function studentMatchesEsgEngEntry(student: StudentRow, meta: EsgEngFieldEntry['meta']): boolean {
  if (student.niveau !== meta.niveau) return false;
  switch (meta.track) {
    case 'GENERAL':
      return student.filiere !== 'FR_PEBS' && student.filiere !== 'EN_PEBS';
    case 'BILINGUE':
      return student.filiere === 'FR_PEBS' || student.filiere === 'EN_PEBS';
    case 'SERIE':
      return !meta.serie || student.serie === meta.serie;
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

export async function resolveEsgEngFields(
  query: StatisticalQueryPort,
  schoolId: string,
): Promise<{ cells: ResolvedCell[]; nonCouverts: ChampNonResolu[] }> {
  const allStudents = await query.listerElevesEsg(schoolId);
  const students = allStudents.filter((s) => s.niveau === 'Form1' || s.niveau === 'Form2' || s.niveau === 'Form3' || s.niveau === 'Form4' || s.niveau === 'Form5' || s.niveau === 'LowerSixth' || s.niveau === 'UpperSixth');
  const cells: ResolvedCell[] = [];
  const nonCouverts: ChampNonResolu[] = [];

  for (const entry of ESG_ENG_FIELD_MAPPING) {
    if (entry.kind === 'DIVISIONS') continue;

    if (entry.kind === 'REDOUBLANTS') {
      nonCouverts.push({
        fieldCode: entry.fieldCode,
        sheetName: 'Students_ESG_Eng',
        cellReference: entry.fillesCell ?? '',
        fieldLabel: `Repeaters — ${entry.levelLabel}`,
        raison: "No retention field on StudentProfile in ZekoulABia — structural gap, never deduced from total.",
      });
      continue;
    }

    const matched = students.filter((s) => studentMatchesEsgEngEntry(s, entry.meta));
    const filles = matched.filter((s) => s.gender === 'F' || s.gender === 'FEMALE' || s.gender === 'Fille').length;
    const garcons = matched.filter((s) => s.gender === 'M' || s.gender === 'MALE' || s.gender === 'Garcon').length;

    if (entry.fillesCell) cells.push({ sheetName: 'Students_ESG_Eng', cellReference: entry.fillesCell, value: filles, dataType: 'NUMBER' });
    if (entry.garconsCell) cells.push({ sheetName: 'Students_ESG_Eng', cellReference: entry.garconsCell, value: garcons, dataType: 'NUMBER' });
  }

  // Repartition par age (II.2.1)
  const now = new Date();
  const refYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const referenceDate = new Date(refYear, 8, 1);
  for (const ageRow of AGE_ENG_ROWS) {
    for (const level of AGE_ENG_LEVEL_COLUMNS) {
      const inBucket = students.filter((s) => {
        if (s.niveau !== level.niveau) return false;
        const age = computeAge(s.dateOfBirth, referenceDate);
        if (age === null) return false;
        if (ageRow.ageMin !== null && age < ageRow.ageMin) return false;
        if (ageRow.ageMax !== null && age > ageRow.ageMax) return false;
        return true;
      });
      const filles = inBucket.filter((s) => s.gender === 'F' || s.gender === 'FEMALE' || s.gender === 'Fille').length;
      const garcons = inBucket.filter((s) => s.gender === 'M' || s.gender === 'MALE' || s.gender === 'Garcon').length;
      cells.push({ sheetName: 'Students_ESG_Eng', cellReference: `${level.fillesCol}${ageRow.row}`, value: filles, dataType: 'NUMBER' });
      cells.push({ sheetName: 'Students_ESG_Eng', cellReference: `${level.garconsCol}${ageRow.row}`, value: garcons, dataType: 'NUMBER' });
    }
  }

  return { cells, nonCouverts };
}
