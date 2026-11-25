import { describe, it, expect, beforeEach } from 'bun:test';
import { CreerClasseUseCase } from '../../../../src/application/class/CreerClasseUseCase.ts';
import { InMemoryClasseRepository } from '../../../helpers/repositories/InMemoryClasseRepository.ts';
import { Classe } from '@domain/entities/Classe';

describe('CreerClasseUseCase', () => {
  let repo: InMemoryClasseRepository;
  let useCase: CreerClasseUseCase;

  beforeEach(() => {
    repo = new InMemoryClasseRepository();
    useCase = new CreerClasseUseCase(repo);
  });

  it('devrait créer une classe valide', async () => {
    const resultat = await useCase.execute({
      schoolId: 'school-1',
      academicYearId: 'annee-1',
      name: '2nde',
      level: '2nde',
      serie: 'C',
      capacity: 45,
    });

    expect(resultat.classeId).toBeDefined();
    expect(resultat.nomComplet).toContain('2nde');
    expect(resultat.nomComplet).toContain('C');
  });

  it('devrait rejeter un doublon de nom dans la même école', async () => {
    const existante = Classe.reconstituer({
      id: 'classe-1',
      schoolId: 'school-1',
      academicYearId: 'annee-1',
      name: '3e A',
      capacity: 40,
      status: 'ACTIVE',
      createdAt: new Date(),
    });
    repo.ajouter(existante);

    await expect(useCase.execute({
      schoolId: 'school-1',
      academicYearId: 'annee-1',
      name: '3e A',
    })).rejects.toThrow('existe déjà');
  });

  it('devrait autoriser le même nom dans deux écoles différentes', async () => {
    const existante = Classe.reconstituer({
      id: 'classe-1',
      schoolId: 'school-1',
      academicYearId: 'annee-1',
      name: '6e A',
      capacity: 40,
      status: 'ACTIVE',
      createdAt: new Date(),
    });
    repo.ajouter(existante);

    const resultat = await useCase.execute({
      schoolId: 'school-2',
      academicYearId: 'annee-1',
      name: '6e A',
    });
    expect(resultat.classeId).toBeDefined();
  });

  it('devrait utiliser 40 comme capacité par défaut', async () => {
    await useCase.execute({ schoolId: 'school-1', academicYearId: 'annee-1', name: 'Tle D' });
    const classes = await repo.findBySchool('school-1');
    expect(classes[0].capacity).toBe(40);
  });
});
