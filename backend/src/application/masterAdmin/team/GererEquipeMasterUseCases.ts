import bcrypt from 'bcryptjs';
import { generateTemporaryPassword } from '@domain/services/PasswordGenerator';
import type {
  MasterRoleCode,
  MasterTeamMember,
  MasterTeamRepository,
} from '@domain/ports/repositories/MasterTeamRepository';
import { MasterAdminNotFoundError, MasterAdminValidationError } from '../errors';

export class MasterTeamForbiddenError extends Error {
  readonly code = 'MASTER_TEAM_FORBIDDEN';
  constructor(message: string) {
    super(message);
    this.name = 'MasterTeamForbiddenError';
  }
}

const VALID_ROLES: ReadonlySet<MasterRoleCode> = new Set([
  'SUPER_ADMIN',
  'PLATFORM_ADMIN',
  'SCHOOL_MANAGER',
  'SUPPORT',
]);

export class ListerEquipeMasterUseCase {
  constructor(private readonly repo: MasterTeamRepository) {}

  async execute(): Promise<MasterTeamMember[]> {
    return this.repo.listAll();
  }
}

export interface CreerMembreEquipeMasterCommand {
  actorId: string;
  actorIsOwner: boolean;
  ipAddress?: string | null;
  email: string;
  name: string;
  role: MasterRoleCode;
  assignedSchoolIds?: string[];
}

export interface CreerMembreEquipeMasterResult {
  member: MasterTeamMember;
  motDePasseTemporaire: string;
  emailSent: boolean;
}

export type EnvoyerEmailMembreMasterFn = (params: {
  recipientEmail: string;
  recipientName: string;
  role: MasterRoleCode;
  temporaryPassword: string;
  isReset?: boolean;
}) => Promise<{ sent: boolean; error?: string }>;

export class CreerMembreEquipeMasterUseCase {
  constructor(
    private readonly repo: MasterTeamRepository,
    private readonly envoyerEmail?: EnvoyerEmailMembreMasterFn,
  ) {}

  async execute(command: CreerMembreEquipeMasterCommand): Promise<CreerMembreEquipeMasterResult> {
    const email = command.email?.trim().toLowerCase();
    const name = command.name?.trim();
    if (!email || !email.includes('@')) {
      throw new MasterAdminValidationError('Adresse email valide requise');
    }
    if (!name) {
      throw new MasterAdminValidationError('Nom complet requis');
    }
    if (!VALID_ROLES.has(command.role)) {
      throw new MasterAdminValidationError('Rôle Master invalide');
    }

    if (command.role === 'SUPER_ADMIN') {
      throw new MasterTeamForbiddenError(
        'Le rôle SUPER_ADMIN est strictement réservé au propriétaire fondateur unique de la plateforme',
      );
    }

    const existing = await this.repo.findByEmail(email);
    if (existing) {
      throw new MasterAdminValidationError(`Un compte Master avec l'email "${email}" existe déjà`);
    }

    const motDePasseTemporaire = generateTemporaryPassword(14);
    const passwordHash = await bcrypt.hash(motDePasseTemporaire, 12);

    const member = await this.repo.create({
      email,
      name,
      passwordHash,
      role: command.role,
      isSuperAdmin: false,
      isOwner: false,
      assignedSchoolIds: Array.from(new Set(command.assignedSchoolIds ?? [])),
    });

    await this.repo.recordAudit({
      actorMasterUserId: command.actorId,
      action: 'master_user_created',
      targetId: member.id,
      description: JSON.stringify({
        email: member.email,
        name: member.name,
        role: member.role,
        assignedSchoolIds: member.assignedSchoolIds,
      }),
      ipAddress: command.ipAddress ?? null,
    });

    let emailSent = false;
    if (this.envoyerEmail) {
      try {
        const res = await this.envoyerEmail({
          recipientEmail: member.email,
          recipientName: member.name,
          role: member.role,
          temporaryPassword: motDePasseTemporaire,
          isReset: false,
        });
        emailSent = res.sent;
      } catch {
        emailSent = false;
      }
    }

    return { member, motDePasseTemporaire, emailSent };
  }
}

export interface ModifierMembreEquipeMasterCommand {
  actorId: string;
  actorIsOwner: boolean;
  ipAddress?: string | null;
  targetId: string;
  name?: string;
  role?: MasterRoleCode;
  isActive?: boolean;
  assignedSchoolIds?: string[];
}

export class ModifierMembreEquipeMasterUseCase {
  constructor(private readonly repo: MasterTeamRepository) {}

