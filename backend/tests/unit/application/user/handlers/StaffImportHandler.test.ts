import { describe, it, expect, beforeEach } from 'bun:test';
import { traiterLigneStaff } from '@application/user/handlers/StaffImportHandler';
import { InMemoryImportUtilisateursRepository } from '../../../../helpers/repositories/InMemoryImportUtilisateursRepository';
import { InMemoryUserRepository } from '../../../../helpers/repositories/InMemoryUserRepository';
import { InMemoryEmailService } from '../../../../helpers/services/InMemoryEmailService';
import type { ImportWarning } from '@application/user/ImporterUtilisateursUseCase';

const SCHOOL_ID = 'school-1';

function creerDeps() {
  const importRepository = new InMemoryImportUtilisateursRepository();
  const userRepository = new InMemoryUserRepository();
  const emailService = new InMemoryEmailService();
  importRepository.definirEcole(SCHOOL_ID, 'École test');
  return { importRepository, userRepository, emailService };
}

function creerLigne(overrides: Record<string, string> = {}) {
  return { nom: 'NGONO', prenom: 'Jean', email: 'jean@test.cm', fonction: 'Censeur', ...overrides };
}

describe('StaffImportHandler', () => {
  let deps: ReturnType<typeof creerDeps>;
  let warnings: ImportWarning[];

  beforeEach(() => {
    deps = creerDeps();
    warnings = [];
  });

  it('import réussi avec fonction reconnue → permissions résolues', async () => {
    await traiterLigneStaff(deps, SCHOOL_ID, creerLigne(), 'hash', false, 'Test', warnings, 1);

    const users = [...deps.userRepository['store'].values()];
    const staff = users.find(u => u.role === 'STAFF');
    expect(staff).toBeDefined();
    expect(staff?.staffPermissions).toContain('VALIDATE_GRADES');
    expect(warnings).toHaveLength(0);
  });

  it('warning si fonction non reconnue → import continue', async () => {
    await traiterLigneStaff(deps, SCHOOL_ID, creerLigne({ fonction: 'FonctionInconnue' }), 'hash', false, 'Test', warnings, 1);

    const users = [...deps.userRepository['store'].values()];
    expect(users.some(u => u.role === 'STAFF')).toBe(true);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].avertissement).toContain('non reconnue');
  });

  it('section résolue en sectionId si section existe', async () => {
    deps.importRepository.ajouterSection({ id: 'sec-fr', schoolId: SCHOOL_ID, name: 'Francophone' });

    await traiterLigneStaff(deps, SCHOOL_ID, creerLigne({ section: 'Francophone' }), 'hash', false, 'Test', warnings, 1);

    const users = [...deps.userRepository['store'].values()];
    const staff = users.find(u => u.role === 'STAFF');
    expect(staff?.toObject().staffSectionId).toBe('sec-fr');
  });

  it('warning si section introuvable → import continue sans section', async () => {
    await traiterLigneStaff(deps, SCHOOL_ID, creerLigne({ section: 'Inexistante' }), 'hash', false, 'Test', warnings, 1);

    const users = [...deps.userRepository['store'].values()];
    const staff = users.find(u => u.role === 'STAFF');
    expect(staff?.toObject().staffSectionId).toBeUndefined();
    expect(warnings).toHaveLength(1);
    expect(warnings[0].avertissement).toContain('Section');
  });

  it('erreur si email déjà utilisé', async () => {
    const { User } = await import('@domain/entities/User');
    deps.userRepository.ajouter(User.create({ schoolId: SCHOOL_ID, role: 'STAFF', email: 'jean@test.cm', firstName: 'Jean', lastName: 'Existant' }));

    await expect(traiterLigneStaff(deps, SCHOOL_ID, creerLigne(), 'hash', false, 'Test', warnings, 1))
      .rejects.toThrow('Email déjà utilisé');
  });

  it('erreur si fonction manquante', async () => {
    await expect(traiterLigneStaff(deps, SCHOOL_ID, creerLigne({ fonction: '' }), 'hash', false, 'Test', warnings, 1))
      .rejects.toThrow('Fonction/Titre obligatoire');
  });
});
