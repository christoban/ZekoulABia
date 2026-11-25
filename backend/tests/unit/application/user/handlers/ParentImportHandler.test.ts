import { describe, it, expect, beforeEach } from 'bun:test';
import { traiterLigneParent } from '@application/user/handlers/ParentImportHandler';
import { InMemoryImportUtilisateursRepository } from '../../../../helpers/repositories/InMemoryImportUtilisateursRepository';
import { InMemoryUserRepository } from '../../../../helpers/repositories/InMemoryUserRepository';
import { InMemoryEmailService } from '../../../../helpers/services/InMemoryEmailService';

const SCHOOL_ID = 'school-1';

function creerDeps() {
  const importRepository = new InMemoryImportUtilisateursRepository();
  const userRepository = new InMemoryUserRepository();
  const emailService = new InMemoryEmailService();
  importRepository.definirEcole(SCHOOL_ID, 'École test');
  return { importRepository, userRepository, emailService };
}

function creerLigne(overrides: Record<string, string> = {}) {
  return { nom: 'NGONO', prenom: 'Robert', email: 'robert@test.cm', ...overrides };
}

describe('ParentImportHandler', () => {
  let deps: ReturnType<typeof creerDeps>;

  beforeEach(() => {
    deps = creerDeps();
  });

  it('import réussi avec matricules_enfants correspondant à des élèves existants', async () => {
    deps.importRepository.ajouterEleve({ schoolId: SCHOOL_ID, matricule: '2025001', studentProfileId: 'sp-1' });

    await traiterLigneParent(deps, SCHOOL_ID, creerLigne({ matriculesEnfants: '2025001' }), 'hash', false, 'Test');

    const parents = [...deps.userRepository['store'].values()].filter(u => u.role === 'PARENT');
    expect(parents).toHaveLength(1);
    expect(deps.userRepository.profilsSauvegardes.get(parents[0].id)?.parentOfStudentIds).toEqual(['sp-1']);
  });

  it('import réussi avec emails_enfants correspondant à des élèves existants', async () => {
    deps.importRepository.ajouterEleve({ schoolId: SCHOOL_ID, email: 'eleve@test.cm', studentProfileId: 'sp-2' });

    await traiterLigneParent(deps, SCHOOL_ID, creerLigne({ emailsEnfants: 'eleve@test.cm' }), 'hash', false, 'Test');

    const parents = [...deps.userRepository['store'].values()].filter(u => u.role === 'PARENT');
    expect(parents).toHaveLength(1);
    expect(deps.userRepository.profilsSauvegardes.get(parents[0].id)?.parentOfStudentIds).toEqual(['sp-2']);
  });

  it('parent créé même si aucun enfant trouvé (warning pas erreur)', async () => {
    // Pas d'élèves dans le repository
    await traiterLigneParent(deps, SCHOOL_ID, creerLigne({ matriculesEnfants: '9999' }), 'hash', false, 'Test');

    const parents = [...deps.userRepository['store'].values()].filter(u => u.role === 'PARENT');
    expect(parents).toHaveLength(1);
  });

  it('erreur si nom manquant', async () => {
    await expect(traiterLigneParent(deps, SCHOOL_ID, creerLigne({ nom: '' }), 'hash', false, 'Test'))
      .rejects.toThrow('Nom obligatoire');
  });

  it('erreur si ni email ni téléphone fourni', async () => {
    await expect(traiterLigneParent(deps, SCHOOL_ID, creerLigne({ email: '', telephone: '' }), 'hash', false, 'Test'))
      .rejects.toThrow('Email ou téléphone obligatoire');
  });
});
