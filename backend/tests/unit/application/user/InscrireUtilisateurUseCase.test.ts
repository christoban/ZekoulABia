import { describe, it, expect, beforeEach } from 'bun:test';
import { InscrireUtilisateurUseCase } from '../../../../src/application/user/InscrireUtilisateurUseCase.ts';
import { InMemoryUserRepository } from '../../../helpers/repositories/InMemoryUserRepository.ts';
import type { OutboundMessagingPolicy } from '../../../../src/domain/ports/services/OutboundMessagingPolicy.ts';

describe('InscrireUtilisateurUseCase', () => {
  let userRepo: InMemoryUserRepository;
  let useCase: InscrireUtilisateurUseCase;

  const commandeBase = {
    schoolId: 'school-1',
    role: 'TEACHER' as const,
    email: 'nouveau@test.cm',
    firstName: 'Marie',
    lastName: 'Mballa',
    passwordHash: 'hash-fictif',
  };

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    useCase = new InscrireUtilisateurUseCase(userRepo);
  });

  it('devrait créer un enseignant avec succès', async () => {
    const resultat = await useCase.execute(commandeBase);

    expect(resultat.userId).toBeDefined();
    expect(resultat.nomComplet).toBe('Marie Mballa');
    expect(resultat.role).toBe('TEACHER');
  });

  it('devrait rejeter si email déjà utilisé dans la même école', async () => {
    await useCase.execute(commandeBase);

    await expect(useCase.execute(commandeBase)).rejects.toThrow('existe déjà');
  });

  it('devrait autoriser le même email dans deux écoles différentes', async () => {
    await useCase.execute(commandeBase);

    const resultat = await useCase.execute({
      ...commandeBase,
      schoolId: 'school-2',
    });
    expect(resultat.userId).toBeDefined();
  });

  it('devrait résoudre les permissions STAFF depuis le titre Censeur', async () => {
    const resultat = await useCase.execute({
      schoolId: 'school-1',
      role: 'STAFF',
      email: 'censeur@test.cm',
      firstName: 'Paul',
      lastName: 'Ndi',
      passwordHash: 'hash',
      staffTitle: 'Censeur',
    });

    const user = await userRepo.findById(resultat.userId);
    expect(user?.aPermission('VALIDATE_GRADES')).toBe(true);
    expect(user?.aPermission('MANAGE_TIMETABLE')).toBe(true);
  });

  it('devrait résoudre les permissions STAFF depuis le titre Intendant', async () => {
    const resultat = await useCase.execute({
      schoolId: 'school-1',
      role: 'STAFF',
      email: 'intendant@test.cm',
      firstName: 'Anne',
      lastName: 'Biya',
      passwordHash: 'hash',
      staffTitle: 'Intendant',
    });

    const user = await userRepo.findById(resultat.userId);
    expect(user?.aPermission('MANAGE_FINANCE')).toBe(true);
    expect(user?.aPermission('VALIDATE_GRADES')).toBe(false);
  });

  it('devrait créer un STAFF avec permissions manuelles override', async () => {
    const resultat = await useCase.execute({
      schoolId: 'school-1',
      role: 'STAFF',
      email: 'staff@test.cm',
      firstName: 'Luc',
      lastName: 'Atangana',
      passwordHash: 'hash',
      staffTitle: 'Censeur',
      staffPermissions: ['MANAGE_FINANCE'],
    });

    const user = await userRepo.findById(resultat.userId);
    expect(user?.aPermission('MANAGE_FINANCE')).toBe(true);
    expect(user?.aPermission('VALIDATE_GRADES')).toBe(false);
  });

  it('mode test désactivé : le mot de passe temporaire est renvoyé UNE SEULE fois dans la réponse', async () => {
    const useCaseTest = new InscrireUtilisateurUseCase(userRepo, undefined, {
      estActive: async () => false,
    } as OutboundMessagingPolicy);

    const resultat = await useCaseTest.execute(commandeBase);

    expect(resultat.motDePasseTemporaire).toBeDefined();
  });

  it("mode actif : le mot de passe temporaire n'est pas renvoyé dans la réponse", async () => {
    const useCaseActif = new InscrireUtilisateurUseCase(userRepo, undefined, {
      estActive: async () => true,
    } as OutboundMessagingPolicy);

    const resultat = await useCaseActif.execute(commandeBase);

    expect(resultat.motDePasseTemporaire).toBeUndefined();
  });
});
