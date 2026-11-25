import type { FinanceJobsRepository } from '@domain/ports/repositories/FinanceJobsRepository';
import type { EmailService } from '@domain/ports/services/EmailService';
import type { SmsNotificationPort } from '@domain/ports/services/SmsNotificationPort';

export class VerifierSeuilAbsencesUseCase {
  constructor(
    private readonly financeJobsRepository: FinanceJobsRepository,
    private readonly emailService: EmailService,
    private readonly smsNotification: SmsNotificationPort,
  ) {}

  async execute(): Promise<{ alertsSent: number }> {
    const schools = await this.financeJobsRepository.findActiveSchools();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let alertsSent = 0;

    for (const school of schools) {
      const thresholdRaw = await this.financeJobsRepository.getSchoolConfigAbsenceThreshold(school.id);
      const threshold = thresholdRaw ?? 3;

      const absenceCounts = await this.financeJobsRepository.countAbsencesGrouped(school.id, since);
      const overThreshold = absenceCounts.filter((a) => a._count.id >= threshold);
      if (overThreshold.length === 0) continue;

      const surveillants = await this.financeJobsRepository.findStaffByPermissionWithUser(school.id, "MANAGE_ATTENDANCE");

      for (const entry of overThreshold) {
        const student = await this.financeJobsRepository.findUserById(entry.studentId);
        if (!student) continue;

        const studentName = `${student.firstName} ${student.lastName}`.trim();
        const count = entry._count.id;

        for (const s of surveillants) {
          if (!s.user.email) continue;
          try {
            await this.emailService.envoyer({
              destinataire: s.user.email,
              sujet: `Alerte absences — ${studentName} (${count} absences non justifiées)`,
              contenuHtml: `<p>Bonjour ${s.user.firstName},</p><p><b>${studentName}</b> cumule <b>${count} absences non justifiées</b> sur les 30 derniers jours (seuil configuré : ${threshold}).</p><p>Une action est requise.</p>`,
              contenuTexte: `${studentName} : ${count} absences non justifiées (seuil ${threshold})`,
              eventType: "absence_alert",
              recipientUserId: s.user.id,
            });
          } catch (err) {
            console.error("Absence alert email error:", err);
          }
        }

        void this.smsNotification.notifyAbsenceThresholdSms({ schoolId: school.id, studentId: entry.studentId, studentName, count, threshold });
        alertsSent++;
      }
    }

    return { alertsSent };
  }
}
