/**
 * Export ligne-par-ligne de la feuille Personnels (IV — RECENSEMENT DU PERSONNEL), à partir
 * de la ligne 9 (B9=1, B10=2...), colonnes C à T. Beaucoup de champs RH n'ont pas encore de
 * source fiable dans ZekoulABia (module RH ~10% de complétude) — chaque absence est signalée
 * dans champsNonResolus, JAMAIS inventée. Les champs texte libre (typeContrat, echelonActuel,
 * diplomes) sont passés tels quels avec un avertissement : leur conformité aux listes
 * déroulantes officielles MINESEC n'est pas garantie.
 */
import type { StatisticalQueryPort } from '@domain/ports/repositories/StatisticalQueryPort';
import type { ChampNonResolu } from './types';
import type { ResolvedCell } from './resolveAutoFields';

const FIRST_ROW = 9;
const COLS = {
  matricule: 'C',
  noms: 'D',
  prenoms: 'E',
  dateNaissance: 'F',
  sexe: 'G',
  statut: 'H',
  position: 'I',
  diplomeAcademique: 'J',
  diplomeProfessionnel: 'K',
  disciplineFormation: 'L',
  disciplineEnseignee: 'M',
  grade: 'N',
  fonction: 'O',
  anciennete: 'P',
} as const;

function excelDate(d: Date): number {
  // Base Excel (1900 date system) — jours depuis 1899-12-30
  const epoch = Date.UTC(1899, 11, 30);
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - epoch) / 86400000);
}

