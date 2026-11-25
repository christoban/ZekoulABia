import type {
  SchoolSettingsRepository,
  SchoolSettingsComplets,
} from '@domain/ports/repositories/SchoolSettingsRepository';
import { MINESEC_DEFAULTS } from '@domain/constants/SystemeEducatifCameroun';

export class InMemorySchoolSettingsRepository implements SchoolSettingsRepository {
  private store = new Map<string, SchoolSettingsComplets>();
  dernieresSauvegardes: Partial<SchoolSettingsComplets>[] = [];
  private overrides = new Map<string, string[]>();
  champsMarquesAppels: { schoolId: string; champs: string[] }[] = [];

  definir(schoolId: string, settings: Partial<SchoolSettingsComplets>): void {
    this.store.set(schoolId, {
      schoolId,
      schoolName: 'Lycée Test',
      timezone: MINESEC_DEFAULTS.TIMEZONE,
      locale: MINESEC_DEFAULTS.LOCALE_FR,
      currency: MINESEC_DEFAULTS.CURRENCY,
      logRetentionDays: 90,
      schoolLanguageMode: 'francophone',
      academicCalendarType: 'trimester',
      preferredLanguage: 'fr',
      cycles: ['secondaire_1', 'secondaire_2'],
      hasMultipleCycles: true,
      gradesPerTerm: MINESEC_DEFAULTS.SEQUENCES_PAR_TRIMESTRE,
      termsPerYear: MINESEC_DEFAULTS.TRIMESTRES_PAR_AN,
      passMark: MINESEC_DEFAULTS.SEUIL_PASSAGE_FR,
      councilPassMark: MINESEC_DEFAULTS.SEUIL_PASSAGE_FR,
      maxAbsences: 10,
      attendanceLateAsAbsence: false,
      legalMaxContributionFirstCycle: MINESEC_DEFAULTS.SEUIL_LEGAL_PREMIER_CYCLE,
      legalMaxContributionSecondCycle: MINESEC_DEFAULTS.SEUIL_LEGAL_SECOND_CYCLE,
      bulletinBlockOnUnpaidFees: false,
      smsEnabled: false,
      offlineModeEnabled: true,
      aiAlertsEnabled: true,
      messageModeration: false,
      sequenceCalculationMode: 'single',
      ...settings,
    });
  }

  async getParametresEffectifs(schoolId: string): Promise<SchoolSettingsComplets> {
    const s = this.store.get(schoolId);
    if (!s) throw new Error(`Paramètres introuvables pour : ${schoolId}`);
    return s;
  }

  async sauvegarder(schoolId: string, updates: Partial<SchoolSettingsComplets>): Promise<void> {
    this.dernieresSauvegardes.push({ schoolId, ...updates });
    const existant = this.store.get(schoolId);
    if (existant) {
      this.store.set(schoolId, { ...existant, ...updates });
    }
  }

  async getChampsPersonnalises(schoolId: string): Promise<string[]> {
    return this.overrides.get(schoolId) ?? [];
  }

  async marquerChampsPersonnalises(schoolId: string, champs: string[]): Promise<void> {
    this.champsMarquesAppels.push({ schoolId, champs });
    const existants = this.overrides.get(schoolId) ?? [];
    this.overrides.set(schoolId, [...new Set([...existants, ...champs])]);
  }
}
