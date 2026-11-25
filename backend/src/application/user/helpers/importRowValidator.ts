import type {
  ImportTargetType,
  RowValidationResult,
  RowValidationIssue,
  RowValidationStatus,
  ImportValidateResponse,
} from '../dto/ImportUserDtos';
import type { ImportContexteValidation } from '@domain/ports/repositories/ImportUtilisateursRepository';
import {
  parseDateFR,
  validateSexe,
  validerIdentiteBase,
  validerEmailChamp,
  validerTelephoneChamp,
  validerClasseStudent,
  validerEmailParentStudent,
  validerMatieresTeacher,
  validerClassePrincipaleTeacher,
  validerEnfantsParent,
  validerChampsClasse,
  type ClassInfoRef,
} from './importRowFieldValidators';

export function validerLignesImport(
  targetType: ImportTargetType,
  rows: Record<string, string>[],
  contexte: ImportContexteValidation,
  rawRows?: Record<string, string>[]
): ImportValidateResponse {
  const validatedRows: RowValidationResult[] = [];
  let validCount = 0;
  let errorCount = 0;
  let warningCount = 0;

  const classNames = new Set(contexte.classes.map((c) => c.name));
  const classByName = new Map(contexte.classes.map((c) => [c.name, c]));
  const subjectNames = new Set(contexte.subjects.map((s) => s.name));
  const lv2Names = new Set(contexte.lv2Subjects.map((s) => s.name));
  const apNames = new Set(contexte.departementsAp.map((d) => d.name));

  const existingStudents = new Map<string, string>();
  for (const student of contexte.existingStudents) {
    if (student.matricule) existingStudents.set(student.matricule, student.id);
    if (student.email) existingStudents.set(student.email.toLowerCase(), student.id);
  }

  const seenEmails = new Set<string>();
  const seenMatricules = new Set<string>();
  const seenPhones = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const normRow = rows[i];
    const originalRaw = rawRows && rawRows[i] ? rawRows[i] : {};
    const enrichedRawRow = { ...normRow, ...originalRaw };
    const ligne = i + 1;
    const errors: RowValidationIssue[] = [];
    const warnings: RowValidationIssue[] = [];
    const resolvedInfo: Record<string, string> = {};

    switch (targetType) {
      case 'STUDENT':
        validerStudent(normRow, errors, warnings, resolvedInfo, contexte, classNames, classByName, lv2Names, seenEmails, seenMatricules, seenPhones);
        break;
      case 'TEACHER':
        validerTeacher(normRow, errors, warnings, resolvedInfo, classNames, classByName, subjectNames, apNames, seenEmails, seenPhones);
        break;
      case 'STAFF':
        validerStaff(normRow, errors, warnings, resolvedInfo, seenEmails, seenPhones);
        break;
      case 'PARENT':
        validerParent(normRow, errors, warnings, resolvedInfo, contexte, existingStudents, seenEmails, seenPhones);
        break;
      case 'CLASSE':
        validerChampsClasse(normRow, errors, warnings, resolvedInfo);
        break;
    }

    let status: RowValidationStatus = 'VALID';
    if (errors.length > 0) {
      status = 'ERROR';
      errorCount++;
    } else if (warnings.length > 0) {
      status = 'WARNING';
      warningCount++;
    } else {
      validCount++;
    }

    validatedRows.push({
      ligne,
      rawRow: enrichedRawRow,
      normalizedRow: normRow,
      status,
      errors,
      warnings,
      resolvedInfo,
    });
  }

  return {
    total: rows.length,
    validCount,
    errorCount,
    warningCount,
    validatedRows,
  };
}

function validerStudent(
  row: Record<string, string>,
  errors: RowValidationIssue[],
  warnings: RowValidationIssue[],
  resolvedInfo: Record<string, string>,
  contexte: ImportContexteValidation,
  classNames: Set<string>,
  classByName: Map<string, ClassInfoRef>,
  lv2Names: Set<string>,
  seenEmails: Set<string>,
  seenMatricules: Set<string>,
  seenPhones: Set<string>
): void {
  const nom = row.nom?.trim();
  const prenom = row.prenom?.trim();
  const email = row.email?.trim().toLowerCase();
  const telephone = row.telephone?.trim();
  const matricule = row.matricule?.trim();
  const dateNaissance = row.dateNaissance?.trim();
  const sexe = row.sexe?.trim();
  const classe = row.classe?.trim();
  const emailParent = row.emailParent?.trim().toLowerCase();
  const lv2 = row.lv2?.trim();
  const pebs = row.pebs?.trim().toUpperCase();

  validerIdentiteBase(nom, prenom, errors);

  validerEmailChamp({
    email,
    existingParents: contexte.existingParents,
    existingParentSeverity: 'warning',
    errors,
    warnings,
    seenEmails,
  });

  validerTelephoneChamp(telephone, errors, warnings, seenPhones, 'Format téléphone invalide (ex: +2376XXXXXXXX)');

  if (matricule) {
    if (seenMatricules.has(matricule)) {
      errors.push({ field: 'matricule', message: `Matricule "${matricule}" dupliqué dans le fichier` });
    } else {
      seenMatricules.add(matricule);
    }
  }

  if (dateNaissance && !parseDateFR(dateNaissance)) {
    errors.push({ field: 'dateNaissance', message: 'Date invalide (format JJ/MM/AAAA ou AAAA-MM-JJ)' });
  }

  if (sexe && !validateSexe(sexe)) {
    errors.push({ field: 'sexe', message: 'Sexe invalide (M ou F)' });
  }

  validerClasseStudent(classe, classNames, classByName, errors, resolvedInfo);
  validerEmailParentStudent(emailParent, contexte.existingParents, errors, resolvedInfo);

  if (lv2 && !lv2Names.has(lv2)) {
    errors.push({ field: 'lv2', message: `Langue LV2 "${lv2}" non disponible dans cet établissement` });
  }

  if (pebs && !['FR_PEBS', 'EN_PEBS'].includes(pebs)) {
    errors.push({ field: 'pebs', message: `Valeur PEBS invalide : "${pebs}" (attendu FR_PEBS ou EN_PEBS)` });
  }

  if (!email && !telephone) {
    errors.push({ field: 'contact', message: 'Au moins un contact (email ou téléphone) est requis' });
  }
}

