import type { FinanceJobsRepository } from '@domain/ports/repositories/FinanceJobsRepository';
import type { NotificationService } from '@domain/ports/services/NotificationService';
import { messageErreur } from '@application/shared/messageErreur';
import type { SmsNotificationPort } from '@domain/ports/services/SmsNotificationPort';

export class MarquerRetardsPretUseCase {
  constructor(
    private readonly financeJobsRepository: FinanceJobsRepository,
    private readonly notificationService: NotificationService,
    private readonly smsNotification: SmsNotificationPort,
  ) {}

  async findOverdue(): Promise<Awaited<ReturnType<FinanceJobsRepository['findOverdueBookLoans']>>> {
    return this.financeJobsRepository.findOverdueBookLoans(new Date());
  }

  async markOverdue(ids: string[]): Promise<void> {
    await this.financeJobsRepository.markBookLoansOverdue(ids);
  }

  async notifyOverdue(loans: Awaited<ReturnType<FinanceJobsRepository['findOverdueBookLoans']>>): Promise<void> {
    for (const loan of loans) {
      const studentName = `${loan.student.firstName} ${loan.student.lastName}`.trim();
      const titre = "Livre en retard";
      const corps = `Le livre "${loan.book.title}" est en retard de retour à la bibliothèque.`;

      await this.notificationService
        .envoyer({ schoolId: loan.schoolId, userId: loan.studentId, type: "LIBRARY_OVERDUE", titre, corps, urgency: "NORMAL" })
        .catch((err) => console.error('[Library Overdue élève]', messageErreur(err)));

      await this.smsNotification.notifyOverdueBookSms({
        schoolId: loan.schoolId,
        studentId: loan.studentId,
        studentName,
        bookTitle: loan.book.title,
      }).catch((err) => console.error('[Library Overdue SMS]', messageErreur(err)));
    }
  }

  async execute(): Promise<{ updated: number }> {
    const toMark = await this.findOverdue();
    if (toMark.length === 0) return { updated: 0 };
    await this.markOverdue(toMark.map((l) => l.id));
    await this.notifyOverdue(toMark);
    return { updated: toMark.length };
  }

  // Méthodes séquentielles pour respecter le découpage Inngest step.run
  async executeFindUpdateNotify(): Promise<{ updated: number }> {
    return this.execute();
  }
}
