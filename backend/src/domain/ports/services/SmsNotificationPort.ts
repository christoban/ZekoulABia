export interface SmsNotificationPort {
  notifyBulletinSms(opts: {
    schoolId: string;
    studentId: string;
    studentName: string;
    periodName: string;
  }): Promise<void>;

  notifyLv2WindowOpenSms(opts: {
    schoolId: string;
    studentUserId: string;
    studentName: string;
    level: string;
    closeDate: Date;
  }): Promise<void>;

  notifyMinesecOverdueSms(opts: {
    schoolId: string;
    studentUserId: string;
    studentName: string;
    amount: number;
    typesFrais: string;
  }): Promise<void>;

  notifyOnboardingReminderSms(opts: {
    schoolId: string;
    nomProvisoire: string;
    schoolName: string;
    phone: string | null;
    formUrl: string;
  }): Promise<void>;

  notifyOverdueInvoiceSms(opts: {
    schoolId: string;
    studentId: string;
    studentName: string;
    amount: number;
    daysOverdue: number;
    invoiceLabel: string;
    phones?: string[];
  }): Promise<void>;

  notifyAbsenceThresholdSms(opts: {
    schoolId: string;
    studentId: string;
    studentName: string;
    count: number;
    threshold: number;
  }): Promise<void>;

  notifyOverdueBookSms(opts: {
    schoolId: string;
    studentId: string;
    studentName: string;
    bookTitle: string;
    phones?: string[];
  }): Promise<void>;

  notifyAdmissionProvisoireSms(opts: {
    schoolId: string;
    candidateName: string;
    parentPhone: string | null;
    schoolName?: string;
    level?: string;
    examName?: string;
    nextStep?: string;
  }): Promise<void>;

  notifyConcoursNonAdmisSms(opts: {
    schoolId: string;
    candidateName: string;
    parentPhone: string | null;
    schoolName?: string;
    level?: string;
  }): Promise<void>;

  notifyConcoursListeAttenteSms(opts: {
    schoolId: string;
    candidateName: string;
    parentPhone: string | null;
    schoolName?: string;
    level?: string;
    rank?: number;
  }): Promise<void>;

  notifyConcoursPromotionSms(opts: {
    schoolId: string;
    candidateName: string;
    parentPhone: string | null;
    schoolName?: string;
    level?: string;
    examName?: string;
  }): Promise<void>;
}
