import { prisma } from "../../../config/prisma.ts";

export const DEFAULT_SCHOOL_SETTINGS = {
  schoolName: "ZEKOULABIA Education",
  schoolMotto: "Excellence in Education & Innovation",
  schoolLogoUrl: "",
  academicCalendarType: "trimester" as "trimester" | "semester",
  preferredLanguage: "fr" as "fr" | "en",
  schoolLanguageMode: "francophone" as "anglophone" | "francophone" | "bilingual",
  mode: "simple_fr" as "simple_fr" | "simple_en" | "bilingual" | "complex",
  cycles: ["secondaire_1", "secondaire_2"] as Array<
    "maternelle" | "primaire" | "secondaire_1" | "secondaire_2" | "technique"
  >,
  hasMultipleCycles: true,
  officialLanguages: ["fr"],
  attendanceLateAsAbsence: true,
  attendanceExcusedCountsAsAbsence: false,
  councilDecisionMode: "automatic" as "manual" | "automatic",
  councilPassAverageThreshold: 50,
  councilMaxAbsences: 10,
  bulletinBlockOnUnpaidFees: false,
  bulletinAllowedOutstandingBalance: 0,
};

export const getEffectiveSchoolSettings = async (schoolId?: string | null) => {
  const settings = schoolId
    ? await prisma.schoolSettings.findFirst({ where: { schoolId } })
    : await prisma.schoolSettings.findFirst();

  const schoolConfig = schoolId
    ? await prisma.schoolConfig.findFirst({ where: { schoolId } })
    : await prisma.schoolConfig.findFirst();

  const school = schoolId ? await prisma.school.findUnique({ where: { id: schoolId } }) : undefined;

  return {
    schoolName: school?.name || DEFAULT_SCHOOL_SETTINGS.schoolName,
    schoolMotto: DEFAULT_SCHOOL_SETTINGS.schoolMotto,
    schoolLogoUrl: school?.logoUrl || DEFAULT_SCHOOL_SETTINGS.schoolLogoUrl,
    academicCalendarType: DEFAULT_SCHOOL_SETTINGS.academicCalendarType,
    preferredLanguage: DEFAULT_SCHOOL_SETTINGS.preferredLanguage,
    schoolLanguageMode: DEFAULT_SCHOOL_SETTINGS.schoolLanguageMode,
    mode: DEFAULT_SCHOOL_SETTINGS.mode,
    cycles: DEFAULT_SCHOOL_SETTINGS.cycles,
    hasMultipleCycles: DEFAULT_SCHOOL_SETTINGS.hasMultipleCycles,
    officialLanguages: DEFAULT_SCHOOL_SETTINGS.officialLanguages,
    attendanceLateAsAbsence: DEFAULT_SCHOOL_SETTINGS.attendanceLateAsAbsence,
    attendanceExcusedCountsAsAbsence: DEFAULT_SCHOOL_SETTINGS.attendanceExcusedCountsAsAbsence,
    councilDecisionMode: DEFAULT_SCHOOL_SETTINGS.councilDecisionMode,
    councilPassAverageThreshold: DEFAULT_SCHOOL_SETTINGS.councilPassAverageThreshold,
    councilMaxAbsences: DEFAULT_SCHOOL_SETTINGS.councilMaxAbsences,
    bulletinBlockOnUnpaidFees: DEFAULT_SCHOOL_SETTINGS.bulletinBlockOnUnpaidFees,
    bulletinAllowedOutstandingBalance: DEFAULT_SCHOOL_SETTINGS.bulletinAllowedOutstandingBalance,
    timezone: settings?.timezone || "Africa/Douala",
    locale: settings?.locale || "fr-CM",
    currency: settings?.currency || "XAF",
    maxAbsences: schoolConfig?.maxAbsences,
    // Bug indépendant trouvé en retirant le cast non typé sur `bulletinTemplate` chez les deux
    // appelants (ReportCardController.ts, adminActionCatalog.ts) : ce champ n'a jamais existé
    // sur l'objet retourné ici, alors qu'il vit sur SchoolConfig — le fallback FR_SECONDARY
    // était donc TOUJOURS utilisé, quelle que soit la config réelle de l'établissement.
    bulletinTemplate: schoolConfig?.bulletinTemplate,
  };
};
