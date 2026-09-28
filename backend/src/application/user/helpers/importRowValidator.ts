import type {
  ImportTargetType,
  RowValidationResult,
  RowValidationIssue,
  RowValidationStatus,
  ImportValidateResponse,
} from '../dto/ImportUserDtos';
import type { ImportContexteValidation } from '@domain/ports/repositories/ImportUtilisateursRepository';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(\+237|237)?[236]\d{7,8}$/;

function parseDateFR(dateStr: string): Date | null {
  const cleaned = dateStr.trim();
  const parts = cleaned.split(/[\/\-\.]/);
  if (parts.length !== 3) return null;

  let day: number, month: number, year: number;

  if (parts[0].length === 4) {
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  } else {
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
  }

  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (year < 1900 || year > new Date().getFullYear() + 1) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim().toLowerCase());
}

function validatePhone(phone: string): boolean {
  return PHONE_REGEX.test(phone.trim().replace(/\s/g, ''));
}

function validateSexe(sexe: string): boolean {
  const v = sexe.trim().toUpperCase();
  return ['M', 'F', 'MALE', 'FEMALE', 'MASCULIN', 'FEMININ', 'FÉMININ', 'HOMME', 'FEMME', 'GARCON', 'GARÇON', 'FILLE'].includes(v);
}

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
        validerStudent(normRow, ligne, errors, warnings, resolvedInfo, contexte, classNames, classByName, lv2Names, seenEmails, seenMatricules, seenPhones);
        break;
      case 'TEACHER':
        validerTeacher(normRow, ligne, errors, warnings, resolvedInfo, contexte, classNames, classByName, subjectNames, apNames, seenEmails, seenPhones);
        break;
      case 'STAFF':
        validerStaff(normRow, ligne, errors, warnings, resolvedInfo, contexte, seenEmails, seenPhones);
        break;
      case 'PARENT':
        validerParent(normRow, ligne, errors, warnings, resolvedInfo, contexte, existingStudents, seenEmails, seenPhones);
        break;
      case 'CLASSE':
        validerClasse(normRow, ligne, errors, warnings, resolvedInfo, contexte, seenMatricules);
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
  ligne: number,
  errors: RowValidationIssue[],
  warnings: RowValidationIssue[],
  resolvedInfo: Record<string, string>,
  contexte: ImportContexteValidation,
  classNames: Set<string>,
  classByName: Map<string, { id: string; name: string; level: string | null; serie: string | null; filiere: string | null; academicYearId: string }>,
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

  if (!nom) errors.push({ field: 'nom', message: 'Nom obligatoire' });
  if (!prenom) errors.push({ field: 'prenom', message: 'Prénom obligatoire' });

  if (email) {
    if (!validateEmail(email)) {
      errors.push({ field: 'email', message: 'Format email invalide' });
    } else if (seenEmails.has(email)) {
      errors.push({ field: 'email', message: `Email "${email}" dupliqué dans le fichier` });
    } else if (contexte.existingParents.has(email)) {
      warnings.push({ field: 'email', message: `Un parent avec l'email "${email}" existe déjà` });
    } else {
      seenEmails.add(email);
    }
  }

  if (telephone) {
    if (!validatePhone(telephone)) {
      errors.push({ field: 'telephone', message: 'Format téléphone invalide (ex: +2376XXXXXXXX)' });
    } else if (seenPhones.has(telephone)) {
      warnings.push({ field: 'telephone', message: `Téléphone "${telephone}" dupliqué` });
    } else {
      seenPhones.add(telephone);
    }
  }

  if (matricule) {
    if (seenMatricules.has(matricule)) {
      errors.push({ field: 'matricule', message: `Matricule "${matricule}" dupliqué dans le fichier` });
    } else {
      seenMatricules.add(matricule);
    }
  }

  if (dateNaissance) {
    const date = parseDateFR(dateNaissance);
    if (!date) {
      errors.push({ field: 'dateNaissance', message: 'Date invalide (format JJ/MM/AAAA ou AAAA-MM-JJ)' });
    }
  }

  if (sexe && !validateSexe(sexe)) {
    errors.push({ field: 'sexe', message: 'Sexe invalide (M ou F)' });
  }

  if (classe) {
    if (!classNames.has(classe)) {
      const suggestions = Array.from(classNames)
        .filter((c) => c.toLowerCase().includes(classe.toLowerCase().slice(0, 3)))
        .slice(0, 3);
      if (suggestions.length > 0) {
        errors.push({ field: 'classe', message: `Classe "${classe}" introuvable. Suggestions : ${suggestions.join(', ')}` });
      } else {
        errors.push({ field: 'classe', message: `Classe "${classe}" introuvable` });
      }
    } else {
      const classInfo = classByName.get(classe);
      if (classInfo) {
        resolvedInfo.classeId = classInfo.id;
        resolvedInfo.classeLevel = classInfo.level ?? 'inconnu';
      }
    }
  }

  if (emailParent) {
    if (!validateEmail(emailParent)) {
      errors.push({ field: 'emailParent', message: 'Format email parent invalide' });
    } else if (contexte.existingParents.has(emailParent)) {
      resolvedInfo.parentUserId = contexte.existingParents.get(emailParent)!;
    }
  }

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
  ligne: number,
  errors: RowValidationIssue[],
  warnings: RowValidationIssue[],
  resolvedInfo: Record<string, string>,
  contexte: ImportContexteValidation,
  classNames: Set<string>,
  classByName: Map<string, { id: string; name: string; level: string | null; serie: string | null; filiere: string | null; academicYearId: string }>,
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

  if (!nom) errors.push({ field: 'nom', message: 'Nom obligatoire' });
  if (!prenom) errors.push({ field: 'prenom', message: 'Prénom obligatoire' });
  if (!email) {
    errors.push({ field: 'email', message: 'Email obligatoire pour les enseignants' });
  } else {
    if (!validateEmail(email)) {
      errors.push({ field: 'email', message: 'Format email invalide' });
    } else if (seenEmails.has(email)) {
      errors.push({ field: 'email', message: `Email "${email}" dupliqué dans le fichier` });
    } else {
      seenEmails.add(email);
    }
  }

  if (telephone) {
    if (!validatePhone(telephone)) {
      errors.push({ field: 'telephone', message: 'Format téléphone invalide' });
    } else if (seenPhones.has(telephone)) {
      warnings.push({ field: 'telephone', message: `Téléphone "${telephone}" dupliqué` });
    } else {
      seenPhones.add(telephone);
    }
  }

  if (matieres) {
    const matiereNames = matieres.split(',').map((m) => m.trim()).filter(Boolean);
    const missing = matiereNames.filter((m) => !subjectNames.has(m));
    if (missing.length > 0) {
      errors.push({ field: 'matieres', message: `Matières introuvables : ${missing.join(', ')}` });
    } else {
      resolvedInfo.subjectIds = 'resolved';
    }
  }

  if (classePrincipale) {
    if (!classNames.has(classePrincipale)) {
      errors.push({ field: 'classePrincipale', message: `Classe "${classePrincipale}" introuvable pour Professeur Principal` });
    } else {
      const classInfo = classByName.get(classePrincipale);
      if (classInfo) {
        resolvedInfo.classePrincipaleId = classInfo.id;
      }
    }
  }

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
  ligne: number,
  errors: RowValidationIssue[],
  warnings: RowValidationIssue[],
  resolvedInfo: Record<string, string>,
  contexte: ImportContexteValidation,
  seenEmails: Set<string>,
  seenPhones: Set<string>
): void {
  const nom = row.nom?.trim();
  const prenom = row.prenom?.trim();
  const email = row.email?.trim().toLowerCase();
  const telephone = row.telephone?.trim();
  const fonction = row.fonction?.trim();
  const section = row.section?.trim();

  if (!nom) errors.push({ field: 'nom', message: 'Nom obligatoire' });
  if (!prenom) errors.push({ field: 'prenom', message: 'Prénom obligatoire' });
  if (!email) {
    errors.push({ field: 'email', message: 'Email obligatoire pour le personnel' });
  } else {
    if (!validateEmail(email)) {
      errors.push({ field: 'email', message: 'Format email invalide' });
    } else if (seenEmails.has(email)) {
      errors.push({ field: 'email', message: `Email "${email}" dupliqué dans le fichier` });
    } else {
      seenEmails.add(email);
    }
  }

  if (telephone) {
    if (!validatePhone(telephone)) {
      errors.push({ field: 'telephone', message: 'Format téléphone invalide' });
    } else if (seenPhones.has(telephone)) {
      warnings.push({ field: 'telephone', message: `Téléphone "${telephone}" dupliqué` });
    } else {
      seenPhones.add(telephone);
    }
  }

  if (!fonction) {
    errors.push({ field: 'fonction', message: 'Fonction/Titre obligatoire pour le personnel (ex: Censeur, Intendant, Surveillant Général)' });
  }

  if (section) {
    resolvedInfo.section = section;
  }
}

