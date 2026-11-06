import type { SmsNotificationPort } from '@domain/ports/services/SmsNotificationPort';
import {
  notifyBulletinSms,
  notifyLv2WindowOpenSms,
  notifyMinesecOverdueSms,
  notifyOnboardingReminderSms,
  notifyOverdueInvoiceSms,
  notifyAbsenceThresholdSms,
  notifyOverdueBookSms,
  notifyAdmissionProvisoireSms,
  notifyConcoursNonAdmisSms,
  notifyConcoursListeAttenteSms,
  notifyConcoursPromotionSms,
  getParentContacts,
} from './SmsNotificationService';

export class SmsNotificationAdapter implements SmsNotificationPort {
  async notifyBulletinSms(opts: {
    schoolId: string;
    studentId: string;
    studentName: string;
    periodName: string;
  }): Promise<void> {
    await notifyBulletinSms(opts);
  }

  async notifyLv2WindowOpenSms(opts: {
    schoolId: string;
    studentUserId: string;
    studentName: string;
    level: string;
    closeDate: Date;
  }): Promise<void> {
    await notifyLv2WindowOpenSms(opts);
  }

  async notifyMinesecOverdueSms(opts: {
    schoolId: string;
    studentUserId: string;
    studentName: string;
    amount: number;
    typesFrais: string;
  }): Promise<void> {
    await notifyMinesecOverdueSms(opts);
  }

  async notifyOnboardingReminderSms(opts: {
    schoolId: string;
    nomProvisoire: string;
    schoolName: string;
    phone: string | null;
    formUrl: string;
  }): Promise<void> {
    await notifyOnboardingReminderSms(opts);
  }

  async notifyOverdueInvoiceSms(opts: {
    schoolId: string;
    studentId: string;
    studentName: string;
    amount: number;
    daysOverdue: number;
    invoiceLabel: string;
    phones?: string[];
  }): Promise<void> {
    await notifyOverdueInvoiceSms(opts);
  }

  async notifyAbsenceThresholdSms(opts: {
    schoolId: string;
    studentId: string;
    studentName: string;
    count: number;
    threshold: number;
  }): Promise<void> {
    await notifyAbsenceThresholdSms(opts);
  }

  async notifyOverdueBookSms(opts: {
    schoolId: string;
    studentId: string;
    studentName: string;
    bookTitle: string;
    phones?: string[];
  }): Promise<void> {
    if (!opts.phones || opts.phones.length === 0) {
      try {
        const contacts = await getParentContacts(opts.studentId);
        const phones = contacts.map((c) => c.phone).filter((p): p is string => Boolean(p));
        if (phones.length > 0) {
          await notifyOverdueBookSms({ ...opts, phones });
          return;
        }
      } catch {}
    }
    await notifyOverdueBookSms({ ...opts, phones: opts.phones ?? [] });
  }

  async notifyAdmissionProvisoireSms(opts: {
    schoolId: string;
    candidateName: string;
    parentPhone: string | null;
    schoolName?: string;
    level?: string;
    examName?: string;
    nextStep?: string;
  }): Promise<void> {
    await notifyAdmissionProvisoireSms(opts);
  }

  async notifyConcoursNonAdmisSms(opts: {
    schoolId: string;
    candidateName: string;
    parentPhone: string | null;
    schoolName?: string;
    level?: string;
  }): Promise<void> {
    await notifyConcoursNonAdmisSms(opts);
  }

  async notifyConcoursListeAttenteSms(opts: {
    schoolId: string;
    candidateName: string;
    parentPhone: string | null;
    schoolName?: string;
    level?: string;
    rank?: number;
  }): Promise<void> {
    await notifyConcoursListeAttenteSms(opts);
  }

  async notifyConcoursPromotionSms(opts: {
    schoolId: string;
    candidateName: string;
    parentPhone: string | null;
    schoolName?: string;
    level?: string;
    examName?: string;
  }): Promise<void> {
    await notifyConcoursPromotionSms(opts);
  }
}
