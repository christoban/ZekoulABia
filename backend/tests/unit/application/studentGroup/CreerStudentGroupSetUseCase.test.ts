import { describe, it, expect, beforeEach } from 'bun:test';
import { CreerStudentGroupSetUseCase } from '../../../../src/application/studentGroup/CreerStudentGroupSetUseCase.ts';
import { InMemoryStudentGroupSetRepository } from '../../../helpers/repositories/InMemoryStudentGroupSetRepository.ts';

describe('CreerStudentGroupSetUseCase', () => {
  let repo: InMemoryStudentGroupSetRepository;
  let useCase: CreerStudentGroupSetUseCase;

  beforeEach(() => {
    repo = new InMemoryStudentGroupSetRepository();
    useCase = new CreerStudentGroupSetUseCase(repo);
  });

  it('devrait créer un GroupSet valide', async () => {
    const resultat = await useCase.execute({ schoolId: 'school-1', code: 'LV2', name: 'LV2', demandeurRole: 'ADMIN' });
    expect(resultat.groupSetId).toBeDefined();
    expect(resultat.code).toBe('LV2');
  });

  it('devrait rejeter un doublon de code dans la même école', async () => {
    await useCase.execute({ schoolId: 'school-1', code: 'LV2', name: 'LV2', demandeurRole: 'ADMIN' });

    await expect(
      useCase.execute({ schoolId: 'school-1', code: 'LV2', name: 'Autre nom', demandeurRole: 'ADMIN' })
    ).rejects.toThrow('existe déjà');
  });

  it('devrait autoriser le même code dans une autre école', async () => {
    await useCase.execute({ schoolId: 'school-1', code: 'LV2', name: 'LV2', demandeurRole: 'ADMIN' });

    const resultat = await useCase.execute({ schoolId: 'school-2', code: 'LV2', name: 'LV2', demandeurRole: 'ADMIN' });
    expect(resultat.groupSetId).toBeDefined();
  });

  it('devrait rejeter un demandeur non-Admin', async () => {
    await expect(
      useCase.execute({ schoolId: 'school-1', code: 'LV2', name: 'LV2', demandeurRole: 'STAFF' })
    ).rejects.toThrow('Seul un Admin');
  });
});
