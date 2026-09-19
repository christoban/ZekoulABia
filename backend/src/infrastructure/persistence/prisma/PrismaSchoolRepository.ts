import type { PrismaClient } from '@prisma/client';
import { School } from '@domain/entities/School';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { EducationType, SchoolOwnership, SchoolStatus, SchoolSubsystem } from '@domain/types/enums';

export class PrismaSchoolRepository implements SchoolRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<School | null> {
    const data = await this.prisma.school.findUnique({ where: { id } });
    if (!data) return null;
    return this.toDomain(data);
  }

  async findBySubdomain(subdomain: string): Promise<School | null> {
    const data = await this.prisma.school.findUnique({ where: { subdomain } });
    if (!data) return null;
    return this.toDomain(data);
  }

  async findPEBSFlags(schoolId: string): Promise<{ hasPEBSFrancophone: boolean; hasPEBSAnglophone: boolean } | null> {
    const data = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { hasPEBSFrancophone: true, hasPEBSAnglophone: true },
    });
    return data;
  }

  async findAll(): Promise<School[]> {
    const data = await this.prisma.school.findMany();
    return data.map((item) => this.toDomain(item));
  }

  async findByStatus(status: SchoolStatus): Promise<School[]> {
    const data = await this.prisma.school.findMany({ where: { status } });
    return data.map((item) => this.toDomain(item));
  }

  async existsBySubdomain(subdomain: string): Promise<boolean> {
    const count = await this.prisma.school.count({ where: { subdomain } });
    return count > 0;
  }

  async save(school: School): Promise<void> {
    const data = school.toObject();
    await this.prisma.school.create({
      data: {
        id: data.id,
        name: data.name,
        subdomain: data.subdomain,
        status: data.status,
        plan: data.plan,
        subsystem: data.subsystem,
        educationType: data.educationType,
        ownership: data.ownership,
        city: data.city,
        region: data.region,
        address: data.address,
        phone: data.phone,
        email: data.email,
        logoUrl: data.logoUrl,
        templateCode: data.templateCode,
        onboardingConfig: data.onboardingConfig ?? undefined,
        saturdaySchedule: data.saturdaySchedule,
        contractEnd: data.contractEnd,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      },
    });
  }

  async update(school: School): Promise<void> {
    const data = school.toObject();
    await this.prisma.school.update({
      where: { id: data.id },
      data: {
        name: data.name,
        status: data.status,
        plan: data.plan,
        city: data.city,
        region: data.region,
        address: data.address,
        phone: data.phone,
        email: data.email,
        logoUrl: data.logoUrl,
        templateCode: data.templateCode,
        onboardingConfig: data.onboardingConfig ?? undefined,
        saturdaySchedule: data.saturdaySchedule,
        adminGereInscriptions: data.adminGereInscriptions ?? undefined,
        contractEnd: data.contractEnd,
        updatedAt: new Date(),
      },
    });
  }

  async updateAdminGereInscriptions(schoolId: string, adminGereInscriptions: boolean): Promise<void> {
    await this.prisma.school.update({
      where: { id: schoolId },
      data: { adminGereInscriptions },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.school.delete({ where: { id } });
  }

  async countByStatus(status: SchoolStatus): Promise<number> {
    return this.prisma.school.count({ where: { status } });
  }

  async countEleves(schoolId: string): Promise<number> {
    return this.prisma.user.count({
      where: { schoolId, role: 'STUDENT', isActive: true },
    });
  }

  async isEmailDigestAdminEnabled(schoolId: string): Promise<boolean> {
    const s = await (this.prisma as any).schoolNotificationSettings.findUnique({ where: { schoolId }, select: { emailDigestAdmin: true } });
    return s?.emailDigestAdmin ?? false;
  }

  private toDomain(data: any): School {
    return School.reconstituer({
      id: data.id,
      name: data.name,
      subdomain: data.subdomain,
      status: data.status as SchoolStatus,
      plan: data.plan,
      subsystem: data.subsystem as SchoolSubsystem,
      educationType: data.educationType as EducationType,
      ownership: data.ownership as SchoolOwnership,
      city: data.city ?? undefined,
      region: data.region ?? undefined,
      address: data.address ?? undefined,
      phone: data.phone ?? undefined,
      email: data.email ?? undefined,
      logoUrl: data.logoUrl ?? undefined,
      templateCode: data.templateCode ?? undefined,
      onboardingConfig: data.onboardingConfig ?? undefined,
      saturdaySchedule: data.saturdaySchedule,
      adminGereInscriptions: data.adminGereInscriptions ?? false,
      contractEnd: data.contractEnd ?? undefined,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}