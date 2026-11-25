export type AcademicPeriodType = "SEQUENCE" | "TERM" | "MONTH";

export type IAcademicYear = {
  fromYear: string | Date;
  toYear: string | Date;
};

export type ReportPeriod = "term1" | "term2" | "term3" | "annual" | string;

export const getAcademicPeriodCode = (type: AcademicPeriodType, number: number) =>
  `${String(type).toLowerCase()}_${number}`;

export const getAcademicPeriodLabel = (
  type: AcademicPeriodType,
  number: number,
  language: "fr" | "en"
) => {
  const labels: Record<AcademicPeriodType, { fr: string; en: string }> = {
    SEQUENCE: { fr: "Séquence", en: "Sequence" },
    TERM: { fr: "Trimestre", en: "Term" },
    MONTH: { fr: "Mois", en: "Month" },
  };
  const base = labels[type] || labels.TERM;
  return `${language === "fr" ? base.fr : base.en} ${number}`;
};

export const getPeriodDateRange = (
  year: Pick<IAcademicYear, "fromYear" | "toYear">,
  period: ReportPeriod
) => {
  const yearStart = new Date(year.fromYear);
  const yearEnd = new Date(year.toYear);

  if (period === "annual") {
    return { start: yearStart, end: yearEnd };
  }

  const yearDurationMs = yearEnd.getTime() - yearStart.getTime();
  const oneThirdMs = Math.floor(yearDurationMs / 3);

  if (period === "term1") {
    return {
      start: yearStart,
      end: new Date(yearStart.getTime() + oneThirdMs),
    };
  }

  if (period === "term2") {
    return {
      start: new Date(yearStart.getTime() + oneThirdMs + 1),
      end: new Date(yearStart.getTime() + oneThirdMs * 2),
    };
  }

  return {
    start: new Date(yearStart.getTime() + oneThirdMs * 2 + 1),
    end: yearEnd,
  };
};

export const getMentionFromAverage = (average: number) => {
  if (average >= 85) return "Excellent";
  if (average >= 70) return "Very Good";
  if (average >= 55) return "Good";
  if (average >= 40) return "Fair";
  return "Needs Improvement";
};
