import type { RowValidationIssue } from '../dto/ImportUserDtos';
import type { ImportContexteValidation } from '@domain/ports/repositories/ImportUtilisateursRepository';

export type ClassInfoRef = ImportContexteValidation['classes'][number];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(\+237|237)?[236]\d{7,8}$/;

const NIVEAUX_CLASSE_VALIDES = [
  '6e', '5e', '4e', '3e', '2nde', '1ere', '1ère', 'Tle', 'Terminale',
  'CP', 'CE1', 'CE2', 'CM1', 'CM2', 'CI', 'CP1', 'CP2',
  'Form1', 'Form2', 'Form3', 'Form4', 'Form5', 'LowerSixth', 'UpperSixth',
];

export function parseDateFR(dateStr: string): Date | null {
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

export function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim().toLowerCase());
}

export function validatePhone(phone: string): boolean {
  return PHONE_REGEX.test(phone.trim().replace(/\s/g, ''));
}

export function validateSexe(sexe: string): boolean {
  const v = sexe.trim().toUpperCase();
  return ['M', 'F', 'MALE', 'FEMALE', 'MASCULIN', 'FEMININ', 'FÉMININ', 'HOMME', 'FEMME', 'GARCON', 'GARÇON', 'FILLE'].includes(v);
}

export function validerIdentiteBase(
  nom: string | undefined,
  prenom: string | undefined,
  errors: RowValidationIssue[],
): void {
  if (!nom) errors.push({ field: 'nom', message: 'Nom obligatoire' });
  if (!prenom) errors.push({ field: 'prenom', message: 'Prénom obligatoire' });
}

export function validerEmailChamp(opts: {
  email: string | undefined;
  requiredMessage?: string;
  existingParents?: Map<string, string>;
  existingParentSeverity?: 'warning' | 'error';
  errors: RowValidationIssue[];
  warnings: RowValidationIssue[];
  seenEmails: Set<string>;
}): void {
  const { email, requiredMessage, existingParents, existingParentSeverity, errors, warnings, seenEmails } = opts;
  if (!email) {
    if (requiredMessage) errors.push({ field: 'email', message: requiredMessage });
    return;
  }
  if (!validateEmail(email)) {
    errors.push({ field: 'email', message: 'Format email invalide' });
  } else if (seenEmails.has(email)) {
    errors.push({ field: 'email', message: `Email "${email}" dupliqué dans le fichier` });
  } else if (existingParents?.has(email)) {
    const issue: RowValidationIssue = { field: 'email', message: `Un parent avec l'email "${email}" existe déjà` };
    if (existingParentSeverity === 'error') {
      errors.push(issue);
    } else {
      warnings.push(issue);
    }
  } else {
    seenEmails.add(email);
  }
}

export function validerTelephoneChamp(
  telephone: string | undefined,
  errors: RowValidationIssue[],
  warnings: RowValidationIssue[],
  seenPhones: Set<string>,
  invalidMessage: string,
): void {
  if (!telephone) return;
  if (!validatePhone(telephone)) {
    errors.push({ field: 'telephone', message: invalidMessage });
  } else if (seenPhones.has(telephone)) {
    warnings.push({ field: 'telephone', message: `Téléphone "${telephone}" dupliqué` });
  } else {
    seenPhones.add(telephone);
  }
}

export function validerClasseStudent(
  classe: string | undefined,
  classNames: Set<string>,
  classByName: Map<string, ClassInfoRef>,
  errors: RowValidationIssue[],
  resolvedInfo: Record<string, string>,
): void {
  if (!classe) return;
  if (!classNames.has(classe)) {
    const suggestions = Array.from(classNames)
      .filter((c) => c.toLowerCase().includes(classe.toLowerCase().slice(0, 3)))
      .slice(0, 3);
    if (suggestions.length > 0) {
      errors.push({ field: 'classe', message: `Classe "${classe}" introuvable. Suggestions : ${suggestions.join(', ')}` });
    } else {
      errors.push({ field: 'classe', message: `Classe "${classe}" introuvable` });
    }
    return;
  }
  const classInfo = classByName.get(classe);
  if (classInfo) {
    resolvedInfo.classeId = classInfo.id;
    resolvedInfo.classeLevel = classInfo.level ?? 'inconnu';
  }
}

export function validerEmailParentStudent(
  emailParent: string | undefined,
  existingParents: Map<string, string>,
  errors: RowValidationIssue[],
  resolvedInfo: Record<string, string>,
): void {
  if (!emailParent) return;
  if (!validateEmail(emailParent)) {
    errors.push({ field: 'emailParent', message: 'Format email parent invalide' });
  } else if (existingParents.has(emailParent)) {
    resolvedInfo.parentUserId = existingParents.get(emailParent)!;
  }
}

export function validerMatieresTeacher(
  matieres: string | undefined,
  subjectNames: Set<string>,
  errors: RowValidationIssue[],
  resolvedInfo: Record<string, string>,
): void {
  if (!matieres) return;
  const matiereNames = matieres.split(',').map((m) => m.trim()).filter(Boolean);
  const missing = matiereNames.filter((m) => !subjectNames.has(m));
  if (missing.length > 0) {
    errors.push({ field: 'matieres', message: `Matières introuvables : ${missing.join(', ')}` });
  } else {
    resolvedInfo.subjectIds = 'resolved';
  }
}

export function validerClassePrincipaleTeacher(
  classePrincipale: string | undefined,
  classNames: Set<string>,
  classByName: Map<string, ClassInfoRef>,
  errors: RowValidationIssue[],
  resolvedInfo: Record<string, string>,
): void {
  if (!classePrincipale) return;
  if (!classNames.has(classePrincipale)) {
    errors.push({ field: 'classePrincipale', message: `Classe "${classePrincipale}" introuvable pour Professeur Principal` });
    return;
  }
  const classInfo = classByName.get(classePrincipale);
  if (classInfo) {
    resolvedInfo.classePrincipaleId = classInfo.id;
  }
}

export function validerEnfantsParent(
  matriculesEnfants: string | undefined,
  emailsEnfants: string | undefined,
  existingStudents: Map<string, string>,
  warnings: RowValidationIssue[],
  resolvedInfo: Record<string, string>,
): void {
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

export function validerChampsClasse(
  row: Record<string, string>,
  errors: RowValidationIssue[],
  warnings: RowValidationIssue[],
  resolvedInfo: Record<string, string>,
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
  } else if (!NIVEAUX_CLASSE_VALIDES.includes(niveau)) {
    warnings.push({ field: 'niveau', message: `Niveau "${niveau}" non standard. Niveaux attendus : ${NIVEAUX_CLASSE_VALIDES.join(', ')}` });
  }

  if (serie) resolvedInfo.serie = serie;
  if (filiere) resolvedInfo.filiere = filiere;

  if (capacite) {
    const cap = parseInt(capacite, 10);
    if (isNaN(cap) || cap < 1 || cap > 200) {
      errors.push({ field: 'capacite', message: 'Capacité invalide (entier entre 1 et 200)' });
    } else {
      resolvedInfo.capacite = String(cap);
    }
  }

  if (section) resolvedInfo.section = section;
}
