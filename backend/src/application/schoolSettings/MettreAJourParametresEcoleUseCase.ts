/**
 * APPLICATION LAYER — Use Case : Mettre à jour les paramètres de l'école
 *
 * Corrections vs controller actuel :
 * - Tous les champs sont réellement persistés en DB (fix du bug)
 * - gradesPerTerm : 2 par défaut (corrigé depuis 3)
 * - councilPassMark : 10/20 (corrigé depuis 50%)
 * - attendanceLateAsAbsence : true par défaut (retard = absence pour le conseil de classe)
 * - Validation MINESEC : cycles, languageMode, seuils légaux
 */
import type { SchoolSettingsRepository } from '@domain/ports/repositories/SchoolSettingsRepository';
import type { SchoolLanguageMode, AcademicCalendarType, SchoolCycle } from '@domain/constants/SystemeEducatifCameroun';
import type { ActivityLogPort } from '@domain/ports/services/ActivityLogPort';
import { MINESEC_DEFAULTS } from '@domain/constants/SystemeEducatifCameroun';
import { extraireChampsConfigModifies } from '@domain/rules/configLocaleTemplate';

export interface MettreAJourParametresCommande {
  schoolId: string;
  demandeurId?: string;
  demandeurRole: string;

  // Identité
  schoolName?: string;
  schoolMotto?: string;
  schoolLogoUrl?: string;

  // Système éducatif
  schoolLanguageMode?: SchoolLanguageMode;
  academicCalendarType?: AcademicCalendarType;
  preferredLanguage?: 'fr' | 'en';
  cycles?: SchoolCycle[];

  // Règles académiques
  passMark?: number;
  councilPassMark?: number;

  // Présences
  maxAbsences?: number;
  attendanceLateAsAbsence?: boolean;

  // Finances
  legalMaxContributionFirstCycle?: number;
  legalMaxContributionSecondCycle?: number;
  bulletinBlockOnUnpaidFees?: boolean;

  // Fonctionnalités
  smsEnabled?: boolean;
  offlineModeEnabled?: boolean;
  aiAlertsEnabled?: boolean;
  messageModeration?: boolean;

  // Localisation
  timezone?: string;
  locale?: string;
  currency?: string;

  // Rétention des logs
  logRetentionDays?: number;
}

const CYCLES_VALIDES: SchoolCycle[] = [
  'maternelle', 'primaire', 'secondaire_1', 'secondaire_2', 'technique',
];

export class MettreAJourParametresEcoleUseCase {
  constructor(
    private readonly settingsRepository: SchoolSettingsRepository,
    private readonly activityLog: ActivityLogPort,
  ) {}

  async execute(commande: MettreAJourParametresCommande): Promise<void> {
    if (commande.demandeurRole !== 'ADMIN') {
      throw new Error("Seul un Admin peut modifier les paramètres de l'établissement");
    }

    if (commande.schoolName !== undefined && !commande.schoolName.trim()) {
      throw new Error("Le nom de l'établissement ne peut pas être vide");
    }

    if (
      commande.academicCalendarType !== undefined &&
      !['trimester', 'semester'].includes(commande.academicCalendarType)
    ) {
      throw new Error('academicCalendarType : "trimester" ou "semester" uniquement');
    }

    if (
      commande.schoolLanguageMode !== undefined &&
      !['francophone', 'anglophone', 'bilingual'].includes(commande.schoolLanguageMode)
    ) {
      throw new Error('schoolLanguageMode invalide');
    }

    if (commande.cycles !== undefined) {
      const invalides = commande.cycles.filter(c => !CYCLES_VALIDES.includes(c));
      if (invalides.length > 0) {
        throw new Error(`Cycles invalides : ${invalides.join(', ')}`);
      }
    }

    if (
      commande.councilPassMark !== undefined &&
      (commande.councilPassMark < 0 || commande.councilPassMark > 20)
    ) {
      throw new Error('councilPassMark doit être entre 0 et 20 (sur 20)');
    }

    if (commande.maxAbsences !== undefined && commande.maxAbsences < 0) {
      throw new Error('maxAbsences doit être ≥ 0');
    }

    if (commande.logRetentionDays !== undefined && commande.logRetentionDays < 1) {
      throw new Error('logRetentionDays doit être supérieur ou égal à 1');
    }

    const { demandeurRole: _, ...settingsAMettreAJour } = commande;

    // Si schoolLanguageMode change, recalculer locale par défaut
    if (commande.schoolLanguageMode && !commande.locale) {
      settingsAMettreAJour.locale =
        commande.schoolLanguageMode === 'anglophone'
          ? MINESEC_DEFAULTS.LOCALE_EN
          : MINESEC_DEFAULTS.LOCALE_FR;
    }

    const avant = await this.settingsRepository.getParametresEffectifs(commande.schoolId).catch(() => null);
    await this.settingsRepository.sauvegarder(commande.schoolId, settingsAMettreAJour);

    // V2.2 : tout champ SchoolConfig modifié devient un override local, jamais écrasé
    // par une future ré-application de template.
    const champsConfigModifies = extraireChampsConfigModifies(commande as unknown as Record<string, unknown>);
    if (champsConfigModifies.length > 0) {
      await this.settingsRepository.marquerChampsPersonnalises(commande.schoolId, champsConfigModifies);
    }

    if (commande.demandeurId) {
      void this.activityLog.log({
        userId: commande.demandeurId,
        schoolId: commande.schoolId,
        action: 'Configuration mise à jour',
        details: JSON.stringify({ avant, apres: settingsAMettreAJour }),
      });
    }
  }
}