function validerParent(
  row: Record<string, string>,
  ligne: number,
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

  if (!nom) errors.push({ field: 'nom', message: 'Nom obligatoire' });
  if (!prenom) errors.push({ field: 'prenom', message: 'Prénom obligatoire' });

  if (!email && !telephone) {
    errors.push({ field: 'contact', message: 'Au moins un contact (email ou téléphone) est requis' });
  }

  if (email) {
    if (!validateEmail(email)) {
      errors.push({ field: 'email', message: 'Format email invalide' });
    } else if (seenEmails.has(email)) {
      errors.push({ field: 'email', message: `Email "${email}" dupliqué dans le fichier` });
    } else if (contexte.existingParents.has(email)) {
      errors.push({ field: 'email', message: `Un parent avec l'email "${email}" existe déjà` });
    } else {
      seenEmails.add(email);
    }
  }

  if (telephone) {
    if (!validatePhone(telephone)) {
      errors.push({ field: 'telephone', message: 'Format téléphone invalide' });
    } else if (seenPhones.has(telephone)) {
      warnings.push({ field: 'telephone', message: `Téléphone "${telephone}" dupliqué` });
    } else {
      seenPhones.add(telephone);
    }
  }

  let enfantsTrouves = 0;
  if (matriculesEnfants) {
    const matricules = matriculesEnfants.split(',').map((m) => m.trim()).filter(Boolean);
    for (const mat of matricules) {
      const studentId = existingStudents.get(mat);
      if (studentId) {
        enfantsTrouves++;
        resolvedInfo[`enfant_${mat}`] = studentId;
      } else {
        warnings.push({ field: 'matriculesEnfants', message: `Élève avec matricule "${mat}" introuvable` });
      }
    }
  }

  if (emailsEnfants) {
    const emails = emailsEnfants.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    for (const em of emails) {
      const studentId = existingStudents.get(em);
      if (studentId) {
        enfantsTrouves++;
        resolvedInfo[`enfant_email_${em}`] = studentId;
      } else {
        warnings.push({ field: 'emailsEnfants', message: `Élève avec email "${em}" introuvable` });
      }
    }
  }

  if (enfantsTrouves === 0 && (matriculesEnfants || emailsEnfants)) {
    warnings.push({ field: 'enfants', message: 'Aucun enfant correspondant trouvé pour ce parent' });
  }
}

