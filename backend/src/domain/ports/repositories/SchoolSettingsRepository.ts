/**
 * DOMAIN LAYER — Port Repository SchoolSettings
 * Agrège SchoolSettings + SchoolConfig + School en un seul concept.
 * Corrige le bug : tous les champs doivent être persistés ET lus depuis la DB.
 */
import type {
  SchoolLanguageMode,
  AcademicCalendarType,
  SchoolCycle,
} from '@domain/constants/SystemeEducatifCameroun';

export interface SchoolSettingsComplets {
  schoolId: string;

  // Identité
  schoolName: string;
  schoolMotto?: string;
  schoolLogoUrl?: string;

  // Localisation (toujours lus depuis DB)
  timezone: string;
  locale: string;
  currency: string;
  logRetentionDays: number;

  // Système éducatif (CORRIGÉ : lus depuis DB, pas hardcodés)
  schoolLanguageMode: SchoolLanguageMode;
  academicCalendarType: AcademicCalendarType;
  preferredLanguage: 'fr' | 'en';
  cycles: SchoolCycle[];
  hasMultipleCycles: boolean;

  // Règles académiques MINESEC
  gradesPerTerm: number;        // CORRIGÉ : 2 par défaut (pas 3)
  termsPerYear: number;
  passMark: number;             // 10/20 FR, 40/100 EN
  councilPassMark: number;      // CORRIGÉ : 10 (/20) et non 50 (%)

  // Présences
  maxAbsences: number;
  attendanceLateAsAbsence: boolean;

  // Finances
  legalMaxContributionFirstCycle: number;
  legalMaxContributionSecondCycle: number;
  bulletinBlockOnUnpaidFees: boolean;

  // Fonctionnalités
  smsEnabled: boolean;
  offlineModeEnabled: boolean;
  aiAlertsEnabled: boolean;
  messageModeration: boolean;

  // Calcul des moyennes
  sequenceCalculationMode: 'single' | 'triple' | 'weighted';
}

export interface SchoolSettingsRepository {
  /**
   * Retourne les paramètres effectifs — TOUS lus depuis la DB.
   * Corrige le bug de getEffectiveSchoolSettings (14 champs hardcodés).
   */
  getParametresEffectifs(schoolId: string): Promise<SchoolSettingsComplets>;

  /**
   * Sauvegarde tous les paramètres sur les 3 tables Prisma en transaction.
   */
  sauvegarder(schoolId: string, settings: Partial<SchoolSettingsComplets>): Promise<void>;

  /**
   * Liste des champs SchoolConfig personnalisés localement (registre d'overrides V2.2).
   */
  getChampsPersonnalises(schoolId: string): Promise<string[]>;

  /**
   * Ajoute des champs au registre d'overrides (union, jamais de suppression implicite).
   */
  marquerChampsPersonnalises(schoolId: string, champs: string[]): Promise<void>;
}
