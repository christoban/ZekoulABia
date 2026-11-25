export interface HrEmployeForRelance {
  id: string;
  schoolId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  createdAt: Date;
  role: string;
  school: { name: string } | null;
  employeeFile: {
    selfServiceCompletedAt: Date | null;
    remindersSentCount: number;
    lastReminderAt: Date | null;
    escalatedAt: Date | null;
  } | null;
}

export interface HrJobsRepository {
  listerEmployesActifs(): Promise<HrEmployeForRelance[]>;
  creerNotification(data: {
    schoolId: string;
    userId: string;
    type: string;
    title: string;
    body: string;
    channel: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  upsertRelance(userId: string, schoolId: string): Promise<void>;
  upsertEscalade(userId: string, schoolId: string): Promise<void>;
  listerAdminsActifs(schoolId: string): Promise<{ id: string; email: string | null }[]>;
}
