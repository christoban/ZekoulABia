import type { PrismaClient } from '@prisma/client';
import type {
  SchoolSettingsRepository,
  SchoolSettingsComplets,
} from '@domain/ports/repositories/SchoolSettingsRepository';
import { MINESEC_DEFAULTS } from '@domain/constants/SystemeEducatifCameroun';
import type { SchoolLanguageMode, SchoolCycle } from '@domain/constants/SystemeEducatifCameroun';
import { ajouterOverrides } from '@domain/rules/configLocaleTemplate';

export class PrismaSchoolSettingsRepository implements SchoolSettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getParametresEffectifs(schoolId: string): Promise<SchoolSettingsComplets> {
    const [school, settings, config] = await Promise.all([
      this.prisma.school.findUnique({
        where: { id: schoolId },
        select: { name: true, logoUrl: true },
      }),
      this.prisma.schoolSettings.findUnique({ where: { schoolId } }),
      this.prisma.schoolConfig.findUnique({ where: { schoolId } }),
    ]);

    return {
      schoolId,

      schoolName: school?.name ?? 'ZekoulABia',
      schoolLogoUrl: school?.logoUrl ?? undefined,

      timezone: settings?.timezone ?? MINESEC_DEFAULTS.TIMEZONE,
      locale: settings?.locale ?? MINESEC_DEFAULTS.LOCALE_FR,
      currency: settings?.currency ?? MINESEC_DEFAULTS.CURRENCY,
      logRetentionDays: settings?.logRetentionDays ?? 90,

      // Champs lus depuis DB (corrige le bug des valeurs hardcodées)
      schoolLanguageMode: (config?.schoolLanguageMode ?? 'francophone') as SchoolLanguageMode,
      academicCalendarType: 'trimester',
      preferredLanguage: settings?.locale?.startsWith('en') ? 'en' : 'fr',
      cycles: ['secondaire_1', 'secondaire_2'] as SchoolCycle[],
      hasMultipleCycles: true,

      gradesPerTerm: config?.gradesPerTerm ?? MINESEC_DEFAULTS.SEQUENCES_PAR_TRIMESTRE,
      termsPerYear: config?.termsPerYear ?? MINESEC_DEFAULTS.TRIMESTRES_PAR_AN,
      passMark: config?.passMark ?? MINESEC_DEFAULTS.SEUIL_PASSAGE_FR,
      councilPassMark: config?.councilPassMark ?? MINESEC_DEFAULTS.SEUIL_PASSAGE_FR,

      maxAbsences: config?.maxAbsences ?? 10,
      attendanceLateAsAbsence: config?.attendanceLateAsAbsence ?? true,

      legalMaxContributionFirstCycle:
        config?.legalMaxContributionFirstCycle ?? MINESEC_DEFAULTS.SEUIL_LEGAL_PREMIER_CYCLE,
      legalMaxContributionSecondCycle:
        config?.legalMaxContributionSecondCycle ?? MINESEC_DEFAULTS.SEUIL_LEGAL_SECOND_CYCLE,
      bulletinBlockOnUnpaidFees: config?.bulletinBlockOnUnpaidFees ?? false,

      smsEnabled: config?.smsEnabled ?? false,
      offlineModeEnabled: config?.offlineModeEnabled ?? true,
      aiAlertsEnabled: config?.aiAlertsEnabled ?? true,
      messageModeration: config?.messageModeration ?? false,
      sequenceCalculationMode: (config?.sequenceCalculationMode ?? 'single') as 'single' | 'triple' | 'weighted',
    };
  }

  async sauvegarder(
    schoolId: string,
    updates: Partial<SchoolSettingsComplets>
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (updates.schoolName !== undefined || updates.schoolLogoUrl !== undefined) {
        await tx.school.update({
          where: { id: schoolId },
          data: {
            ...(updates.schoolName && { name: updates.schoolName }),
            ...(updates.schoolLogoUrl !== undefined && { logoUrl: updates.schoolLogoUrl }),
          },
        });
      }

      await tx.schoolSettings.upsert({
        where: { schoolId },
        create: {
          schoolId,
          timezone: updates.timezone ?? MINESEC_DEFAULTS.TIMEZONE,
          locale: updates.locale ?? MINESEC_DEFAULTS.LOCALE_FR,
          currency: updates.currency ?? MINESEC_DEFAULTS.CURRENCY,
          logRetentionDays: updates.logRetentionDays ?? 90,
        },
        update: {
          ...(updates.timezone && { timezone: updates.timezone }),
          ...(updates.locale && { locale: updates.locale }),
          ...(updates.currency && { currency: updates.currency }),
          ...(updates.logRetentionDays !== undefined && { logRetentionDays: updates.logRetentionDays }),
        },
      });

      await tx.schoolConfig.upsert({
        where: { schoolId },
        create: {
          schoolId,
          gradesPerTerm: updates.gradesPerTerm ?? MINESEC_DEFAULTS.SEQUENCES_PAR_TRIMESTRE,
          termsPerYear: updates.termsPerYear ?? MINESEC_DEFAULTS.TRIMESTRES_PAR_AN,
          maxAbsences: updates.maxAbsences ?? 10,
          smsEnabled: updates.smsEnabled ?? false,
          offlineModeEnabled: updates.offlineModeEnabled ?? true,
          aiAlertsEnabled: updates.aiAlertsEnabled ?? true,
          messageModeration: updates.messageModeration ?? false,
          legalMaxContributionFirstCycle:
            updates.legalMaxContributionFirstCycle ?? MINESEC_DEFAULTS.SEUIL_LEGAL_PREMIER_CYCLE,
          legalMaxContributionSecondCycle:
            updates.legalMaxContributionSecondCycle ?? MINESEC_DEFAULTS.SEUIL_LEGAL_SECOND_CYCLE,
          ...(updates.schoolLanguageMode && { schoolLanguageMode: updates.schoolLanguageMode }),
          ...(updates.attendanceLateAsAbsence !== undefined && {
            attendanceLateAsAbsence: updates.attendanceLateAsAbsence,
          }),
          ...(updates.bulletinBlockOnUnpaidFees !== undefined && {
            bulletinBlockOnUnpaidFees: updates.bulletinBlockOnUnpaidFees,
          }),
          ...(updates.passMark !== undefined && { passMark: updates.passMark }),
          ...(updates.councilPassMark !== undefined && { councilPassMark: updates.councilPassMark }),
        },
        update: {
          ...(updates.gradesPerTerm !== undefined && { gradesPerTerm: updates.gradesPerTerm }),
          ...(updates.termsPerYear !== undefined && { termsPerYear: updates.termsPerYear }),
          ...(updates.maxAbsences !== undefined && { maxAbsences: updates.maxAbsences }),
          ...(updates.smsEnabled !== undefined && { smsEnabled: updates.smsEnabled }),
          ...(updates.offlineModeEnabled !== undefined && {
            offlineModeEnabled: updates.offlineModeEnabled,
          }),
          ...(updates.aiAlertsEnabled !== undefined && { aiAlertsEnabled: updates.aiAlertsEnabled }),
          ...(updates.messageModeration !== undefined && {
            messageModeration: updates.messageModeration,
          }),
          ...(updates.legalMaxContributionFirstCycle !== undefined && {
            legalMaxContributionFirstCycle: updates.legalMaxContributionFirstCycle,
          }),
          ...(updates.legalMaxContributionSecondCycle !== undefined && {
            legalMaxContributionSecondCycle: updates.legalMaxContributionSecondCycle,
          }),
          ...(updates.schoolLanguageMode && { schoolLanguageMode: updates.schoolLanguageMode }),
          ...(updates.attendanceLateAsAbsence !== undefined && {
            attendanceLateAsAbsence: updates.attendanceLateAsAbsence,
          }),
          ...(updates.bulletinBlockOnUnpaidFees !== undefined && {
            bulletinBlockOnUnpaidFees: updates.bulletinBlockOnUnpaidFees,
          }),
          ...(updates.passMark !== undefined && { passMark: updates.passMark }),
          ...(updates.councilPassMark !== undefined && { councilPassMark: updates.councilPassMark }),
        },
      });
    });
  }

  async getChampsPersonnalises(schoolId: string): Promise<string[]> {
    const config = await this.prisma.schoolConfig.findUnique({
      where: { schoolId },
      select: { configOverrides: true },
    });
    const overrides = config?.configOverrides;
    if (Array.isArray(overrides)) {
      return overrides.filter((c): c is string => typeof c === 'string');
    }
    return [];
  }

  async marquerChampsPersonnalises(schoolId: string, champs: string[]): Promise<void> {
    const existants = await this.getChampsPersonnalises(schoolId);
    const fusionnes = ajouterOverrides(existants, champs);
    await this.prisma.schoolConfig.upsert({
      where: { schoolId },
      create: { schoolId, configOverrides: fusionnes },
      update: { configOverrides: fusionnes },
    });
  }
}
