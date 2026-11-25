import type { MinesecJobsRepository } from '@domain/ports/repositories/MinesecJobsRepository';
import type { SmsNotificationPort } from '@domain/ports/services/SmsNotificationPort';

function yearLabelFor(year: { startDate: Date; endDate: Date | null }): string {
  return `${year.startDate.getFullYear()}-${year.endDate?.getFullYear() ?? year.startDate.getFullYear() + 1}`;
}

export class RelancePaiementsUseCase {
  constructor(private readonly repository: MinesecJobsRepository, private readonly smsNotification: SmsNotificationPort) {}

  async execute(): Promise<{ results: { schoolId: string; schoolName: string; remindersSent: number }[]; sentAt: string }> {
    const schools = await this.repository.listerEcolesActives();
    const results: { schoolId: string; schoolName: string; remindersSent: number }[] = [];

    for (const school of schools) {
      const year = await this.repository.trouverAnneeCourante(school.id);
      if (!year) continue;

      const yearLabel = yearLabelFor(year);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const overduePayments = await this.repository.listerPaiementsEnRetard(school.id, yearLabel, sevenDaysAgo);

      const byStudent = new Map<string, { student: (typeof overduePayments)[number]['student']; payments: typeof overduePayments }>();
      for (const p of overduePayments) {
        const existing = byStudent.get(p.studentId) ?? { student: p.student, payments: [] };
        existing.payments.push(p);
        byStudent.set(p.studentId, existing);
      }

      let remindersSent = 0;
      for (const [, { student, payments }] of byStudent) {
        const totalDus = payments.reduce((s, p) => s + p.montantAttendu, 0);
        const typesFrais = payments.map((p) => p.typeFrais).join(', ');
        void this.smsNotification.notifyMinesecOverdueSms({
          schoolId: school.id,
          studentUserId: student.user.id,
          studentName: `${student.user.firstName} ${student.user.lastName}`,
          amount: totalDus,
          typesFrais,
        });
        remindersSent++;
      }

      results.push({ schoolId: school.id, schoolName: school.name, remindersSent });
    }

    return { results, sentAt: new Date().toISOString() };
  }
}
