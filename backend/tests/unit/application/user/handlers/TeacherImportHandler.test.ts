import { describe, it, expect, beforeEach } from 'bun:test';
import { traiterLigneTeacher } from '@application/user/handlers/TeacherImportHandler';
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
  return { nom: 'NGONO', prenom: 'Jean', email: 'jean@test.cm', ...overrides };
}

describe('TeacherImportHandler', () => {
  let deps: ReturnType<typeof creerDeps>;
  let classeCache: Map<string, string>;

  beforeEach(() => {
    deps = creerDeps();
    classeCache = new Map([['6e A', 'classe-1']]);
    deps.importRepository.ajouterClasse({ id: 'classe-1', schoolId: SCHOOL_ID, name: '6e A', level: '6e' });
    deps.importRepository.ajouterMatiere({ id: 'math-1', schoolId: SCHOOL_ID, name: 'Mathématiques' });
  });

  it('import réussi avec email et matières valides', async () => {
    const result = await traiterLigneTeacher(deps, SCHOOL_ID, creerLigne({ matieres: 'Mathématiques' }), 'hash', false, 'Test', classeCache);

    expect(result.ppAssigned).toBe(false);
    const users = [...deps.userRepository['store'].values()];
    expect(users.some(u => u.role === 'TEACHER' && u.firstName === 'Jean')).toBe(true);
  });

  it('erreur si email déjà utilisé dans l\'école', async () => {
    const { User } = await import('@domain/entities/User');
    deps.userRepository.ajouter(User.create({ schoolId: SCHOOL_ID, role: 'TEACHER', email: 'jean@test.cm', firstName: 'Jean', lastName: 'Existant' }));

    await expect(traiterLigneTeacher(deps, SCHOOL_ID, creerLigne(), 'hash', false, 'Test', classeCache))
      .rejects.toThrow('Email déjà utilisé');
  });

  it('erreur si une matière listée est introuvable', async () => {
    await expect(traiterLigneTeacher(deps, SCHOOL_ID, creerLigne({ matieres: 'Inexistante' }), 'hash', false, 'Test', classeCache))
      .rejects.toThrow('Matières introuvables');
  });

  it('désignation PP réussie si classe_principale fournie et libre', async () => {
    const result = await traiterLigneTeacher(deps, SCHOOL_ID, creerLigne({ matieres: 'Mathématiques', classePrincipale: '6e A' }), 'hash', false, 'Test', classeCache);

    expect(result.ppAssigned).toBe(true);
    const classe = await deps.importRepository.findClassePourPP(SCHOOL_ID, '6e A');
    expect(classe?.professorPrincipalId).toBeDefined();
  });

  it('pas de PP si la classe a déjà un PP', async () => {
    deps.importRepository.ajouterClasse({ id: 'classe-1', schoolId: SCHOOL_ID, name: '6e A', professorPrincipalId: 'autre-enseignant' });

    const result = await traiterLigneTeacher(deps, SCHOOL_ID, creerLigne({ classePrincipale: '6e A' }), 'hash', false, 'Test', classeCache);

    expect(result.ppAssigned).toBe(false);
    expect(result.ppError).toContain('déjà un Professeur Principal');
  });

  it('affectations pédagogiques créées uniquement pour matières du programme', async () => {
    deps.importRepository.definirProgrammeClasse('classe-1', ['math-1']);
    const result = await traiterLigneTeacher(deps, SCHOOL_ID, creerLigne({ matieres: 'Mathématiques', classePrincipale: '6e A' }), 'hash', false, 'Test', classeCache);

    expect(result.ppAssigned).toBe(true);
    expect(result.affectationsCreees).toBe(1);
  });
});