  async execute(command: ModifierMembreEquipeMasterCommand): Promise<MasterTeamMember> {
    const target = await this.repo.findById(command.targetId);
    if (!target) {
      throw new MasterAdminNotFoundError('Compte Master introuvable');
    }

    // Protection absolue du propriétaire fondateur
    if (target.isOwner) {
      if (command.isActive === false) {
        throw new MasterTeamForbiddenError('Le propriétaire fondateur ne peut pas être suspendu');
      }
      if (command.role && command.role !== 'SUPER_ADMIN') {
        throw new MasterTeamForbiddenError('Le propriétaire fondateur ne peut pas être rétrogradé');
      }
      if (!command.actorIsOwner || command.actorId !== target.id) {
        throw new MasterTeamForbiddenError('Personne ne peut modifier le compte du propriétaire fondateur');
      }
    }

    if (command.targetId === command.actorId && command.isActive === false) {
      throw new MasterTeamForbiddenError('Vous ne pouvez pas suspendre votre propre compte');
    }

    if (command.role !== undefined && !VALID_ROLES.has(command.role)) {
      throw new MasterAdminValidationError('Rôle Master invalide');
    }

    if (command.role === 'SUPER_ADMIN') {
      throw new MasterTeamForbiddenError(
        'Le rôle SUPER_ADMIN est strictement réservé au propriétaire fondateur unique de la plateforme',
      );
    }

    if (target.role === 'SUPER_ADMIN' && !command.actorIsOwner) {
      throw new MasterTeamForbiddenError(
        'Seul le propriétaire fondateur peut modifier ou suspendre un SUPER_ADMIN',
      );
    }

    const nextRole = command.role ?? target.role;
    const updated = await this.repo.update(target.id, {
      ...(command.name !== undefined ? { name: command.name } : {}),
      ...(command.role !== undefined
        ? { role: nextRole, isSuperAdmin: nextRole === 'SUPER_ADMIN' }
        : {}),
      ...(command.isActive !== undefined ? { isActive: command.isActive } : {}),
      ...(command.assignedSchoolIds !== undefined
        ? { assignedSchoolIds: Array.from(new Set(command.assignedSchoolIds)) }
        : {}),
    });

    await this.repo.recordAudit({
      actorMasterUserId: command.actorId,
      action:
        command.isActive !== undefined && command.isActive !== target.isActive
          ? command.isActive
            ? 'master_user_reactivated'
            : 'master_user_suspended'
          : command.role !== undefined && command.role !== target.role
            ? 'master_user_role_changed'
            : 'master_user_updated',
      targetId: target.id,
      description: JSON.stringify({
        email: target.email,
        avant: {
          role: target.role,
          isActive: target.isActive,
          assignedSchoolIds: target.assignedSchoolIds,
        },
        apres: {
          role: updated.role,
          isActive: updated.isActive,
          assignedSchoolIds: updated.assignedSchoolIds,
        },
      }),
      ipAddress: command.ipAddress ?? null,
    });

    return updated;
  }
}

export class ReinitialiserMotDePasseMembreMasterUseCase {
  constructor(
    private readonly repo: MasterTeamRepository,
    private readonly envoyerEmail?: EnvoyerEmailMembreMasterFn,
  ) {}

  async execute(command: {
    actorId: string;
    actorIsOwner: boolean;
    targetId: string;
    ipAddress?: string | null;
  }): Promise<{ member: MasterTeamMember; motDePasseTemporaire: string; emailSent: boolean }> {
    const target = await this.repo.findById(command.targetId);
    if (!target) {
      throw new MasterAdminNotFoundError('Compte Master introuvable');
    }

    if (target.isOwner && command.actorId !== target.id) {
      throw new MasterTeamForbiddenError('Impossible de réinitialiser le mot de passe du propriétaire fondateur');
    }

    if (target.role === 'SUPER_ADMIN' && !command.actorIsOwner) {
      throw new MasterTeamForbiddenError('Seul le propriétaire fondateur peut réinitialiser un SUPER_ADMIN');
    }

    const motDePasseTemporaire = generateTemporaryPassword(14);
    const passwordHash = await bcrypt.hash(motDePasseTemporaire, 12);
    const updated = await this.repo.update(target.id, { passwordHash });

    await this.repo.recordAudit({
      actorMasterUserId: command.actorId,
      action: 'master_user_password_reset',
      targetId: target.id,
      description: JSON.stringify({ email: target.email }),
      ipAddress: command.ipAddress ?? null,
    });

    let emailSent = false;
    if (this.envoyerEmail) {
      try {
        const res = await this.envoyerEmail({
          recipientEmail: updated.email,
          recipientName: updated.name,
          role: updated.role,
          temporaryPassword: motDePasseTemporaire,
          isReset: true,
        });
        emailSent = res.sent;
      } catch {
        emailSent = false;
      }
    }

    return { member: updated, motDePasseTemporaire, emailSent };
  }
}

export class SupprimerMembreEquipeMasterUseCase {
  constructor(private readonly repo: MasterTeamRepository) {}

  async execute(command: {
    actorId: string;
    actorIsOwner: boolean;
    targetId: string;
    ipAddress?: string | null;
  }): Promise<void> {
    const target = await this.repo.findById(command.targetId);
    if (!target) {
      throw new MasterAdminNotFoundError('Compte Master introuvable');
    }

    if (target.isOwner) {
      throw new MasterTeamForbiddenError('Le compte propriétaire fondateur ne peut jamais être supprimé');
    }

    if (target.id === command.actorId) {
      throw new MasterTeamForbiddenError('Vous ne pouvez pas supprimer votre propre compte');
    }

    if (target.role === 'SUPER_ADMIN' && !command.actorIsOwner) {
      throw new MasterTeamForbiddenError('Seul le propriétaire fondateur peut supprimer un compte SUPER_ADMIN');
    }

    const ownersCount = await this.repo.countActiveOwners();
    if (ownersCount < 1) {
      throw new MasterTeamForbiddenError('Il doit toujours rester au moins un propriétaire actif');
    }

    await this.repo.delete(target.id);

    await this.repo.recordAudit({
      actorMasterUserId: command.actorId,
      action: 'master_user_deleted',
      targetId: target.id,
      description: JSON.stringify({
        email: target.email,
        name: target.name,
        role: target.role,
      }),
      ipAddress: command.ipAddress ?? null,
    });
  }
}

