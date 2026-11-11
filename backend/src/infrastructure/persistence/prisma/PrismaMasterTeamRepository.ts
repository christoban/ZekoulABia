import type { PrismaClient } from '@prisma/client';
import type {
  MasterRoleCode,
  MasterTeamAuditEntry,
  MasterTeamMember,
  MasterTeamRepository,
} from '@domain/ports/repositories/MasterTeamRepository';

const SELECT_MEMBER = {
  id: true,
  email: true,
  name: true,
  role: true,
  isSuperAdmin: true,
  isOwner: true,
  isActive: true,
  mfaEnabled: true,
  assignedSchoolIds: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: { createdSchools: true },
  },
} as const;

type PrismaMemberRow = {
  id: string;
  email: string;
  name: string;
  role: MasterRoleCode;
  isSuperAdmin: boolean;
  isOwner: boolean;
  isActive: boolean;
  mfaEnabled: boolean;
  assignedSchoolIds: string[];
  createdAt: Date;
  updatedAt: Date;
  _count: { createdSchools: number };
};

function mapRow(row: PrismaMemberRow): MasterTeamMember {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.isSuperAdmin ? 'SUPER_ADMIN' : row.role,
    isSuperAdmin: row.isSuperAdmin || row.role === 'SUPER_ADMIN',
    isOwner: row.isOwner,
    isActive: row.isActive,
    mfaEnabled: row.mfaEnabled,
    assignedSchoolIds: row.assignedSchoolIds ?? [],
    createdSchoolsCount: row._count.createdSchools,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaMasterTeamRepository implements MasterTeamRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listAll(): Promise<MasterTeamMember[]> {
    const rows = await this.prisma.masterUser.findMany({
      orderBy: [{ isOwner: 'desc' }, { isSuperAdmin: 'desc' }, { createdAt: 'asc' }],
      select: SELECT_MEMBER,
    });
    return rows.map((r) => mapRow(r as PrismaMemberRow));
  }

  async findById(id: string): Promise<MasterTeamMember | null> {
    const row = await this.prisma.masterUser.findUnique({
      where: { id },
      select: SELECT_MEMBER,
    });
    return row ? mapRow(row as PrismaMemberRow) : null;
  }

  async findByEmail(email: string): Promise<MasterTeamMember | null> {
    const row = await this.prisma.masterUser.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: SELECT_MEMBER,
    });
    return row ? mapRow(row as PrismaMemberRow) : null;
  }

  async countActiveOwners(): Promise<number> {
    return this.prisma.masterUser.count({
      where: { isOwner: true, isActive: true },
    });
  }

  async create(data: {
    email: string;
    name: string;
    passwordHash: string;
    role: MasterRoleCode;
    isSuperAdmin: boolean;
    isOwner?: boolean;
    assignedSchoolIds?: string[];
  }): Promise<MasterTeamMember> {
    const row = await this.prisma.masterUser.create({
      data: {
        email: data.email.trim().toLowerCase(),
        name: data.name.trim(),
        passwordHash: data.passwordHash,
        role: data.role,
        isSuperAdmin: data.isSuperAdmin,
        isOwner: data.isOwner ?? false,
        isActive: true,
        assignedSchoolIds: data.assignedSchoolIds ?? [],
      },
      select: SELECT_MEMBER,
    });
    return mapRow(row as PrismaMemberRow);
  }

  async update(
    id: string,
    data: {
      name?: string;
      role?: MasterRoleCode;
      isSuperAdmin?: boolean;
      isActive?: boolean;
      assignedSchoolIds?: string[];
      passwordHash?: string;
    },
  ): Promise<MasterTeamMember> {
    const row = await this.prisma.masterUser.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.role !== undefined ? { role: data.role } : {}),
        ...(data.isSuperAdmin !== undefined ? { isSuperAdmin: data.isSuperAdmin } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.assignedSchoolIds !== undefined ? { assignedSchoolIds: data.assignedSchoolIds } : {}),
        ...(data.passwordHash !== undefined ? { passwordHash: data.passwordHash } : {}),
      },
      select: SELECT_MEMBER,
    });
    return mapRow(row as PrismaMemberRow);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Détacher les traces d'audit et d'invitation avant suppression du compte Master
      await tx.masterAuthAudit.updateMany({
        where: { masterUserId: id },
        data: { masterUserId: null },
      });
      await tx.schoolInvite.updateMany({
        where: { invitedByMasterId: id },
        data: { invitedByMasterId: null },
      });
      await tx.school.updateMany({
        where: { createdByMasterId: id },
        data: { createdByMasterId: null },
      });
      await tx.masterUser.delete({ where: { id } });
    });
  }

  async recordAudit(entry: MasterTeamAuditEntry): Promise<void> {
    await this.prisma.masterAuthAudit.create({
      data: {
        masterUserId: entry.actorMasterUserId,
        action: entry.action.startsWith('action:') ? entry.action : `action:${entry.action}`,
        targetId: entry.targetId ?? null,
        description: entry.description,
        ipAddress: entry.ipAddress ?? null,
      },
    });
  }
}

