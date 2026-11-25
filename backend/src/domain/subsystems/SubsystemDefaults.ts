export type SectionCycle = "maternelle" | "primaire" | "secondaire" | "technique";
export type SectionLanguage = "fr" | "en";

export const DEFAULT_SUBSYSTEMS = [
  {
    code: "FR_GENERAL_SEC",
    name: "Francophone General Secondary",
    gradingScale: "OVER_20",
    periodType: "SEQUENCES_6",
    hasCoefficientBySubject: true,
    passThreshold: 10,
  },
  {
    code: "FR_PRIMAIRE",
    name: "Francophone Primary",
    gradingScale: "COMPETENCY_ANA",
    periodType: "TERMS_3",
    hasCoefficientBySubject: false,
    passThreshold: 10,
  },
  {
    code: "FR_TECHNIQUE_SEC",
    name: "Francophone Technical Secondary",
    gradingScale: "OVER_20",
    periodType: "SEQUENCES_6",
    hasCoefficientBySubject: true,
    passThreshold: 10,
  },
  {
    code: "EN_GENERAL_SEC",
    name: "Anglophone General Secondary",
    gradingScale: "PERCENT",
    periodType: "TERMS_3",
    hasCoefficientBySubject: false,
    passThreshold: 40,
  },
  {
    code: "EN_PRIMAIRE",
    name: "Anglophone Primary",
    gradingScale: "PERCENT",
    periodType: "TERMS_3",
    hasCoefficientBySubject: false,
    passThreshold: 40,
  },
  {
    code: "EN_TECHNIQUE_SEC",
    name: "Anglophone Technical Secondary",
    gradingScale: "PERCENT",
    periodType: "TERMS_3",
    hasCoefficientBySubject: false,
    passThreshold: 40,
  },
  {
    code: "MATERNELLE",
    name: "Nursery",
    gradingScale: "COMPETENCY_ANA",
    periodType: "TERMS_3",
    hasCoefficientBySubject: false,
    passThreshold: 10,
  },
] as const;

export const ensureDefaultSubSystems = async () => {
  return DEFAULT_SUBSYSTEMS;
};

export const resolveDefaultSubsystemCodeForSection = (
  cycle?: SectionCycle | null,
  language?: SectionLanguage | null
) => {
  if (cycle === "maternelle") return "MATERNELLE";
  if (cycle === "primaire") return language === "en" ? "EN_PRIMAIRE" : "FR_PRIMAIRE";
  if (cycle === "technique") return language === "en" ? "EN_TECHNIQUE_SEC" : "FR_TECHNIQUE_SEC";
  return language === "en" ? "EN_GENERAL_SEC" : "FR_GENERAL_SEC";
};

export function resolveHasCoefficientForClass(
  school: { subsystem: string },
  classLevel: string | null | undefined,
  sectionCode?: string | null,
): boolean {
  const PRIMARY_LEVELS = ["SIL","CP","CE1","CE2","CM1","CM2","Class1","Class2","Class3","Class4","Class5","Class6"];
  const PRESCHOOL_LEVELS = ["PS","MS","GS","PreNursery","Nursery1","Nursery2","Petite section","Moyenne section","Grande section"];
  const TECHNICAL_LEVELS = ["CAP1","CAP2","CAP3","CAP4","BT1","BT2","BT3"];
  let cycle: SectionCycle | null = null;
  if (classLevel && PRESCHOOL_LEVELS.includes(classLevel)) cycle = "maternelle";
  else if (classLevel && PRIMARY_LEVELS.includes(classLevel)) cycle = "primaire";
  else if (classLevel && TECHNICAL_LEVELS.includes(classLevel)) cycle = "technique";
  else cycle = "secondaire";
  // Source réelle de la langue : School.subsystem + Section.code (via resolveLanguage, BILINGUAL → sectionCode)
  // Import évité ici pour rester sans dépendance circulaire — on duplique la logique minimale de LanguagePolicy
  let language: SectionLanguage;
  if (school.subsystem === "ANGLOPHONE") language = "en";
  else if (school.subsystem === "BILINGUAL") language = sectionCode === "EN" ? "en" : "fr";
  else language = "fr";
  const code = resolveDefaultSubsystemCodeForSection(cycle, language);
  return DEFAULT_SUBSYSTEMS.find(d => d.code === code)?.hasCoefficientBySubject ?? true;
}