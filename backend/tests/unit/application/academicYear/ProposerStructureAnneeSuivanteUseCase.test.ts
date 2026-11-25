import { describe, it, expect, beforeEach } from 'bun:test';
import { ProposerStructureAnneeSuivanteUseCase } from '../../../../src/application/academicYear/ProposerStructureAnneeSuivanteUseCase.ts';
import { InMemoryAnneeAcademiqueRepository } from '../../../helpers/repositories/InMemoryAnneeAcademiqueRepository.ts';
import { InMemoryClasseRepository } from '../../../helpers/repositories/InMemoryClasseRepository.ts';
import { InMemoryPromotionRepository } from '../../../helpers/repositories/InMemoryPromotionRepository.ts';
import { Classe } from '@domain/entities/Classe';

describe('ProposerStructureAnneeSuivanteUseCase', () => {
  let anneeRepo: InMemoryAnneeAcademiqueRepository;
  let classeRepo: InMemoryClasseRepository;
  let promotionRepo: InMemoryPromotionRepository;
  let useCase: ProposerStructureAnneeSuivanteUseCase;

  beforeEach(() => {
    anneeRepo = new InMemoryAnneeAcademiqueRepository();
    classeRepo = new InMemoryClasseRepository();
    promotionRepo = new InMemoryPromotionRepository();
    useCase = new ProposerStructureAnneeSuivanteUseCase(anneeRepo, classeRepo, promotionRepo);

    anneeRepo.ajouterAnnee({
      id: 'annee-actuelle', schoolId: 'school-1', name: '2025-2026',
      startDate: new Date('2025-09-01'), endDate: new Date('2026-07-31'), isCurrent: true, status: 'ACTIVE',
    });
    anneeRepo.ajouterAnnee({
      id: 'annee-suivante', schoolId: 'school-1', name: '2026-2027',
      startDate: new Date('2026-09-01'), endDate: new Date('2027-07-31'), isCurrent: false, status: 'ACTIVE',
    });

    classeRepo.ajouter(Classe.reconstituer({
      id: 'classe-3e-a', schoolId: 'school-1', academicYearId: 'annee-actuelle',
      name: '3e A', level: '3e', capacity: 40, status: 'ACTIVE', createdAt: new Date(),
    }));
    classeRepo.ajouter(Classe.reconstituer({
      id: 'classe-2nde-c', schoolId: 'school-1', academicYearId: 'annee-actuelle',
      name: '2nde C', level: '2nde', serie: 'C', capacity: 45, status: 'ACTIVE', createdAt: new Date(),
    }));
  });

  it('clone chaque classe active 1:1 en DRAFT sur la nouvelle année', async () => {
    const resultat = await useCase.execute({
      schoolId: 'school-1', anneeActuelleId: 'annee-actuelle', anneeSuivanteId: 'annee-suivante',
    });

    expect(resultat.classesProposees).toHaveLength(2);
    const classesSuivantes = await classeRepo.findBySchoolAndYear('school-1', 'annee-suivante');
    expect(classesSuivantes).toHaveLength(2);
    expect(classesSuivantes.every(c => c.status === 'DRAFT')).toBe(true);

    const clone3e = classesSuivantes.find(c => c.name === '3e A');
    expect(clone3e?.level).toBe('3e');
    expect(clone3e?.capacity).toBe(40);

    const clone2nde = classesSuivantes.find(c => c.name === '2nde C');
    expect(clone2nde?.serie).toBe('C');
    expect(clone2nde?.capacity).toBe(45);
  });

  it('enregistre le mapping ClassPromotion (ancienne → nouvelle DRAFT) dès la proposition', async () => {
    await useCase.execute({
      schoolId: 'school-1', anneeActuelleId: 'annee-actuelle', anneeSuivanteId: 'annee-suivante',
    });

    const mappings = await promotionRepo.findMappingsPromotion('school-1', 'annee-actuelle');
    expect(mappings).toHaveLength(2);
    const classesSuivantes = await classeRepo.findBySchoolAndYear('school-1', 'annee-suivante');
    const clone3e = classesSuivantes.find(c => c.name === '3e A');
    expect(mappings.find(m => m.fromClassId === 'classe-3e-a')?.toClassId).toBe(clone3e!.id);
  });

  it('ignore les classes déjà DRAFT/inactives de l\'année en cours', async () => {
    classeRepo.ajouter(Classe.reconstituer({
      id: 'classe-fantome', schoolId: 'school-1', academicYearId: 'annee-actuelle',
      name: 'Fantôme', capacity: 40, status: 'DRAFT', createdAt: new Date(),
    }));

    const resultat = await useCase.execute({
      schoolId: 'school-1', anneeActuelleId: 'annee-actuelle', anneeSuivanteId: 'annee-suivante',
    });

    expect(resultat.classesProposees).toHaveLength(2);
    expect(resultat.classesProposees.some(c => c.classeActuelleNom === 'Fantôme')).toBe(false);
  });

  it('refuse si une structure a déjà été proposée pour cette année (idempotence)', async () => {
    await useCase.execute({ schoolId: 'school-1', anneeActuelleId: 'annee-actuelle', anneeSuivanteId: 'annee-suivante' });

    await expect(useCase.execute({
      schoolId: 'school-1', anneeActuelleId: 'annee-actuelle', anneeSuivanteId: 'annee-suivante',
    })).rejects.toThrow('déjà proposée');
  });

  it('refuse si l\'année en cours est déjà archivée', async () => {
    anneeRepo.ajouterAnnee({
      id: 'annee-archivee', schoolId: 'school-1', name: '2024-2025',
      startDate: new Date('2024-09-01'), endDate: new Date('2025-07-31'), isCurrent: false, status: 'ARCHIVED',
    });

    await expect(useCase.execute({
      schoolId: 'school-1', anneeActuelleId: 'annee-archivee', anneeSuivanteId: 'annee-suivante',
    })).rejects.toThrow('déjà archivée');
  });

  it('refuse si aucune classe active sur l\'année en cours', async () => {
    classeRepo.vider();

    await expect(useCase.execute({
      schoolId: 'school-1', anneeActuelleId: 'annee-actuelle', anneeSuivanteId: 'annee-suivante',
    })).rejects.toThrow('aucune classe active');
  });

  it('refuse si les deux années sont identiques', async () => {
    await expect(useCase.execute({
      schoolId: 'school-1', anneeActuelleId: 'annee-actuelle', anneeSuivanteId: 'annee-actuelle',
    })).rejects.toThrow('différente');
  });
});
