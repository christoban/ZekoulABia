export type MasterRoleCode = 'SUPER_ADMIN' | 'PLATFORM_ADMIN' | 'SCHOOL_MANAGER' | 'SUPPORT';

export interface MasterTeamMember {
  id: string;
  email: string;
  name: string;
  role: MasterRoleCode;
  isSuperAdmin: boolean;
  isOwner: boolean;
  isActive: boolean;
  mfaEnabled: boolean;
  assignedSchoolIds: string[];
  createdSchoolsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MasterTeamAuditEntry {
  actorMasterUserId: string;
  action: string;
  targetId?: string | null;
  description: string;
  ipAddress?: string | null;
}

export interface MasterTeamRepository {
  listAll(): Promise<MasterTeamMember[]>;
  findById(id: string): Promise<MasterTeamMember | null>;
  findByEmail(email: string): Promise<MasterTeamMember | null>;
  countActiveOwners(): Promise<number>;
  create(data: {
    email: string;
    name: string;
    passwordHash: string;
    role: MasterRoleCode;
    isSuperAdmin: boolean;
    isOwner?: boolean;
    assignedSchoolIds?: string[];
  }): Promise<MasterTeamMember>;
  update(
    id: string,
    data: {
      name?: string;
      role?: MasterRoleCode;
      isSuperAdmin?: boolean;
      isActive?: boolean;
      assignedSchoolIds?: string[];
      passwordHash?: string;
    },
  ): Promise<MasterTeamMember>;
  delete(id: string): Promise<void>;
  recordAudit(entry: MasterTeamAuditEntry): Promise<void>;
}

