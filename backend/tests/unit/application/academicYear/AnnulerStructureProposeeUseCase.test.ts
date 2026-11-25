/**
 * Note sur la couverture : ClasseRepository.annulerPropositionAnnee() garantit la suppression
 * atomique des classes DRAFT ET de leurs mappings ClassPromotion en une seule transaction
 * Prisma (voir PrismaClasseRepository) — une vraie transaction DB n'est pas simulable avec des
 * doubles en mémoire (InMemoryClasseRepository/InMemoryPromotionRepository sont deux stores
 * indépendants). Ce fichier teste donc l'orchestration du use case (précondition, refus,
 * comptage) ; le nettoyage réel DRAFT+ClassPromotion en une transaction est vérifié par le test
 * e2e (academicYearStructureCancel.integration.test.ts, contre la vraie base de test).
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { AnnulerStructureProposeeUseCase } from '../../../../src/application/academicYear/AnnulerStructureProposeeUseCase.ts';
import { InMemoryAnneeAcademiqueRepository } from '../../../helpers/repositories/InMemoryAnneeAcademiqueRepository.ts';
import { InMemoryClasseRepository } from '../../../helpers/repositories/InMemoryClasseRepository.ts';
import { Classe } from '@domain/entities/Classe';

describe('AnnulerStructureProposeeUseCase', () => {
  let anneeRepo: InMemoryAnneeAcademiqueRepository;
  let classeRepo: InMemoryClasseRepository;
  let useCase: AnnulerStructureProposeeUseCase;

  beforeEach(() => {
    anneeRepo = new InMemoryAnneeAcademiqueRepository();
    classeRepo = new InMemoryClasseRepository();
    useCase = new AnnulerStructureProposeeUseCase(anneeRepo, classeRepo);

    anneeRepo.ajouterAnnee({
      id: 'annee-suivante', schoolId: 'school-1', name: '2026-2027',
      startDate: new Date('2026-09-01'), endDate: new Date('2027-07-31'), isCurrent: false, status: 'ACTIVE',
    });
  });

  it('supprime toutes les classes DRAFT de l\'année', async () => {
    classeRepo.ajouter(Classe.reconstituer({
      id: 'classe-1', schoolId: 'school-1', academicYearId: 'annee-suivante',
      name: '4e A', capacity: 40, status: 'DRAFT', createdAt: new Date(),
    }));
    classeRepo.ajouter(Classe.reconstituer({
      id: 'classe-2', schoolId: 'school-1', academicYearId: 'annee-suivante',
      name: '4e B', capacity: 40, status: 'DRAFT', createdAt: new Date(),
    }));

    const resultat = await useCase.execute({ schoolId: 'school-1', anneeSuivanteId: 'annee-suivante' });

    expect(resultat.classesSupprimees).toBe(2);
    const classesRestantes = await classeRepo.findBySchoolAndYear('school-1', 'annee-suivante');
    expect(classesRestantes).toHaveLength(0);
  });

  it('refuse si aucune classe DRAFT n\'existe pour cette année (rien à annuler)', async () => {
    await expect(useCase.execute({ schoolId: 'school-1', anneeSuivanteId: 'annee-suivante' }))
      .rejects.toThrow('rien à annuler');
  });

  it('refuse d\'annuler une structure déjà validée (une classe ACTIVE suffit, même avec des DRAFT restants)', async () => {
    classeRepo.ajouter(Classe.reconstituer({
      id: 'classe-active', schoolId: 'school-1', academicYearId: 'annee-suivante',
      name: 'Déjà active', capacity: 40, status: 'ACTIVE', createdAt: new Date(),
    }));
    // État mixte volontaire : une classe DRAFT traîne aussi, ne doit PAS déclencher une
    // annulation partielle automatique — le refus doit primer dès qu'une classe ACTIVE existe.
    classeRepo.ajouter(Classe.reconstituer({
      id: 'classe-draft', schoolId: 'school-1', academicYearId: 'annee-suivante',
      name: 'Draft résiduelle', capacity: 40, status: 'DRAFT', createdAt: new Date(),
    }));

    await expect(useCase.execute({ schoolId: 'school-1', anneeSuivanteId: 'annee-suivante' }))
      .rejects.toThrow('déjà été validée');

    const classesInchangees = await classeRepo.findBySchoolAndYear('school-1', 'annee-suivante');
    expect(classesInchangees).toHaveLength(2);
  });

  it('refuse un accès inter-établissement', async () => {
    await expect(useCase.execute({ schoolId: 'autre-ecole', anneeSuivanteId: 'annee-suivante' }))
      .rejects.toThrow('Accès refusé');
  });

  it('refuse une année inexistante', async () => {
    await expect(useCase.execute({ schoolId: 'school-1', anneeSuivanteId: 'inexistante' }))
      .rejects.toThrow('introuvable');
  });
});
