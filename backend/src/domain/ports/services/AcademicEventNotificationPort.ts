export interface AcademicEventNotificationPort {
  notifierEvenementAcademique(schoolId: string, targetRoles: string[], titre: string, corps: string): Promise<void>;
}
