import { describe, it, expect, beforeEach } from 'bun:test';
import { ImporterUtilisateursUseCase } from '@application/user/ImporterUtilisateursUseCase';
import { InMemoryImportUtilisateursRepository } from '../../../helpers/repositories/InMemoryImportUtilisateursRepository';
import { InMemoryUserRepository } from '../../../helpers/repositories/InMemoryUserRepository';
import { InMemoryEmailService } from '../../../helpers/services/InMemoryEmailService';
import { StubCreerClasseUseCase } from '../../../helpers/stubs/StubCreerClasseUseCase';
import { InMemoryAnneeAcademiqueRepository } from '../../../helpers/repositories/InMemoryAnneeAcademiqueRepository';
import { InMemoryStudentGroupSetRepository } from '../../../helpers/repositories/InMemoryStudentGroupSetRepository';
import { InMemoryStudentGroupRepository } from '../../../helpers/repositories/InMemoryStudentGroupRepository';
import { InMemoryStudentGroupMembershipRepository } from '../../../helpers/repositories/InMemoryStudentGroupMembershipRepository';

const SCHOOL_ID = 'school-1';

function creerUseCase() {
  const importRepo = new InMemoryImportUtilisateursRepository();
  const userRepo = new InMemoryUserRepository();
  const emailService = new InMemoryEmailService();
  const creerClasseUC = new StubCreerClasseUseCase();
  const anneeRepo = new InMemoryAnneeAcademiqueRepository();
  const groupSetRepo = new InMemoryStudentGroupSetRepository();
  const groupRepo = new InMemoryStudentGroupRepository();
  const membershipRepo = new InMemoryStudentGroupMembershipRepository();

  importRepo.definirEcole(SCHOOL_ID, 'École test');

  const useCase = new ImporterUtilisateursUseCase(
    importRepo, userRepo, anneeRepo, groupSetRepo, groupRepo, membershipRepo, emailService, creerClasseUC,
  );

  return { useCase, importRepo, userRepo, emailService, creerClasseUC };
}

describe('ImporterUtilisateursUseCase — dispatcher', () => {
  let result: Awaited<ReturnType<ImporterUtilisateursUseCase['execute']>>;

  it('route STUDENT vers le traitement STUDENT (utilisateur créé)', async () => {
    const { useCase, importRepo, userRepo } = creerUseCase();
    importRepo.ajouterClasse({ id: 'classe-1', schoolId: SCHOOL_ID, name: '6e A' });

    result = await useCase.execute(SCHOOL_ID, 'STUDENT', [
      { nom: 'NGONO', prenom: 'Marie', email: 'marie@test.cm', telephone: '+237690000001', classe: '6e A' },
    ]);

    expect(result.success).toBe(1);
    expect(result.elevesCrees).toBe(1);
    const users = [...userRepo['store'].values()];
    expect(users.some(u => u.role === 'STUDENT')).toBe(true);
  });

  it('route CLASSE vers CreerClasseUseCase', async () => {
    const { useCase, creerClasseUC } = creerUseCase();

    result = await useCase.execute(SCHOOL_ID, 'CLASSE', [
      { nom: '6e A', niveau: '6e', capacite: '45' },
    ]);

    expect(result.success).toBe(1);
    expect(result.classesCrees).toBe(1);
    expect(creerClasseUC.appels).toHaveLength(1);
    expect(creerClasseUC.appels[0].name).toBe('6e A');
    expect(creerClasseUC.appels[0].level).toBe('6e');
    expect(creerClasseUC.appels[0].capacity).toBe(45);
  });

  it('une erreur sur une ligne n\'arrête pas le traitement des lignes suivantes', async () => {
    const { useCase, importRepo } = creerUseCase();
    importRepo.ajouterClasse({ id: 'classe-1', schoolId: SCHOOL_ID, name: '6e A' });

    result = await useCase.execute(SCHOOL_ID, 'STUDENT', [
      { nom: 'OK1', prenom: 'Premier', email: 'ok1@test.cm', telephone: '+237690000001', classe: '6e A' },
      { nom: '', prenom: '', email: '', telephone: '' }, // ligne invalide
      { nom: 'OK3', prenom: 'Troisieme', email: 'ok3@test.cm', telephone: '+237690000003', classe: '6e A' },
    ]);

    expect(result.total).toBe(3);
    expect(result.success).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].ligne).toBe(2);
  });

  it('retourne les bons compteurs pour un lot mixte', async () => {
    const { useCase } = creerUseCase();

    result = await useCase.execute(SCHOOL_ID, 'STUDENT', [
      { nom: 'E1', prenom: 'A', email: 'e1@test.cm', telephone: '+237690000001' },
      { nom: 'E2', prenom: 'B', email: 'e2@test.cm', telephone: '+237690000002' },
    ]);

    expect(result.total).toBe(2);
    expect(result.elevesCrees).toBe(2);
    expect(result.enseignantsCrees).toBe(0);
    expect(result.staffCrees).toBe(0);
    expect(result.parentsCrees).toBe(0);
    expect(result.classesCrees).toBe(0);
  });

  it('émet un avertissement lorsque la capacité de la classe est atteinte ou dépassée', async () => {
    const { useCase, importRepo } = creerUseCase();
    importRepo.ajouterClasse({
      id: 'classe-pleine',
      schoolId: SCHOOL_ID,
      name: '6e B',
      capacity: 2,
      currentEnrollments: 1,
    });

    result = await useCase.execute(SCHOOL_ID, 'STUDENT', [
      { nom: 'E1', prenom: 'A', email: 'e1@test.cm', telephone: '+237690000001', classe: '6e B' },
      { nom: 'E2', prenom: 'B', email: 'e2@test.cm', telephone: '+237690000002', classe: '6e B' },
    ]);

    expect(result.success).toBe(2);
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    expect(result.warnings.some(w => w.avertissement.includes('capacité maximale'))).toBe(true);
  });
});
