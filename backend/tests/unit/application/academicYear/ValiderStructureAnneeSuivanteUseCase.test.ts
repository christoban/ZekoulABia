import { describe, it, expect, beforeEach } from 'bun:test';
import { ValiderStructureAnneeSuivanteUseCase } from '../../../../src/application/academicYear/ValiderStructureAnneeSuivanteUseCase.ts';
import { InMemoryAnneeAcademiqueRepository } from '../../../helpers/repositories/InMemoryAnneeAcademiqueRepository.ts';
import { InMemoryClasseRepository } from '../../../helpers/repositories/InMemoryClasseRepository.ts';
import { Classe } from '@domain/entities/Classe';

describe('ValiderStructureAnneeSuivanteUseCase', () => {
  let anneeRepo: InMemoryAnneeAcademiqueRepository;
  let classeRepo: InMemoryClasseRepository;
  let useCase: ValiderStructureAnneeSuivanteUseCase;

  beforeEach(() => {
    anneeRepo = new InMemoryAnneeAcademiqueRepository();
    classeRepo = new InMemoryClasseRepository();
    useCase = new ValiderStructureAnneeSuivanteUseCase(anneeRepo, classeRepo);

    anneeRepo.ajouterAnnee({
      id: 'annee-suivante', schoolId: 'school-1', name: '2026-2027',
      startDate: new Date('2026-09-01'), endDate: new Date('2027-07-31'), isCurrent: false, status: 'ACTIVE',
    });
  });

  it('bascule toutes les classes DRAFT de l\'année en ACTIVE', async () => {
    classeRepo.ajouter(Classe.reconstituer({
      id: 'classe-1', schoolId: 'school-1', academicYearId: 'annee-suivante',
      name: '4e A', capacity: 40, status: 'DRAFT', createdAt: new Date(),
    }));
    classeRepo.ajouter(Classe.reconstituer({
      id: 'classe-2', schoolId: 'school-1', academicYearId: 'annee-suivante',
      name: '4e B', capacity: 40, status: 'DRAFT', createdAt: new Date(),
    }));

    const resultat = await useCase.execute({ schoolId: 'school-1', anneeSuivanteId: 'annee-suivante' });

    expect(resultat.classesActivees).toBe(2);
    const classes = await classeRepo.findBySchoolAndYear('school-1', 'annee-suivante');
    expect(classes.every(c => c.status === 'ACTIVE')).toBe(true);
  });

  it('ne touche pas les classes déjà ACTIVE (ex. ajoutées manuellement par l\'admin)', async () => {
    classeRepo.ajouter(Classe.reconstituer({
      id: 'classe-draft', schoolId: 'school-1', academicYearId: 'annee-suivante',
      name: 'Draft', capacity: 40, status: 'DRAFT', createdAt: new Date(),
    }));
    classeRepo.ajouter(Classe.reconstituer({
      id: 'classe-active', schoolId: 'school-1', academicYearId: 'annee-suivante',
      name: 'Déjà active', capacity: 40, status: 'ACTIVE', createdAt: new Date(),
    }));

    const resultat = await useCase.execute({ schoolId: 'school-1', anneeSuivanteId: 'annee-suivante' });

    expect(resultat.classesActivees).toBe(1);
  });

  it('refuse si aucune classe DRAFT n\'existe pour cette année', async () => {
    await expect(useCase.execute({ schoolId: 'school-1', anneeSuivanteId: 'annee-suivante' }))
      .rejects.toThrow('aucune classe proposée');
  });

  it('refuse un 2e appel sur une structure déjà validée (idempotence, pas de no-op silencieux)', async () => {
    classeRepo.ajouter(Classe.reconstituer({
      id: 'classe-1', schoolId: 'school-1', academicYearId: 'annee-suivante',
      name: '4e A', capacity: 40, status: 'DRAFT', createdAt: new Date(),
    }));

    await useCase.execute({ schoolId: 'school-1', anneeSuivanteId: 'annee-suivante' });

    await expect(useCase.execute({ schoolId: 'school-1', anneeSuivanteId: 'annee-suivante' }))
      .rejects.toThrow('déjà été validée');
  });

  it('refuse un accès inter-établissement', async () => {
    await expect(useCase.execute({ schoolId: 'autre-ecole', anneeSuivanteId: 'annee-suivante' }))
      .rejects.toThrow('Accès refusé');
  });
});
