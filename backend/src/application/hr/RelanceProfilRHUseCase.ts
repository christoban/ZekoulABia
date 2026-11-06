import type { StepRunner } from '@application/shared/StepRunner';
import type { HrJobsRepository } from '@domain/ports/repositories/HrJobsRepository';
import type { EmailService } from '@domain/ports/services/EmailService';

const REMINDER_DELAY_DAYS = [7, 14];
const ESCALATION_DELAY_DAYS = 21;

export class RelanceProfilRHUseCase {
  constructor(private readonly repository: HrJobsRepository, private readonly emailService: EmailService) {}

  async execute(step: StepRunner): Promise<{ reminded: number; escalated: number; processedAt: string }> {
    const FRONTEND_URL = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
    const employes = await this.repository.listerEmployesActifs();

    let reminded = 0;
    let escalated = 0;
    const escalationsBySchool = new Map<string, { schoolName: string; employes: string[] }>();

    for (const employe of employes) {
      if (employe.employeeFile?.selfServiceCompletedAt) continue;

      const daysSinceCreated = Math.floor((Date.now() - new Date(employe.createdAt).getTime()) / (24 * 60 * 60 * 1000));
      const schoolName = employe.school?.name ?? 'votre établissement';
      const profileUrl = `${FRONTEND_URL}/${employe.role === 'TEACHER' ? 'teacher' : 'staff'}/dashboard`;

      if (REMINDER_DELAY_DAYS.includes(daysSinceCreated)) {
        await step.run(`relance-${employe.id}-j${daysSinceCreated}`, async () => {
          if (employe.email) {
            await this.emailService.envoyer({
              destinataire: employe.email,
              sujet: `Complétez votre profil RH — ${schoolName}`,
              contenuHtml: `<p>Bonjour ${employe.firstName},</p><p><strong>${schoolName}</strong> vous invite à compléter votre profil RH (identité, diplômes, documents) depuis votre tableau de bord.</p><p><a href="${profileUrl}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 16px;border-radius:8px;text-decoration:none;">Compléter mon profil</a></p>`,
              contenuTexte: `${schoolName} vous invite à compléter votre profil RH : ${profileUrl}`,
              eventType: 'user_invite',
              metadata: { schoolId: employe.schoolId },
            });
          }

          await this.repository.creerNotification({
            schoolId: employe.schoolId,
            userId: employe.id,
            type: 'SYSTEM',
            title: 'Profil RH à compléter',
            body: `Merci de compléter et confirmer votre profil RH depuis votre tableau de bord.`,
            channel: 'IN_APP',
            metadata: { link: '/mon-profil-rh' },
          });

          await this.repository.upsertRelance(employe.id, employe.schoolId);
        });
        reminded++;
      }

      if (daysSinceCreated >= ESCALATION_DELAY_DAYS && !employe.employeeFile?.escalatedAt) {
        await step.run(`escalade-${employe.id}`, async () => {
          await this.repository.upsertEscalade(employe.id, employe.schoolId);
        });
        const key = employe.schoolId;
        if (!escalationsBySchool.has(key)) escalationsBySchool.set(key, { schoolName, employes: [] });
        escalationsBySchool.get(key)!.employes.push(`${employe.lastName} ${employe.firstName} (${employe.role})`);
        escalated++;
      }
    }

    for (const [schoolId, info] of escalationsBySchool.entries()) {
      await step.run(`escalade-admin-${schoolId}`, async () => {
        const admins = await this.repository.listerAdminsActifs(schoolId);
        const liste = info.employes.map((n) => `<li>${n}</li>`).join('');
        for (const admin of admins) {
          if (admin.email) {
            await this.emailService.envoyer({
              destinataire: admin.email,
              sujet: `Profils RH non complétés après ${ESCALATION_DELAY_DAYS} jours — ${info.schoolName}`,
              contenuHtml: `<p>Bonjour,</p><p>Les employés suivants n'ont toujours pas complété leur profil RH self-service après ${ESCALATION_DELAY_DAYS} jours :</p><ul>${liste}</ul><p>Une relance personnelle peut être nécessaire.</p>`,
              contenuTexte: `Profils RH non complétés après ${ESCALATION_DELAY_DAYS} jours : ${info.employes.join(', ')}`,
              eventType: 'user_invite',
              metadata: { schoolId },
            });
          }
          await this.repository.creerNotification({
            schoolId, userId: admin.id, type: 'SYSTEM',
            title: 'Profils RH en attente',
            body: `${info.employes.length} employé(s) n'ont pas complété leur profil RH après ${ESCALATION_DELAY_DAYS} jours.`,
            channel: 'IN_APP',
            metadata: { link: '/admin/dashboard?section=rh', employes: info.employes },
          });
        }
      });
    }

    return { reminded, escalated, processedAt: new Date().toISOString() };
  }
}
