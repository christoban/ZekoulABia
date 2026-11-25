import { describe, it, expect, beforeEach } from 'bun:test';
import { CalculerIndiceSanteUseCase } from '../../../../src/application/ai/CalculerIndiceSanteUseCase.ts';
import { InMemorySanteEleveRepository } from '../../../helpers/repositories/InMemorySanteEleveRepository.ts';
import { FakeIAService } from '../../../helpers/services/FakeIAService.ts';

describe('CalculerIndiceSanteUseCase', () => {
  let santeRepo: InMemorySanteEleveRepository;
  let iaService: FakeIAService;
  let useCase: CalculerIndiceSanteUseCase;

  const donneesParfaites = {
    studentId: 'eleve-1',
    moyenneGenerale: 18,
    joursPresent: 30,
    joursTotaux: 30,
    moyennesPrecedentes: [14, 16, 18],
    nombreSanctions: 0,
    nombrePeriodes: 3,
    fraisRegles: 100000,
    fraisTotaux: 100000,
  };

  const donneesEleveEnDifficulte = {
    studentId: 'eleve-2',
    moyenneGenerale: 5,
    joursPresent: 10,
    joursTotaux: 30,
    moyennesPrecedentes: [10, 8, 5],
    nombreSanctions: 5,
    nombrePeriodes: 3,
    fraisRegles: 0,
    fraisTotaux: 100000,
  };

  beforeEach(() => {
    santeRepo = new InMemorySanteEleveRepository();
    iaService = new FakeIAService();
    useCase = new CalculerIndiceSanteUseCase(santeRepo, iaService);
  });

  it('devrait retourner PROGRESSION pour un élève excellent', async () => {
    santeRepo.definir('eleve-1', 'school-1', 'annee-1', donneesParfaites);

    const resultat = await useCase.execute({
      studentId: 'eleve-1',
      schoolId: 'school-1',
      academicYearId: 'annee-1',
    });

    expect(resultat.score).toBeGreaterThan(85);
    expect(resultat.niveau).toBe('PROGRESSION');
    expect(resultat.recommandations).toHaveLength(2);
  });

  it('devrait retourner CRITIQUE pour un élève en grande difficulté', async () => {
    santeRepo.definir('eleve-2', 'school-1', 'annee-1', donneesEleveEnDifficulte);

    const resultat = await useCase.execute({
      studentId: 'eleve-2',
      schoolId: 'school-1',
      academicYearId: 'annee-1',
    });

    expect(resultat.score).toBeLessThanOrEqual(30);
    expect(resultat.niveau).toBe('CRITIQUE');
  });

  it('devrait sauvegarder le score si sauvegarderScore=true', async () => {
    santeRepo.definir('eleve-1', 'school-1', 'annee-1', donneesParfaites);

    const resultat = await useCase.execute({
      studentId: 'eleve-1',
      schoolId: 'school-1',
      academicYearId: 'annee-1',
      sauvegarderScore: true,
    });

    expect(santeRepo.scoresEnregistres.get('eleve-1')).toBe(resultat.score);
  });

  it('ne devrait pas sauvegarder si sauvegarderScore=false', async () => {
    santeRepo.definir('eleve-1', 'school-1', 'annee-1', donneesParfaites);

    await useCase.execute({
      studentId: 'eleve-1',
      schoolId: 'school-1',
      academicYearId: 'annee-1',
      sauvegarderScore: false,
    });

    expect(santeRepo.scoresEnregistres.has('eleve-1')).toBe(false);
  });

  it('le score doit être borné entre 0 et 100', async () => {
    santeRepo.definir('eleve-1', 'school-1', 'annee-1', donneesParfaites);

    const resultat = await useCase.execute({
      studentId: 'eleve-1',
      schoolId: 'school-1',
      academicYearId: 'annee-1',
    });

    expect(resultat.score).toBeGreaterThanOrEqual(0);
    expect(resultat.score).toBeLessThanOrEqual(100);
  });

  it('devrait rejeter si données introuvables', async () => {
    await expect(
      useCase.execute({
        studentId: 'eleve-inconnu',
        schoolId: 'school-1',
        academicYearId: 'annee-1',
      })
    ).rejects.toThrow('introuvables');
  });

  it('devrait appeler IAService.calculerIndiceSante avec les bonnes données', async () => {
    santeRepo.definir('eleve-1', 'school-1', 'annee-1', donneesParfaites);

    await useCase.execute({
      studentId: 'eleve-1',
      schoolId: 'school-1',
      academicYearId: 'annee-1',
    });

    expect(iaService.appelCalculer).toHaveLength(1);
    expect(iaService.appelCalculer[0]!.moyenneGenerale).toBe(18);
    expect(iaService.appelCalculer[0]!.tauxPresence).toBe(100);
  });

  describe('calculerScoreSeulement (job nocturne, sans appel IA)', () => {
    it('calcule et sauvegarde le score sans appeler IAService', async () => {
      santeRepo.definir('eleve-1', 'school-1', 'annee-1', donneesParfaites);

      const resultat = await useCase.calculerScoreSeulement('eleve-1', 'school-1', 'annee-1');

      expect(resultat.score).toBeGreaterThan(85);
      expect(resultat.niveau).toBe('PROGRESSION');
      expect(iaService.appelCalculer).toHaveLength(0);
      expect(santeRepo.scoresEnregistres.get('eleve-1')).toBe(resultat.score);
    });

    it('signale tendancePositive pour une hausse nette et non compensée', async () => {
      santeRepo.definir('eleve-3', 'school-1', 'annee-1', { ...donneesParfaites, studentId: 'eleve-3', moyennesPrecedentes: [10, 13, 16] });

      const resultat = await useCase.calculerScoreSeulement('eleve-3', 'school-1', 'annee-1');

      expect(resultat.tendancePositive).toBe(true);
    });

    it('ne signale pas tendancePositive pour un élève en difficulté', async () => {
      santeRepo.definir('eleve-2', 'school-1', 'annee-1', donneesEleveEnDifficulte);

      const resultat = await useCase.calculerScoreSeulement('eleve-2', 'school-1', 'annee-1');

      expect(resultat.niveau).toBe('CRITIQUE');
      expect(resultat.tendancePositive).toBe(false);
    });
  });
});
