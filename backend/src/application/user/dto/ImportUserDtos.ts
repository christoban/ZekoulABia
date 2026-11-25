export interface ImportErreur {
  ligne: number;
  erreur: string;
}

export interface ImportWarning {
  ligne: number;
  avertissement: string;
}

export interface ImportRow {
  ligne: number;
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  matricule?: string;
  dateNaissance?: string;
  sexe?: string;
  classe?: string;
  nomParent?: string;
  prenomParent?: string;
  emailParent?: string;
  telephoneParent?: string;
  matieres?: string;
  classePrincipale?: string;
  pebs?: string;
  lv2?: string;
}

export type ImportTargetType = 'STUDENT' | 'TEACHER' | 'STAFF' | 'PARENT' | 'CLASSE';

export interface ImportColumnMapping {
  [sourceHeader: string]: string;
}

export interface ImportPreviewRequest {
  file: Buffer;
  targetType: ImportTargetType;
}

export interface ImportPreviewResponse {
  headers: string[];
  autoMapping: ImportColumnMapping;
  targetFields: string[];
  sampleRows: Record<string, string>[];
  totalRows: number;
}

export interface ImportValidateRequest {
  targetType: ImportTargetType;
  rows: Record<string, string>[];
  columnMapping?: ImportColumnMapping;
}

export type RowValidationStatus = 'VALID' | 'ERROR' | 'WARNING';

export interface RowValidationIssue {
  field: string;
  message: string;
}

export interface RowValidationResult {
  ligne: number;
  rawRow: Record<string, string>;
  normalizedRow: Record<string, string>;
  status: RowValidationStatus;
  errors: RowValidationIssue[];
  warnings: RowValidationIssue[];
  resolvedInfo: Record<string, string>;
}

export interface ImportValidateResponse {
  total: number;
  validCount: number;
  errorCount: number;
  warningCount: number;
  validatedRows: RowValidationResult[];
}

export interface ImportConfirmRequest {
  targetType: ImportTargetType;
  confirmedRows: Record<string, string>[];
  columnMapping?: ImportColumnMapping;
}

export interface ImportConfirmResponse {
  total: number;
  success: number;
  professeursPrincipauxAssignes: number;
  affectationsPedagogiquesPreremplies: number;
  classesCrees: number;
  parentsCrees: number;
  staffCrees: number;
  elevesCrees: number;
  enseignantsCrees: number;
  errors: { ligne: number; erreur: string }[];
  warnings: { ligne: number; avertissement: string }[];
}

export interface StudentImportRow {
  matricule?: string;
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  dateNaissance?: string;
  sexe?: string;
  classe?: string;
  nomParent?: string;
  prenomParent?: string;
  emailParent?: string;
  telephoneParent?: string;
  pebs?: string;
  lv2?: string;
}

export interface TeacherImportRow {
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  matieres?: string;
  classePrincipale?: string;
  departementAp?: string;
}

export interface StaffImportRow {
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  fonction: string;
  section?: string;
}

export interface ParentImportRow {
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  matriculesEnfants?: string;
  emailsEnfants?: string;
}

export interface ClasseImportRow {
  nom: string;
  niveau: string;
  serie?: string;
  filiere?: string;
  capacite?: string;
  section?: string;
}

export type ImportRowData =
  | StudentImportRow
  | TeacherImportRow
  | StaffImportRow
  | ParentImportRow
  | ClasseImportRow;