export async function resolvePersonnelFields(
  query: StatisticalQueryPort,
  schoolId: string,
): Promise<{ cells: ResolvedCell[]; nonCouverts: ChampNonResolu[] }> {
  const staff = await query.listerPersonnel(schoolId);

  const cells: ResolvedCell[] = [];
  const nonCouverts: ChampNonResolu[] = [];

  staff.forEach((u, idx) => {
    const row = FIRST_ROW + idx;
    const nomComplet = `${u.lastName} ${u.firstName}`;
    const file = u.employeeFile;

    cells.push({ sheetName: 'Personnels', cellReference: `${COLS.noms}${row}`, value: u.lastName ?? '', dataType: 'TEXT' });
    cells.push({ sheetName: 'Personnels', cellReference: `${COLS.prenoms}${row}`, value: u.firstName ?? '', dataType: 'TEXT' });

    if (file?.numeroCNPS) {
      cells.push({ sheetName: 'Personnels', cellReference: `${COLS.matricule}${row}`, value: file.numeroCNPS, dataType: 'TEXT' });
    } else {
      nonCouverts.push({ fieldCode: 'PERSONNEL_MATRICULE', sheetName: 'Personnels', cellReference: `${COLS.matricule}${row}`, fieldLabel: `Matricule — ${nomComplet}`, raison: 'Aucun numéro CNPS renseigné dans la fiche employé.' });
    }

    if (file?.dateNaissance) {
      cells.push({ sheetName: 'Personnels', cellReference: `${COLS.dateNaissance}${row}`, value: excelDate(new Date(file.dateNaissance)), dataType: 'NUMBER' });
    } else {
      nonCouverts.push({ fieldCode: 'PERSONNEL_DATE_NAISSANCE', sheetName: 'Personnels', cellReference: `${COLS.dateNaissance}${row}`, fieldLabel: `Date de naissance — ${nomComplet}`, raison: 'Non renseignée dans la fiche employé (EmployeeFile.dateNaissance).' });
    }

    // Sexe : renseigné via le self-service RH (EmployeeFile.gender, ajouté le 13/07/2026 —
    // gap structurel résolu, voir chantier "Module RH self-service").
    if (file?.gender === 'F' || file?.gender === 'M') {
      cells.push({ sheetName: 'Personnels', cellReference: `${COLS.sexe}${row}`, value: file.gender === 'F' ? 'Féminin' : 'Masculin', dataType: 'TEXT' });
    } else {
      nonCouverts.push({ fieldCode: 'PERSONNEL_SEXE', sheetName: 'Personnels', cellReference: `${COLS.sexe}${row}`, fieldLabel: `Sexe — ${nomComplet}`, raison: "Non renseigné — l'employé n'a pas encore complété son profil RH self-service." });
    }

    if (file?.typeContrat) {
      cells.push({ sheetName: 'Personnels', cellReference: `${COLS.statut}${row}`, value: file.typeContrat, dataType: 'TEXT' });
    } else {
      nonCouverts.push({ fieldCode: 'PERSONNEL_STATUT', sheetName: 'Personnels', cellReference: `${COLS.statut}${row}`, fieldLabel: `Statut — ${nomComplet}`, raison: 'Type de contrat non renseigné (EmployeeFile.typeContrat).' });
    }

    const diplomes = file?.diplomes ?? [];
    if (diplomes[0]) {
      cells.push({ sheetName: 'Personnels', cellReference: `${COLS.diplomeAcademique}${row}`, value: String(diplomes[0]), dataType: 'TEXT' });
    } else {
      nonCouverts.push({ fieldCode: 'PERSONNEL_DIPLOME_ACAD', sheetName: 'Personnels', cellReference: `${COLS.diplomeAcademique}${row}`, fieldLabel: `Diplôme académique — ${nomComplet}`, raison: 'Aucun diplôme renseigné dans la fiche employé.' });
    }

    const disciplineEnseignee = u.specialization?.length > 0 ? u.specialization[0] : null;
    if (disciplineEnseignee) {
      cells.push({ sheetName: 'Personnels', cellReference: `${COLS.disciplineEnseignee}${row}`, value: disciplineEnseignee, dataType: 'TEXT' });
    } else {
      nonCouverts.push({ fieldCode: 'PERSONNEL_DISCIPLINE', sheetName: 'Personnels', cellReference: `${COLS.disciplineEnseignee}${row}`, fieldLabel: `Discipline enseignée — ${nomComplet}`, raison: 'Aucune spécialisation renseignée (TeacherProfile.specialization).' });
    }

    if (file?.echelonActuel) {
      cells.push({ sheetName: 'Personnels', cellReference: `${COLS.grade}${row}`, value: file.echelonActuel, dataType: 'TEXT' });
    } else {
      nonCouverts.push({ fieldCode: 'PERSONNEL_GRADE', sheetName: 'Personnels', cellReference: `${COLS.grade}${row}`, fieldLabel: `Grade — ${nomComplet}`, raison: 'Échelon non renseigné (EmployeeFile.echelonActuel).' });
    }

    if (u.staffTitle) {
      cells.push({ sheetName: 'Personnels', cellReference: `${COLS.fonction}${row}`, value: u.staffTitle, dataType: 'TEXT' });
    }

    if (file?.dateEmbauche) {
      const years = (Date.now() - new Date(file.dateEmbauche).getTime()) / (365.25 * 86400000);
      cells.push({ sheetName: 'Personnels', cellReference: `${COLS.anciennete}${row}`, value: Math.floor(years), dataType: 'NUMBER' });
    } else {
      nonCouverts.push({ fieldCode: 'PERSONNEL_ANCIENNETE', sheetName: 'Personnels', cellReference: `${COLS.anciennete}${row}`, fieldLabel: `Ancienneté — ${nomComplet}`, raison: "Date d'embauche non renseignée (EmployeeFile.dateEmbauche)." });
    }

    // Heures hebdomadaires effectivement assurées (S/T) : aucune source fiable actuelle
    // (nécessiterait un calcul depuis Timetable/TimetableSlot, hors périmètre de cette phase).
    nonCouverts.push({ fieldCode: 'PERSONNEL_HEURES_1ER', sheetName: 'Personnels', cellReference: `S${row}`, fieldLabel: `Heures hebdo 1er cycle — ${nomComplet}`, raison: "Non calculé dans cette phase (nécessiterait une agrégation depuis l'emploi du temps)." });
  });

  return { cells, nonCouverts };
}
