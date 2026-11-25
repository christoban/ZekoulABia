import { describe, it, expect } from 'bun:test';
import {
  CreerMembreEquipeMasterUseCase,
  ModifierMembreEquipeMasterUseCase,
  SupprimerMembreEquipeMasterUseCase,
  ReinitialiserMotDePasseMembreMasterUseCase,
  MasterTeamForbiddenError,
} from '../../../../src/application/masterAdmin/team/GererEquipeMasterUseCases';
import {
  peutGererEcoleMaster,
  peutVoirEcoleMaster,
} from '../../../../src/application/masterAdmin/masterSchoolAccess';
import type {
  MasterTeamRepository,
  MasterTeamMember,
} from '../../../../src/domain/ports/repositories/MasterTeamRepository';

function creerMemoireMasterTeamRepo(initial: MasterTeamMember[] = []): {
  repo: MasterTeamRepository;
  audits: Array<{ actorMasterUserId: string; action: string; targetId?: string | null }>;
  storedHashes: Map<string, string>;
} {
  const members = new Map<string, MasterTeamMember>(initial.map((m) => [m.id, { ...m }]));
  const storedHashes = new Map<string, string>();
  const audits: Array<{ actorMasterUserId: string; action: string; targetId?: string | null }> = [];

  const repo: MasterTeamRepository = {
    async listAll() {
      return [...members.values()];
    },
    async findById(id) {
      return members.get(id) ?? null;
    },
    async findByEmail(email) {
      for (const m of members.values()) {
        if (m.email === email) return m;
      }
      return null;
    },
    async countActiveOwners() {
      return [...members.values()].filter((m) => m.isOwner && m.isActive).length;
    },
    async create(input) {
      const id = `master-${members.size + 1}`;
      storedHashes.set(id, input.passwordHash);
      const record: MasterTeamMember = {
        id,
        email: input.email,
        name: input.name,
        role: input.role,
        isSuperAdmin: input.isSuperAdmin,
        isOwner: Boolean(input.isOwner),
        isActive: true,
        mfaEnabled: false,
        assignedSchoolIds: input.assignedSchoolIds ?? [],
        createdSchoolsCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      members.set(id, record);
      return record;
    },
    async update(id, input) {
      const existing = members.get(id);
      if (!existing) throw new Error('Introuvable');
      if (input.passwordHash) {
        storedHashes.set(id, input.passwordHash);
      }
      const updated: MasterTeamMember = {
        ...existing,
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.isSuperAdmin !== undefined ? { isSuperAdmin: input.isSuperAdmin } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.assignedSchoolIds !== undefined ? { assignedSchoolIds: input.assignedSchoolIds } : {}),
        updatedAt: new Date(),
      };
      members.set(id, updated);
      return updated;
    },
    async delete(id) {
      members.delete(id);
    },
    async recordAudit(entry) {
      audits.push({
        actorMasterUserId: entry.actorMasterUserId,
        action: entry.action,
        targetId: entry.targetId,
      });
    },
  };

  return { repo, audits, storedHashes };
}

