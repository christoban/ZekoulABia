/**
 * Résolution des champs Catégorie A_AUTO pour le rapport MINEDUB primaire — effectifs
 * élèves par niveau/sexe/âge, dérivés de StudentProfile/Class comme pour resolveEsgFields
 * (MINESEC), mais sans distinction série/LV2/PEBS (non pertinente au primaire).
 */
import type { StatisticalQueryPort } from '@domain/ports/repositories/StatisticalQueryPort';
import { NIVEAUX_PRIMAIRES } from '@domain/ports/repositories/StatisticalQueryPort';

export const PRIMARY_LEVELS_FR = ['SIL', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'] as const;
export const PRIMARY_LEVELS_EN = ['Class1', 'Class2', 'Class3', 'Class4', 'Class5', 'Class6'] as const;
export const ALL_PRIMARY_LEVELS = [...PRIMARY_LEVELS_FR, ...PRIMARY_LEVELS_EN];

export interface NiveauEffectif {
  niveau: string;
  filles: number;
  garcons: number;
  total: number;
}

export interface EffectifsParAge {
  ageLabel: string; // ex. "5 ans et moins", "6 ans", ... "12 ans et +"
  filles: number;
  garcons: number;
}

interface PrimaryStudentRow {
  gender: string | null;
  dateOfBirth: Date | null;
  niveau: string;
}

function isFille(gender: string | null): boolean {
  return gender === 'F' || gender === 'FEMALE' || gender === 'Fille';
}
function isGarcon(gender: string | null): boolean {
  return gender === 'M' || gender === 'MALE' || gender === 'Garçon';
}

async function fetchPrimaryStudents(query: StatisticalQueryPort, schoolId: string): Promise<PrimaryStudentRow[]> {
  return query.listerElevesPrimaire(schoolId);
}

export async function resolveEffectifsParNiveau(query: StatisticalQueryPort, schoolId: string): Promise<NiveauEffectif[]> {
  const students = await fetchPrimaryStudents(query, schoolId);
  const levelsPresent = [...new Set(students.map((s) => s.niveau))];
  const orderedLevels = ALL_PRIMARY_LEVELS.filter((l) => levelsPresent.includes(l));

  return orderedLevels.map((niveau) => {
    const inLevel = students.filter((s) => s.niveau === niveau);
    const filles = inLevel.filter((s) => isFille(s.gender)).length;
    const garcons = inLevel.filter((s) => isGarcon(s.gender)).length;
    return { niveau, filles, garcons, total: filles + garcons };
  });
}

const AGE_BRACKETS: { label: string; min: number | null; max: number | null }[] = [
  { label: '5 ans et moins', min: null, max: 5 },
  { label: '6 ans', min: 6, max: 6 },
  { label: '7 ans', min: 7, max: 7 },
  { label: '8 ans', min: 8, max: 8 },
  { label: '9 ans', min: 9, max: 9 },
  { label: '10 ans', min: 10, max: 10 },
  { label: '11 ans', min: 11, max: 11 },
  { label: '12 ans et +', min: 12, max: null },
];

function computeAge(dateOfBirth: Date | null, referenceDate: Date): number | null {
  if (!dateOfBirth) return null;
  let age = referenceDate.getFullYear() - dateOfBirth.getFullYear();
  const m = referenceDate.getMonth() - dateOfBirth.getMonth();
  if (m < 0 || (m === 0 && referenceDate.getDate() < dateOfBirth.getDate())) age--;
  return age;
}

export async function resolveEffectifsParAge(query: StatisticalQueryPort, schoolId: string): Promise<EffectifsParAge[]> {
  const students = await fetchPrimaryStudents(query, schoolId);
  const now = new Date();
  const refYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const referenceDate = new Date(refYear, 8, 1);

  return AGE_BRACKETS.map((bracket) => {
    const inBracket = students.filter((s) => {
      const age = computeAge(s.dateOfBirth, referenceDate);
      if (age === null) return false;
      if (bracket.min !== null && age < bracket.min) return false;
      if (bracket.max !== null && age > bracket.max) return false;
      return true;
    });
    return {
      ageLabel: bracket.label,
      filles: inBracket.filter((s) => isFille(s.gender)).length,
      garcons: inBracket.filter((s) => isGarcon(s.gender)).length,
    };
  });
}

export interface PersonnelPrimaireRow {
  nomComplet: string;
  genre: string | null;
  fonction: string | null;
  typeContrat: string | null;
  diplome: string | null;
}

export async function resolvePersonnelPrimaire(query: StatisticalQueryPort, schoolId: string): Promise<{ rows: PersonnelPrimaireRow[]; champsNonResolus: string[] }> {
  const allStaff = await query.listerPersonnel(schoolId);

  const champsNonResolus: string[] = [];
  if (allStaff.length === 0) {
    champsNonResolus.push('Aucun membre du personnel actif trouvé pour cette école.');
  }

  const rows: PersonnelPrimaireRow[] = allStaff.map((u) => {
    const diplomes = u.employeeFile?.diplomes ?? [];
    const gender = u.employeeFile?.gender;
    if (gender !== 'F' && gender !== 'M') {
      champsNonResolus.push(`Sexe non renseigné pour ${u.lastName} ${u.firstName} — profil RH self-service non complété.`);
    }
    return {
      nomComplet: `${u.lastName} ${u.firstName}`,
      genre: gender === 'F' ? 'Féminin' : gender === 'M' ? 'Masculin' : null,
      fonction: u.staffTitle ?? null,
      typeContrat: u.employeeFile?.typeContrat ?? null,
      diplome: diplomes[0] ? String(diplomes[0]) : null,
    };
  });

  return { rows, champsNonResolus };
}