function validerTeacher(
  row: Record<string, string>,
  errors: RowValidationIssue[],
  warnings: RowValidationIssue[],
  resolvedInfo: Record<string, string>,
  classNames: Set<string>,
  classByName: Map<string, ClassInfoRef>,
  subjectNames: Set<string>,
  apNames: Set<string>,
  seenEmails: Set<string>,
  seenPhones: Set<string>
): void {
  const nom = row.nom?.trim();
  const prenom = row.prenom?.trim();
  const email = row.email?.trim().toLowerCase();
  const telephone = row.telephone?.trim();
  const matieres = row.matieres?.trim();
  const classePrincipale = row.classePrincipale?.trim();
  const departementAp = row.departementAp?.trim();

  validerIdentiteBase(nom, prenom, errors);

  validerEmailChamp({
    email,
    requiredMessage: 'Email obligatoire pour les enseignants',
    errors,
    warnings,
    seenEmails,
  });

  validerTelephoneChamp(telephone, errors, warnings, seenPhones, 'Format téléphone invalide');
  validerMatieresTeacher(matieres, subjectNames, errors, resolvedInfo);
  validerClassePrincipaleTeacher(classePrincipale, classNames, classByName, errors, resolvedInfo);

  if (departementAp) {
    if (!apNames.has(departementAp)) {
      warnings.push({ field: 'departementAp', message: `Département AP "${departementAp}" non trouvé` });
    } else {
      resolvedInfo.departementApId = 'resolved';
    }
  }
}

function validerStaff(
  row: Record<string, string>,
  errors: RowValidationIssue[],
  warnings: RowValidationIssue[],
  resolvedInfo: Record<string, string>,
  seenEmails: Set<string>,
  seenPhones: Set<string>
): void {
  const nom = row.nom?.trim();
  const prenom = row.prenom?.trim();
  const email = row.email?.trim().toLowerCase();
  const telephone = row.telephone?.trim();
  const fonction = row.fonction?.trim();
  const section = row.section?.trim();

  validerIdentiteBase(nom, prenom, errors);

  validerEmailChamp({
    email,
    requiredMessage: 'Email obligatoire pour le personnel',
    errors,
    warnings,
    seenEmails,
  });

  validerTelephoneChamp(telephone, errors, warnings, seenPhones, 'Format téléphone invalide');

  if (!fonction) {
    errors.push({ field: 'fonction', message: 'Fonction/Titre obligatoire pour le personnel (ex: Censeur, Intendant, Surveillant Général)' });
  }

  if (section) {
    resolvedInfo.section = section;
  }
}

function validerParent(
  row: Record<string, string>,
  errors: RowValidationIssue[],
  warnings: RowValidationIssue[],
  resolvedInfo: Record<string, string>,
  contexte: ImportContexteValidation,
  existingStudents: Map<string, string>,
  seenEmails: Set<string>,
  seenPhones: Set<string>
): void {
  const nom = row.nom?.trim();
  const prenom = row.prenom?.trim();
  const email = row.email?.trim().toLowerCase();
  const telephone = row.telephone?.trim();
  const matriculesEnfants = row.matriculesEnfants?.trim();
  const emailsEnfants = row.emailsEnfants?.trim().toLowerCase();

  validerIdentiteBase(nom, prenom, errors);

  if (!email && !telephone) {
    errors.push({ field: 'contact', message: 'Au moins un contact (email ou téléphone) est requis' });
  }

  validerEmailChamp({
    email,
    existingParents: contexte.existingParents,
    existingParentSeverity: 'error',
    errors,
    warnings,
    seenEmails,
  });

  validerTelephoneChamp(telephone, errors, warnings, seenPhones, 'Format téléphone invalide');
  validerEnfantsParent(matriculesEnfants, emailsEnfants, existingStudents, warnings, resolvedInfo);
}
