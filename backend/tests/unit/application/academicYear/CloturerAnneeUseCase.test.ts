import { describe, it, expect, beforeEach } from 'bun:test';
import { CloturerAnneeUseCase } from '../../../../src/application/academicYear/CloturerAnneeUseCase.ts';
import { InMemoryAnneeAcademiqueRepository } from '../../../helpers/repositories/InMemoryAnneeAcademiqueRepository.ts';
import { InMemoryPromotionRepository } from '../../../helpers/repositories/InMemoryPromotionRepository.ts';
import type { ActivityLogPort } from '@domain/ports/services/ActivityLogPort';

const stubActivityLog: ActivityLogPort = { log: async () => {} };

describe('CloturerAnneeUseCase', () => {
  let anneeRepo: InMemoryAnneeAcademiqueRepository;
  let promotionRepo: InMemoryPromotionRepository;
  let useCase: CloturerAnneeUseCase;

  beforeEach(() => {
    anneeRepo = new InMemoryAnneeAcademiqueRepository();
    promotionRepo = new InMemoryPromotionRepository();
    useCase = new CloturerAnneeUseCase(anneeRepo, promotionRepo, stubActivityLog);

    anneeRepo.ajouterAnnee({
      id: 'annee-1',
      schoolId: 'school-1',
      name: '2025-2026',
      startDate: new Date('2025-09-01'),
      endDate: new Date('2026-07-31'),
      isCurrent: true,
      status: 'ACTIVE',
    });

    anneeRepo.notesNonValidees = 0;
    anneeRepo.classesSansBulletins = [];
    anneeRepo.classesSansConseil = [];
  });

  it('devrait archiver l\'année', async () => {
    await useCase.execute({
      academicYearId: 'annee-1',
      schoolId: 'school-1',
      demandeurId: 'admin-1',
    });

    const annee = await anneeRepo.findById('annee-1');
    expect(annee?.status).toBe('ARCHIVED');
    expect(annee?.isCurrent).toBe(false);
  });

  it('devrait promouvoir les élèves PASS vers la classe suivante', async () => {
    promotionRepo.definirMappings('school-1', 'annee-1', [
      { fromClassId: 'classe-3e', toClassId: 'classe-2nde' },
    ]);
    promotionRepo.definirDecisions('school-1', 'annee-1', [
      { studentId: 'eleve-1', fromClassId: 'classe-3e', decision: 'PASS' },
      { studentId: 'eleve-2', fromClassId: 'classe-3e', decision: 'PASS' },
    ]);

    const resultat = await useCase.execute({
      academicYearId: 'annee-1',
      schoolId: 'school-1',
      demandeurId: 'admin-1',
    });

    expect(resultat.elevesPromus).toBe(2);
    expect(promotionRepo.classesEleves.get('eleve-1')).toBe('classe-2nde');
    expect(promotionRepo.classesEleves.get('eleve-2')).toBe('classe-2nde');
  });

  it('devrait maintenir les redoublants dans la même classe', async () => {
    promotionRepo.definirDecisions('school-1', 'annee-1', [
      { studentId: 'eleve-3', fromClassId: 'classe-3e', decision: 'REPEAT' },
    ]);

    const resultat = await useCase.execute({
      academicYearId: 'annee-1',
      schoolId: 'school-1',
      demandeurId: 'admin-1',
    });

    expect(resultat.elevesRedoublants).toBe(1);
    const promotion = promotionRepo.promotionsEnregistrees.find(
      p => p.studentId === 'eleve-3'
    );
    expect(promotion?.fromClassId).toBe(promotion?.toClassId);
  });

  it('devrait bloquer si notes non validées (sans force)', async () => {
    anneeRepo.notesNonValidees = 3;

    await expect(useCase.execute({
      academicYearId: 'annee-1',
      schoolId: 'school-1',
      demandeurId: 'admin-1',
      force: false,
    })).rejects.toThrow('Clôture impossible');
  });

  it('devrait passer outre les notes non validées avec force=true', async () => {
    anneeRepo.notesNonValidees = 3;

    const resultat = await useCase.execute({
      academicYearId: 'annee-1',
      schoolId: 'school-1',
      demandeurId: 'admin-1',
      force: true,
    });

    expect(resultat.anneeId).toBe('annee-1');
  });

  it('force=true ne passe pas outre les bulletins manquants', async () => {
    anneeRepo.classesSansBulletins = [
      { classeId: 'c1', classeNom: '2nde C', periodeNom: 'T3' }
    ];

    await expect(useCase.execute({
      academicYearId: 'annee-1',
      schoolId: 'school-1',
      demandeurId: 'admin-1',
      force: true,
    })).rejects.toThrow('Clôture impossible');
  });

  it('devrait générer un avertissement si pas de mapping pour une classe', async () => {
    promotionRepo.definirMappings('school-1', 'annee-1', []);
    promotionRepo.definirDecisions('school-1', 'annee-1', [
      { studentId: 'eleve-1', fromClassId: 'classe-sans-mapping', decision: 'PASS' },
    ]);

    const resultat = await useCase.execute({
      academicYearId: 'annee-1',
      schoolId: 'school-1',
      demandeurId: 'admin-1',
    });

    expect(resultat.avertissements).toHaveLength(1);
    expect(resultat.avertissements[0]).toContain('Pas de mapping');
    expect(resultat.elevesPromus).toBe(0);
    // Bug indépendant corrigé au passage : ce champ était toujours à 0, codé en dur.
    expect(resultat.elevesNonTraites).toBe(1);
  });

  it('devrait rejeter si l\'année est déjà archivée', async () => {
    anneeRepo.ajouterAnnee({
      id: 'annee-archivee',
      schoolId: 'school-1',
      name: '2024-2025',
      startDate: new Date('2024-09-01'),
      endDate: new Date('2025-07-31'),
      isCurrent: false,
      status: 'ARCHIVED',
    });

    await expect(useCase.execute({
      academicYearId: 'annee-archivee',
      schoolId: 'school-1',
      demandeurId: 'admin-1',
    })).rejects.toThrow('déjà archivée');
  });
});
