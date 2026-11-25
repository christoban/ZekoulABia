export interface SchoolCalendarPort {
  ajouterJoursOuvresScolaires(schoolId: string, date: Date, jours: number): Promise<Date>;
  prolongerSiFermetureAujourdhui(schoolId: string, closeDate: Date, aujourd: Date): Promise<Date | null>;
}
