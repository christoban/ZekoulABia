import { describe, it, expect, beforeEach } from 'bun:test';
import { traiterLigneStudent } from '@application/user/handlers/StudentImportHandler';
import { InMemoryImportUtilisateursRepository } from '../../../../helpers/repositories/InMemoryImportUtilisateursRepository';
import { InMemoryUserRepository } from '../../../../helpers/repositories/InMemoryUserRepository';
import { InMemoryEmailService } from '../../../../helpers/services/InMemoryEmailService';
import { InMemoryAnneeAcademiqueRepository } from '../../../../helpers/repositories/InMemoryAnneeAcademiqueRepository';
import { InMemoryStudentGroupSetRepository } from '../../../../helpers/repositories/InMemoryStudentGroupSetRepository';
import { InMemoryStudentGroupRepository } from '../../../../helpers/repositories/InMemoryStudentGroupRepository';
import { InMemoryStudentGroupMembershipRepository } from '../../../../helpers/repositories/InMemoryStudentGroupMembershipRepository';
import type { ImportWarning } from '@application/user/ImporterUtilisateursUseCase';

const SCHOOL_ID = 'school-1';

function creerDeps() {
  const importRepository = new InMemoryImportUtilisateursRepository();
  const userRepository = new InMemoryUserRepository();
  const emailService = new InMemoryEmailService();
  const anneeRepository = new InMemoryAnneeAcademiqueRepository();
  const groupSetRepository = new InMemoryStudentGroupSetRepository();
  const groupRepository = new InMemoryStudentGroupRepository();
  const membershipRepository = new InMemoryStudentGroupMembershipRepository();
  importRepository.definirEcole(SCHOOL_ID, 'École test');
  return { importRepository, userRepository, emailService, anneeRepository, groupSetRepository, groupRepository, membershipRepository };
}

function creerLigne(overrides: Record<string, string> = {}) {
  return {
    ligne: 1, nom: 'NGONO', prenom: 'Marie', email: 'marie@test.cm', telephone: '+237690000001',
    classe: '6e A', ...overrides,
  };
}

describe('StudentImportHandler', () => {
  let deps: ReturnType<typeof creerDeps>;
  let warnings: ImportWarning[];

  beforeEach(() => {
    deps = creerDeps();
    warnings = [];
    deps.importRepository.ajouterClasse({ id: 'classe-1', schoolId: SCHOOL_ID, name: '6e A' });
  });

  it('import réussi avec email + classe valides', async () => {
    await traiterLigneStudent(deps, SCHOOL_ID, creerLigne(), 'hash', false, 'Test', new Map([['6e A', 'classe-1']]), new Map(), false);

    const users = [...deps.userRepository['store'].values()];
    expect(users.some(u => u.role === 'STUDENT' && u.firstName === 'Marie')).toBe(true);
  });

  it('erreur si nom manquant', async () => {
    await expect(traiterLigneStudent(deps, SCHOOL_ID, creerLigne({ nom: '' }), 'hash', false, 'Test', new Map([['6e A', 'classe-1']]), new Map(), false))
      .rejects.toThrow('Nom obligatoire');
  });

  it('erreur si prénom manquant', async () => {
    await expect(traiterLigneStudent(deps, SCHOOL_ID, creerLigne({ prenom: '' }), 'hash', false, 'Test', new Map([['6e A', 'classe-1']]), new Map(), false))
      .rejects.toThrow('Prénom obligatoire');
  });

  it('erreur si ni email ni téléphone fourni', async () => {
    await expect(traiterLigneStudent(deps, SCHOOL_ID, creerLigne({ email: '', telephone: '' }), 'hash', false, 'Test', new Map([['6e A', 'classe-1']]), new Map(), false))
      .rejects.toThrow('Email ou téléphone obligatoire');
  });

  it('erreur si classe fournie introuvable', async () => {
    await expect(traiterLigneStudent(deps, SCHOOL_ID, creerLigne({ classe: '99e Z' }), 'hash', false, 'Test', new Map([['6e A', 'classe-1']]), new Map(), false))
      .rejects.toThrow('Classe "99e Z" introuvable');
  });

  it('parent créé automatiquement si emailParent fourni et parent inexistant', async () => {
    await traiterLigneStudent(deps, SCHOOL_ID, creerLigne({ emailParent: 'parent@test.cm', prenomParent: 'Robert', nomParent: 'NGONO' }), 'hash', false, 'Test', new Map([['6e A', 'classe-1']]), new Map(), false);

    const parents = [...deps.userRepository['store'].values()].filter(u => u.role === 'PARENT');
    expect(parents).toHaveLength(1);
    expect(parents[0].email).toBe('parent@test.cm');
  });

  it('parent existant réutilisé si emailParent correspond', async () => {
    deps.importRepository.ajouterParent(SCHOOL_ID, 'parent@test.cm', 'parent-existant');

    await traiterLigneStudent(deps, SCHOOL_ID, creerLigne({ emailParent: 'parent@test.cm' }), 'hash', false, 'Test', new Map([['6e A', 'classe-1']]), new Map(), false);

    const parents = [...deps.userRepository['store'].values()].filter(u => u.role === 'PARENT');
    expect(parents).toHaveLength(0); // pas de nouveau parent créé
  });

  it('PEBS appliqué correctement quand fourni et valide', async () => {
    await traiterLigneStudent(deps, SCHOOL_ID, creerLigne({ pebs: 'FR_PEBS' }), 'hash', false, 'Test', new Map([['6e A', 'classe-1']]), new Map(), false);

    expect(deps.importRepository.pebsUpdates).toHaveLength(1);
    expect(deps.importRepository.pebsUpdates[0].pebsFiliere).toBe('FR_PEBS');
  });

  it('erreur si valeur PEBS invalide', async () => {
    await expect(traiterLigneStudent(deps, SCHOOL_ID, creerLigne({ pebs: 'INVALID' }), 'hash', false, 'Test', new Map([['6e A', 'classe-1']]), new Map(), false))
      .rejects.toThrow('Valeur PEBS invalide');
  });

  it('LV2 appliqué correctement quand fourni et valide', async () => {
    deps.importRepository.ajouterMatiere({ id: 'lv2-ang', schoolId: SCHOOL_ID, name: 'Anglais LV2', isLV2: true });

    await traiterLigneStudent(deps, SCHOOL_ID, creerLigne({ lv2: 'Anglais LV2' }), 'hash', false, 'Test', new Map([['6e A', 'classe-1']]), new Map([['anglais lv2', 'lv2-ang']]), false);

    expect(deps.importRepository.lv2Updates).toHaveLength(1);
    expect(deps.importRepository.lv2Updates[0].lv2SubjectId).toBe('lv2-ang');
  });

  it('erreur si LV2 introuvable', async () => {
    await expect(traiterLigneStudent(deps, SCHOOL_ID, creerLigne({ lv2: 'Espagnol' }), 'hash', false, 'Test', new Map([['6e A', 'classe-1']]), new Map(), false))
      .rejects.toThrow('Langue LV2 introuvable');
  });
});