function validerClasse(
  row: Record<string, string>,
  ligne: number,
  errors: RowValidationIssue[],
  warnings: RowValidationIssue[],
  resolvedInfo: Record<string, string>,
  contexte: ImportContexteValidation,
  seenMatricules: Set<string>
): void {
  const nom = row.nom?.trim();
  const niveau = row.niveau?.trim();
  const serie = row.serie?.trim();
  const filiere = row.filiere?.trim();
  const capacite = row.capacite?.trim();
  const section = row.section?.trim();

  if (!nom) errors.push({ field: 'nom', message: 'Nom de la classe obligatoire' });

  if (!niveau) {
    errors.push({ field: 'niveau', message: 'Niveau obligatoire (ex: 6e, 5e, 4e, 3e, 2nde, 1ere, Tle)' });
  } else {
    const niveauxValides = ['6e', '5e', '4e', '3e', '2nde', '1ere', '1ère', 'Tle', 'Terminale', 'CP', 'CE1', 'CE2', 'CM1', 'CM2', 'CI', 'CP1', 'CP2', 'Form1', 'Form2', 'Form3', 'Form4', 'Form5', 'LowerSixth', 'UpperSixth'];
    if (!niveauxValides.includes(niveau)) {
      warnings.push({ field: 'niveau', message: `Niveau "${niveau}" non standard. Niveaux attendus : ${niveauxValides.join(', ')}` });
    }
  }

  if (serie) {
    resolvedInfo.serie = serie;
  }

  if (filiere) {
    resolvedInfo.filiere = filiere;
  }

  if (capacite) {
    const cap = parseInt(capacite, 10);
    if (isNaN(cap) || cap < 1 || cap > 200) {
      errors.push({ field: 'capacite', message: 'Capacité invalide (entier entre 1 et 200)' });
    } else {
      resolvedInfo.capacite = String(cap);
    }
  }

  if (section) {
    resolvedInfo.section = section;
  }
}

