import type { PrismaClient, UserRole } from '@prisma/client';
import type {
  EleveOnboardingJobsRepository,
  OnboardingDossierForJobs,
  OnboardingSettingsForJobs,
} from '@domain/ports/repositories/EleveOnboardingJobsRepository';

export class PrismaEleveOnboardingJobsRepository implements EleveOnboardingJobsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listerDossiersLinkSent(): Promise<OnboardingDossierForJobs[]> {
    return this.prisma.studentOnboarding.findMany({
      where: { status: 'LINK_SENT' },
      include: { school: { select: { name: true } } },
    }) as Promise<OnboardingDossierForJobs[]>;
  }

  async trouverSettings(schoolId: string): Promise<OnboardingSettingsForJobs | null> {
    const s = await this.prisma.schoolOnboardingSettings.findUnique({ where: { schoolId } });
    if (!s) return null;
    return {
      reminderDelayDays: s.reminderDelayDays ?? [3, 7],
      escalationDelayDays: s.escalationDelayDays ?? 10,
      responsableRole: s.responsableRole ?? 'ADMIN',
    };
  }

  async marquerExpire(id: string): Promise<void> {
    await this.prisma.studentOnboarding.update({ where: { id }, data: { status: 'EXPIRED' } });
  }

  async incrementerRelance(id: string): Promise<void> {
    await this.prisma.studentOnboarding.update({
      where: { id },
      data: { remindersSentCount: { increment: 1 }, lastReminderAt: new Date() },
    });
  }

  async trouverResponsables(schoolId: string, role: string): Promise<{ email: string | null; firstName: string }[]> {
    return this.prisma.user.findMany({
      where: { schoolId, role: role as UserRole },
      select: { email: true, firstName: true },
    }) as Promise<{ email: string | null; firstName: string }[]>;
  }

  async marquerEscalade(id: string): Promise<void> {
    await this.prisma.studentOnboarding.update({ where: { id }, data: { escalatedAt: new Date() } });
  }
}
