export interface PersonnelNotificationPort {
  notifierPersonnel(userId: string, schoolId: string, titre: string, corps: string): Promise<void>;
}
