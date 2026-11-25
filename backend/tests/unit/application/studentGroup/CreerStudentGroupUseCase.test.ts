import { describe, it, expect, beforeEach } from 'bun:test';
import { CreerStudentGroupUseCase } from '../../../../src/application/studentGroup/CreerStudentGroupUseCase.ts';
import { InMemoryStudentGroupRepository } from '../../../helpers/repositories/InMemoryStudentGroupRepository.ts';
import { InMemoryStudentGroupSetRepository } from '../../../helpers/repositories/InMemoryStudentGroupSetRepository.ts';

describe('CreerStudentGroupUseCase', () => {
  let groupRepo: InMemoryStudentGroupRepository;
  let groupSetRepo: InMemoryStudentGroupSetRepository;
  let useCase: CreerStudentGroupUseCase;

  beforeEach(() => {
    groupRepo = new InMemoryStudentGroupRepository();
    groupSetRepo = new InMemoryStudentGroupSetRepository();
    useCase = new CreerStudentGroupUseCase(groupRepo, groupSetRepo);

    groupSetRepo.ajouter({ id: 'groupset-lv2', schoolId: 'school-1', code: 'LV2', name: 'LV2' });
  });

  it('devrait créer un Group valide lié à une matière', async () => {
    const resultat = await useCase.execute({
      groupSetId: 'groupset-lv2', schoolId: 'school-1', name: 'Allemand', subjectId: 'subj-de', demandeurRole: 'ADMIN',
    });
    expect(resultat.groupId).toBeDefined();
    expect(resultat.name).toBe('Allemand');
  });

  it('devrait rejeter un doublon de nom dans le même GroupSet', async () => {
    await useCase.execute({ groupSetId: 'groupset-lv2', schoolId: 'school-1', name: 'Allemand', demandeurRole: 'ADMIN' });

    await expect(
      useCase.execute({ groupSetId: 'groupset-lv2', schoolId: 'school-1', name: 'Allemand', demandeurRole: 'ADMIN' })
    ).rejects.toThrow('existe déjà');
  });

  it('devrait rejeter un accès inter-établissement', async () => {
    await expect(
      useCase.execute({ groupSetId: 'groupset-lv2', schoolId: 'autre-ecole', name: 'Allemand', demandeurRole: 'ADMIN' })
    ).rejects.toThrow('Accès refusé');
  });

  it('devrait rejeter un GroupSet introuvable', async () => {
    await expect(
      useCase.execute({ groupSetId: 'inexistant', schoolId: 'school-1', name: 'Allemand', demandeurRole: 'ADMIN' })
    ).rejects.toThrow('introuvable');
  });
});
