import { describe, it, expect, beforeEach } from 'bun:test';
import { EnregistrerDepenseUseCase } from '../../../../src/application/finance/EnregistrerDepenseUseCase.ts';
import { InMemoryDepenseRepository } from '../../../helpers/repositories/InMemoryDepenseRepository.ts';
import { InMemoryUserRepository } from '../../../helpers/repositories/InMemoryUserRepository.ts';
import { User } from '@domain/entities/User';
import { SeparationOrdonnateurError } from '@domain/errors/SeparationOrdonnateurError';

describe('EnregistrerDepenseUseCase — Loi 2 Art. 34 & 39 MINESEC', () => {
  let depenseRepo: InMemoryDepenseRepository;
  let userRepo: InMemoryUserRepository;
  let useCase: EnregistrerDepenseUseCase;

  const intendant = User.reconstituer({
    id: 'intendant-1',
    schoolId: 'school-1',
    role: 'STAFF',
    email: 'intendant@test.cm',
    firstName: 'Paul',
    lastName: 'Ndi',
    isActive: true,
    refreshTokenVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    staffPermissions: ['MANAGE_FINANCE', 'VALIDATE_PAYMENTS', 'GENERATE_REPORTS'],
  });                  

  const proviseur = User.reconstituer({
    id: 'proviseur-1',
    schoolId: 'school-1',
    role: 'ADMIN',
    email: 'proviseur@test.cm',
    firstName: 'Marie',
    lastName: 'Biya',
    isActive: true,
    refreshTokenVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    staffPermissions: [],
  });

  beforeEach(() => {
    depenseRepo = new InMemoryDepenseRepository();
    userRepo = new InMemoryUserRepository();
    userRepo.ajouter(intendant);
    userRepo.ajouter(proviseur);
    useCase = new EnregistrerDepenseUseCase(depenseRepo, userRepo);
  });

  it('devrait enregistrer une dépense avec séparation correcte', async () => {
    const resultat = await useCase.execute({
      schoolId: 'school-1',
      label: 'Achat fournitures de bureau',
      amount: 50000,
      createdById: 'intendant-1',
      ordonnateurId: 'proviseur-1',
    });

    expect(resultat.depenseId).toBeDefined();
  });

  it('Loi 2 : devrait bloquer si ordonnateur === exécutant', async () => {
    await expect(useCase.execute({
      schoolId: 'school-1',
      label: 'Dépense illégale',
      amount: 50000,
      createdById: 'proviseur-1',
      ordonnateurId: 'proviseur-1',
    })).rejects.toThrow(SeparationOrdonnateurError);
  });

  it('devrait accepter une dépense sans ordonnateurId', async () => {
    const resultat = await useCase.execute({
      schoolId: 'school-1',
      label: 'Petite caisse',
      amount: 5000,
      createdById: 'intendant-1',
    });
    expect(resultat.depenseId).toBeDefined();
  });

  it("devrait rejeter si l'exécutant n'a pas MANAGE_FINANCE", async () => {
    const sansPermission = User.reconstituer({
      ...intendant.toObject(),
      id: 'user-sans-perm',
      staffPermissions: [],
    });
    userRepo.ajouter(sansPermission);

    await expect(useCase.execute({
      schoolId: 'school-1',
      label: 'Tentative non autorisée',
      amount: 10000,
      createdById: 'user-sans-perm',
    })).rejects.toThrow('Permission MANAGE_FINANCE');
  });
});