const ownerRecord: MasterTeamMember = {
  id: 'owner-1',
  email: 'founder@zekoulabia.cm',
  name: 'Fondateur',
  role: 'SUPER_ADMIN',
  isSuperAdmin: true,
  isOwner: true,
  isActive: true,
  mfaEnabled: true,
  assignedSchoolIds: [],
  createdSchoolsCount: 2,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const secondarySuperAdmin: MasterTeamMember = {
  id: 'super-2',
  email: 'secours@zekoulabia.cm',
  name: 'Super Secours',
  role: 'SUPER_ADMIN',
  isSuperAdmin: true,
  isOwner: false,
  isActive: true,
  mfaEnabled: true,
  assignedSchoolIds: [],
  createdSchoolsCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const testerRecord: MasterTeamMember = {
  id: 'tester-1',
  email: 'tester@zekoulabia.cm',
  name: 'Testeur Coéquipier',
  role: 'PLATFORM_ADMIN',
  isSuperAdmin: false,
  isOwner: false,
  isActive: true,
  mfaEnabled: false,
  assignedSchoolIds: ['school-assigned'],
  createdSchoolsCount: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Gestion de l’équipe Master & Protection du Propriétaire (isOwner)', () => {
  it('crée un compte PLATFORM_ADMIN avec mot de passe temporaire hashé et journalise en base', async () => {
    const { repo, audits, storedHashes } = creerMemoireMasterTeamRepo([ownerRecord]);
    const uc = new CreerMembreEquipeMasterUseCase(repo);

    const res = await uc.execute({
      actorId: ownerRecord.id,
      actorIsOwner: true,
      email: 'nouveau.testeur@zekoulabia.cm',
      name: 'Nouveau Testeur',
      role: 'PLATFORM_ADMIN',
    });

    expect(res.member.role).toBe('PLATFORM_ADMIN');
    expect(res.member.isSuperAdmin).toBe(false);
    expect(res.member.isOwner).toBe(false);
    expect(res.motDePasseTemporaire.length).toBeGreaterThanOrEqual(12);
    expect(storedHashes.get(res.member.id)).not.toBe(res.motDePasseTemporaire);
    expect(audits).toHaveLength(1);
    expect(audits[0]?.action).toBe('master_user_created');
  });

  it('interdit la création ou la promotion d’un second SUPER_ADMIN (le fondateur reste l’unique SUPER_ADMIN)', async () => {
    const { repo } = creerMemoireMasterTeamRepo([ownerRecord, secondarySuperAdmin, testerRecord]);
    const creerUc = new CreerMembreEquipeMasterUseCase(repo);
    const modifierUc = new ModifierMembreEquipeMasterUseCase(repo);

    await expect(
      creerUc.execute({
        actorId: ownerRecord.id,
        actorIsOwner: true,
        email: 'autre.super@zekoulabia.cm',
        name: 'Autre Super',
        role: 'SUPER_ADMIN',
      }),
    ).rejects.toBeInstanceOf(MasterTeamForbiddenError);

    await expect(
      modifierUc.execute({
        actorId: ownerRecord.id,
        actorIsOwner: true,
        targetId: testerRecord.id,
        role: 'SUPER_ADMIN',
      }),
    ).rejects.toBeInstanceOf(MasterTeamForbiddenError);
  });

  it('protège le compte propriétaire (isOwner: true) contre toute rétrogradation, suspension ou suppression', async () => {
    const { repo } = creerMemoireMasterTeamRepo([ownerRecord, secondarySuperAdmin]);
    const modifierUc = new ModifierMembreEquipeMasterUseCase(repo);
    const supprimerUc = new SupprimerMembreEquipeMasterUseCase(repo);
    const resetPwdUc = new ReinitialiserMotDePasseMembreMasterUseCase(repo);

    await expect(
      modifierUc.execute({
        actorId: ownerRecord.id,
        actorIsOwner: true,
        targetId: ownerRecord.id,
        role: 'PLATFORM_ADMIN',
      }),
    ).rejects.toBeInstanceOf(MasterTeamForbiddenError);

    await expect(
      modifierUc.execute({
        actorId: ownerRecord.id,
        actorIsOwner: true,
        targetId: ownerRecord.id,
        isActive: false,
      }),
    ).rejects.toBeInstanceOf(MasterTeamForbiddenError);

    await expect(
      supprimerUc.execute({
        actorId: secondarySuperAdmin.id,
        actorIsOwner: false,
        targetId: ownerRecord.id,
      }),
    ).rejects.toBeInstanceOf(MasterTeamForbiddenError);

    await expect(
      resetPwdUc.execute({
        actorId: secondarySuperAdmin.id,
        actorIsOwner: false,
        targetId: ownerRecord.id,
      }),
    ).rejects.toBeInstanceOf(MasterTeamForbiddenError);
  });
});

describe('Isolation des écoles par opérateur Master (masterSchoolAccess)', () => {
  it('autorise SUPER_ADMIN et PLATFORM_ADMIN (bras droit) à voir et gérer toutes les écoles', () => {
    const superOp = { id: 'owner-1', role: 'super_admin', isOwner: true, assignedSchoolIds: [] };
    const platformOp = { id: 'plat-1', role: 'platform_admin', assignedSchoolIds: [] };

    expect(peutVoirEcoleMaster(superOp, 'school-tester-1', 'tester-1')).toBe(true);
    expect(peutGererEcoleMaster(superOp, 'school-tester-1', 'tester-1')).toBe(true);
    expect(peutVoirEcoleMaster(platformOp, 'school-other', 'owner-1')).toBe(true);
    expect(peutGererEcoleMaster(platformOp, 'school-other', 'owner-1')).toBe(true);
  });

  it('isole SCHOOL_MANAGER uniquement sur ses écoles créées ou assignées', () => {
    const schoolManagerOp = {
      id: 'tester-1',
      role: 'school_manager',
      assignedSchoolIds: ['school-assigned'],
    };

    expect(peutVoirEcoleMaster(schoolManagerOp, 'school-tester-1', 'tester-1')).toBe(true);
    expect(peutGererEcoleMaster(schoolManagerOp, 'school-tester-1', 'tester-1')).toBe(true);
    expect(peutGererEcoleMaster(schoolManagerOp, 'school-assigned', 'owner-1')).toBe(true);
    expect(peutVoirEcoleMaster(schoolManagerOp, 'school-other', 'owner-1')).toBe(false);
    expect(peutGererEcoleMaster(schoolManagerOp, 'school-other', 'owner-1')).toBe(false);
  });

  it('autorise SUPPORT en lecture seule mais interdit toute gestion/modification d’école', () => {
    const supportOp = { id: 'sup-1', role: 'support', assignedSchoolIds: [] };
    expect(peutVoirEcoleMaster(supportOp, 'school-other', 'owner-1')).toBe(true);
    expect(peutGererEcoleMaster(supportOp, 'school-other', 'owner-1')).toBe(false);
  });
});
