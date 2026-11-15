import type { FinanceJobsRepository } from '@domain/ports/repositories/FinanceJobsRepository';
import type { EmailService } from '@domain/ports/services/EmailService';
import type { NotificationService } from '@domain/ports/services/NotificationService';
import { messageErreur } from '@application/shared/messageErreur';
import type { SmsNotificationPort } from '@domain/ports/services/SmsNotificationPort';

export class EnvoyerRappelsPaiementUseCase {
  constructor(
    private readonly financeJobsRepository: FinanceJobsRepository,
    private readonly emailService: EmailService,
    private readonly notificationService: NotificationService,
    private readonly smsNotification: SmsNotificationPort,
  ) {}

  async execute(): Promise<{ processed: number }> {
    const today = new Date();
    const invoices = await this.financeJobsRepository.findOverdueInvoicesDueWithin(7);

    let processed = 0;

    for (const invoice of invoices) {
      if (!invoice.dueDate) continue;

      const parentRecipients = invoice.student?.studentProfile?.parents
        .map((p) => p.parentProfile?.user ? { email: p.parentProfile.user.email, userId: p.parentProfile.user.id } : null)
        .filter((r): r is { email: string; userId: string } => Boolean(r?.email)) ?? [];

      if (!invoice.student?.email && parentRecipients.length === 0) continue;

      const daysUntilDue = Math.ceil((new Date(invoice.dueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const daysOverdue = daysUntilDue < 0 ? Math.abs(daysUntilDue) : 0;

      let subject = "";
      const isOverdue = daysUntilDue < 0;
      if (daysUntilDue === 7) subject = "Rappel : Paiement dû dans 7 jours";
      else if (daysUntilDue === 3) subject = "Urgent (J-3) : Paiement dû dans 3 jours";
      else if (daysUntilDue === 0) subject = "Échéance aujourd'hui (J0) : Dernier délai de paiement";
      else if (daysOverdue === 7) subject = "Relance J+7 : Retard de paiement — 7 jours";
      else if (daysOverdue === 14) subject = "Relance J+14 : Retard de paiement — 14 jours";
      else if (daysOverdue === 30) subject = "Mise en demeure J+30 : Retard de paiement — 30 jours";
      else if (isOverdue) subject = `Retard de paiement — ${daysOverdue} jour(s)`;
      else continue;

      const label = invoice.feePlan?.name || invoice.description || "Facture";
      const amountFormatted = new Intl.NumberFormat("fr-CM", { style: "currency", currency: "XAF", maximumFractionDigits: 0 }).format(invoice.amount);
      const dueDateFormatted = new Date(invoice.dueDate).toLocaleDateString("fr-FR");
      const schoolName = invoice.school?.name ?? "ZekoulABia";

      const allRecipients = [
        ...(invoice.student?.email ? [{ email: invoice.student.email, userId: invoice.student.id }] : []),
        ...parentRecipients,
      ];
      const seenEmails = new Set<string>();
      const dedupedRecipients = allRecipients.filter((r) => (seenEmails.has(r.email) ? false : (seenEmails.add(r.email), true)));

      for (const recipient of dedupedRecipients) {
        try {
          await this.emailService.envoyer({
            destinataire: recipient.email,
            sujet: `${subject} — ${schoolName}`,
            contenuHtml: `<p>Bonjour,</p><p>Facture : <b>${label}</b></p><p>Montant : <b>${amountFormatted}</b></p><p>Échéance : <b>${dueDateFormatted}</b></p><p>Connectez-vous sur ZekoulABia pour payer en ligne.</p>`,
            contenuTexte: `Facture ${label} - ${invoice.amount} XAF - Échéance ${dueDateFormatted}`,
            eventType: "payment_reminder",
            recipientUserId: recipient.userId,
          });
          processed++;
        } catch (err) {
          console.error("Reminder email error:", err);
        }
      }

      const shouldNotifyPushAndSms =
        daysUntilDue === 3 ||
        daysUntilDue === 0 ||
        daysOverdue === 7 ||
        daysOverdue === 14 ||
        daysOverdue === 30;

      if (shouldNotifyPushAndSms && invoice.studentId) {
        const studentName = `${invoice.student?.firstName ?? ''} ${invoice.student?.lastName ?? ''}`.trim();
        const titre = daysUntilDue === 3
          ? "Échéance scolarité J-3"
          : daysUntilDue === 0
            ? "Échéance scolarité aujourd'hui"
            : `Relance impayé J+${daysOverdue}`;
        const corps = isOverdue
          ? `Facture "${label}" de ${invoice.amount} XAF pour ${studentName} en retard de ${daysOverdue} jour(s).`
          : `Facture "${label}" de ${invoice.amount} XAF pour ${studentName} due le ${dueDateFormatted}.`;
        if (this.notificationService.notifierParents) {
          await this.notificationService.notifierParents({
            schoolId: invoice.schoolId, studentId: invoice.studentId, type: "PAYMENT_REMINDER", titre, corps,
          }).catch((err) => console.error('[PushFirst] parent:', messageErreur(err)));
        } else {
          for (const parent of parentRecipients) {
            await this.notificationService
              .envoyer({ schoolId: invoice.schoolId, userId: parent.userId, type: "PAYMENT_REMINDER", titre, corps, urgency: isOverdue ? "HIGH" : "NORMAL" })
              .catch((err) => console.error('[PushFirst] IN_APP parent:', messageErreur(err)));
          }
        }
        void this.smsNotification.notifyOverdueInvoiceSms({
          schoolId: invoice.schoolId,
          studentId: invoice.studentId,
          studentName,
          amount: invoice.amount,
          daysOverdue,
          invoiceLabel: label,
        });
      }
    }

    return { processed };
  }
}
