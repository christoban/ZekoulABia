import type { PrismaClient, PlanType, SchoolSubsystem, EducationType, SchoolOwnership, SchoolInvite } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type {
  InvitationRepository,
  InvitationProps,
  CompleteOnboardingCommand,
} from '@domain/ports/repositories/InvitationRepository';

export class PrismaInvitationRepository implements InvitationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByToken(token: string): Promise<InvitationProps | null> {
    const data = await this.prisma.schoolInvite.findUnique({ where: { token } });
    if (!data) return null;
    return this.toProps(data);
  }

  async findBySchoolId(schoolId: string): Promise<InvitationProps[]> {
    const data = await this.prisma.schoolInvite.findMany({ where: { schoolId } });
    return data.map(d => this.toProps(d));
  }

  async findPendingByEmail(email: string): Promise<InvitationProps | null> {
    const data = await this.prisma.schoolInvite.findFirst({
      where: { email, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    if (!data) return null;
    return this.toProps(data);
  }

  async save(invitation: InvitationProps): Promise<void> {
    await this.prisma.schoolInvite.create({
      data: {
        id: invitation.id,
        email: invitation.email,
        schoolName: invitation.schoolName,
        token: invitation.token,
        schoolId: invitation.schoolId,
        invitedByMasterId: invitation.invitedByMasterId,
        plan: invitation.plan as PlanType,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        notes: invitation.notes,
        createdAt: invitation.createdAt,
      },
    });
  }

  async update(invitation: InvitationProps): Promise<void> {
    await this.prisma.schoolInvite.update({
      where: { id: invitation.id },
      data: {
        status: invitation.status,
        expiresAt: invitation.expiresAt,
      },
    });
  }

  async expireToutes(schoolId: string): Promise<void> {
    await this.prisma.schoolInvite.updateMany({
      where: { schoolId, status: 'PENDING' },
      data: { status: 'EXPIRED' },
    });
  }

  async marquerUtilisee(token: string): Promise<void> {
    await this.prisma.schoolInvite.update({
      where: { token },
      data: { status: 'USED' },
    });
  }

  async marquerExpiree(token: string): Promise<void> {
    await this.prisma.schoolInvite.update({
      where: { token },
      data: { status: 'EXPIRED' },
    });
  }

  async completeOnboarding(command: CompleteOnboardingCommand): Promise<{ schoolId: string }> {
    const { school: updated } = await this.prisma.$transaction(async (tx) => {
      const school = await tx.school.update({
        where: { id: command.school.id },
        data: {
          name: command.school.name,
          subdomain: command.school.subdomain,
          address: command.school.address,
          city: command.school.city,
          region: command.school.region,
          phone: command.school.phone,
          email: command.school.email,
          subsystem: command.school.subsystem as SchoolSubsystem,
          educationType: command.school.educationType as EducationType,
          ownership: command.school.ownership as SchoolOwnership,
          ...(command.school.admissionType ? { admissionType: command.school.admissionType } : {}),
          status: 'PENDING',
          plan: command.school.plan as PlanType,
          logoUrl: command.school.logoUrl,
          onboardingConfig: command.school.onboardingConfig || undefined,
          templateCode: command.school.templateCode,
        } as Prisma.SchoolUncheckedUpdateInput,
      });

      await tx.user.create({
        data: {
          schoolId: school.id,
          role: 'ADMIN',
          email: command.admin.email,
          firstName: command.admin.firstName,
          lastName: command.admin.lastName,
          passwordHash: command.admin.passwordHash,
        },
      });

      await tx.schoolInvite.update({
        where: { token: command.token },
        data: { status: 'USED', schoolId: school.id },
      });

      return { school };
    });

    return { schoolId: updated.id };
  }

  private toProps(data: SchoolInvite): InvitationProps {
    return {
      id: data.id,
      email: data.email,
      schoolName: data.schoolName,
      token: data.token,
      schoolId: data.schoolId ?? undefined,
      invitedByMasterId: data.invitedByMasterId ?? undefined,
      plan: data.plan,
      status: data.status,
      expiresAt: data.expiresAt,
      notes: data.notes ?? undefined,
      createdAt: data.createdAt,
    };
  }
}
