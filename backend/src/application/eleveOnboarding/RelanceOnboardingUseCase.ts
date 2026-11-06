import type { StepRunner } from '@application/shared/StepRunner';
import type { EleveOnboardingJobsRepository } from '@domain/ports/repositories/EleveOnboardingJobsRepository';
import type { EmailService } from '@domain/ports/services/EmailService';
import type { EmailTemplatePort } from '@domain/ports/services/EmailTemplatePort';
import type { SmsNotificationPort } from '@domain/ports/services/SmsNotificationPort';

export class RelanceOnboardingUseCase {
  constructor(
    private readonly repository: EleveOnboardingJobsRepository,
    private readonly emailService: EmailService,
    private readonly emailTemplate: EmailTemplatePort,
    private readonly smsNotification: SmsNotificationPort,
  ) {}

  async execute(step: StepRunner): Promise<{ reminded: number; escalated: number; expired: number; processedAt: string }> {
    const dossiers = await this.repository.listerDossiersLinkSent();

    let reminded = 0;
    let escalated = 0;
    let expired = 0;
    const frontendUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';

    for (const dossier of dossiers) {
      const settings = await this.repository.trouverSettings(dossier.schoolId);
      const reminderDelayDays: number[] = (settings?.reminderDelayDays ?? [3, 7]) as number[];
      const escalationDelayDays: number = settings?.escalationDelayDays ?? 10;
      const responsableRole: string = settings?.responsableRole ?? 'ADMIN';
      const schoolName = dossier.school?.name ?? 'votre établissement';

      const daysSinceCreated = Math.floor((Date.now() - new Date(dossier.createdAt).getTime()) / (24 * 60 * 60 * 1000));

      if (dossier.tokenExpiresAt.getTime() < Date.now()) {
        await this.repository.marquerExpire(dossier.id);
        expired++;
        continue;
      }

      if (reminderDelayDays.includes(daysSinceCreated)) {
        await step.run(`relance-${dossier.id}-j${daysSinceCreated}`, async () => {
          const formUrl = `${frontendUrl}/eleve-onboarding/${dossier.token}`;
          if (dossier.contactEmail) {
            const expiryDaysLeft = Math.max(1, Math.round((dossier.tokenExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
            const tpl = this.emailTemplate.buildOnboardingLink({ nomProvisoire: dossier.nomProvisoire, schoolName, formUrl, expiryDays: expiryDaysLeft });
            await this.emailService.envoyer({
              destinataire: dossier.contactEmail,
              sujet: `RAPPEL — ${tpl.subject}`,
              contenuHtml: tpl.html,
              contenuTexte: tpl.text,
              eventType: 'user_invite',
              metadata: { schoolId: dossier.schoolId },
            }).catch((err: unknown) => console.error('[Email] Échec relance onboarding:', err instanceof Error ? err.message : String(err)));
          }
          if (dossier.contactTelephone) {
            await this.smsNotification.notifyOnboardingReminderSms({ schoolId: dossier.schoolId, nomProvisoire: dossier.nomProvisoire, schoolName, phone: dossier.contactTelephone, formUrl });
          }
          if (dossier.parentContactEmail) {
            const expiryDaysLeft = Math.max(1, Math.round((dossier.tokenExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
            const tpl = this.emailTemplate.buildOnboardingLink({ nomProvisoire: dossier.nomProvisoire, schoolName, formUrl, expiryDays: expiryDaysLeft });
            await this.emailService.envoyer({
              destinataire: dossier.parentContactEmail,
              sujet: `RAPPEL — ${tpl.subject}`,
              contenuHtml: tpl.html,
              contenuTexte: tpl.text,
              eventType: 'user_invite',
              metadata: { schoolId: dossier.schoolId },
            }).catch((err: unknown) => console.error('[Email] Échec relance onboarding (parent):', err instanceof Error ? err.message : String(err)));
          }
          if (dossier.parentContactTelephone) {
            await this.smsNotification.notifyOnboardingReminderSms({ schoolId: dossier.schoolId, nomProvisoire: dossier.nomProvisoire, schoolName, phone: dossier.parentContactTelephone, formUrl });
          }
          await this.repository.incrementerRelance(dossier.id);
        });
        reminded++;
      }

      if (daysSinceCreated >= escalationDelayDays && !dossier.escalatedAt) {
        await step.run(`escalade-${dossier.id}`, async () => {
          const responsables = await this.repository.trouverResponsables(dossier.schoolId, responsableRole);
          for (const responsable of responsables) {
            if (!responsable.email) continue;
            await this.emailService.envoyer({
              destinataire: responsable.email,
              sujet: `Dossier d'inscription en attente — ${dossier.nomProvisoire} (${schoolName})`,
              contenuHtml: `<p>Bonjour,</p><p>Le dossier d'inscription de <strong>${dossier.nomProvisoire}</strong> n'est toujours pas complété après ${daysSinceCreated} jours. Une relance manuelle ou un nouveau lien (renvoyer-lien) peut être nécessaire.</p>`,
              contenuTexte: `Le dossier d'inscription de ${dossier.nomProvisoire} n'est toujours pas complété après ${daysSinceCreated} jours.`,
              eventType: 'user_invite',
              metadata: { schoolId: dossier.schoolId },
            }).catch((err: unknown) => console.error('[Email] Échec escalade onboarding:', err instanceof Error ? err.message : String(err)));
          }
          await this.repository.marquerEscalade(dossier.id);
        });
        escalated++;
      }
    }

    return { reminded, escalated, expired, processedAt: new Date().toISOString() };
  }
}
