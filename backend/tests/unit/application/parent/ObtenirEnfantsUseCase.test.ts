import { describe, it, expect, beforeEach } from 'bun:test';
import { ObtenirEnfantsUseCase } from '../../../../src/application/parent/ObtenirEnfantsUseCase.ts';
import { VerifierAccesEnfantUseCase } from '../../../../src/application/parent/VerifierAccesEnfantUseCase.ts';
import { InMemoryParentRepository } from '../../../helpers/repositories/InMemoryParentRepository.ts';

describe('Parent — Use Cases', () => {
  let repo: InMemoryParentRepository;

  beforeEach(() => {
    repo = new InMemoryParentRepository();

    repo.definirRelation('parent-1', ['eleve-1', 'eleve-2'], 'school-1');

    repo.definirStats('eleve-1', {
      studentId: 'eleve-1',
      prenom: 'Jean',
      nom: 'Mballa',
      classeNom: '3e A',
      classeId: 'classe-1',
      tauxPresence: 95,
      tauxPonctualite: 90,
      joursAbsent: 1,
      derniereeMention: 'Bien',
      dernieereMoyenne: 14.5,
      indiceSante: 82,
    });

    repo.definirStats('eleve-2', {
      studentId: 'eleve-2',
      prenom: 'Marie',
      nom: 'Mballa',
      classeNom: '6e B',
      classeId: 'classe-2',
      tauxPresence: 100,
      tauxPonctualite: 98,
      joursAbsent: 0,
      derniereeMention: 'Très Bien',
      dernieereMoyenne: 16.2,
      indiceSante: 91,
    });
  });

  describe('ObtenirEnfantsUseCase', () => {
    it('devrait retourner tous les enfants avec leurs stats', async () => {
      const useCase = new ObtenirEnfantsUseCase(repo);
      const enfants = await useCase.execute({
        parentUserId: 'parent-1',
        schoolId: 'school-1',
      });

      expect(enfants).toHaveLength(2);
      expect(enfants[0].tauxPresence).toBeDefined();
      expect(enfants[0].tauxPonctualite).toBeDefined();
      expect(enfants[0].indiceSante).toBeDefined();
    });

    it('devrait retourner les taux de présence ET ponctualité séparément', async () => {
      const useCase = new ObtenirEnfantsUseCase(repo);
      const enfants = await useCase.execute({
        parentUserId: 'parent-1',
        schoolId: 'school-1',
      });

      const jean = enfants.find(e => e.prenom === 'Jean')!;
      // Retard ≠ absence au Cameroun — deux taux séparés
      expect(jean.tauxPresence).toBe(95);
      expect(jean.tauxPonctualite).toBe(90);
      expect(jean.joursAbsent).toBe(1);
    });

    it('devrait retourner [] si parent sans enfants', async () => {
      const useCase = new ObtenirEnfantsUseCase(repo);
      const enfants = await useCase.execute({
        parentUserId: 'parent-sans-enfant',
        schoolId: 'school-1',
      });
      expect(enfants).toHaveLength(0);
    });
  });

  describe('VerifierAccesEnfantUseCase', () => {
    it("devrait passer si l'enfant appartient au parent", async () => {
      const useCase = new VerifierAccesEnfantUseCase(repo);
      await expect(useCase.execute('parent-1', 'eleve-1')).resolves.toBeUndefined();
    });

    it("devrait rejeter si l'élève n'appartient pas au parent", async () => {
      const useCase = new VerifierAccesEnfantUseCase(repo);
      await expect(
        useCase.execute('parent-1', 'eleve-autre')
      ).rejects.toThrow('non autorisé');
    });

    it('devrait rejeter pour un parent inexistant', async () => {
      const useCase = new VerifierAccesEnfantUseCase(repo);
      await expect(
        useCase.execute('parent-inexistant', 'eleve-1')
      ).rejects.toThrow();
    });
  });
});
