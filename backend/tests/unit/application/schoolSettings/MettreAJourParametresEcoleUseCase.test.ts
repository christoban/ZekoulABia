import { describe, it, expect, beforeEach } from 'bun:test';
import { MettreAJourParametresEcoleUseCase } from '../../../../src/application/schoolSettings/MettreAJourParametresEcoleUseCase.ts';
import { ObtenirParametresEcoleUseCase } from '../../../../src/application/schoolSettings/ObtenirParametresEcoleUseCase.ts';
import { InMemorySchoolSettingsRepository } from '../../../helpers/repositories/InMemorySchoolSettingsRepository.ts';
import { MINESEC_DEFAULTS } from '@domain/constants/SystemeEducatifCameroun';
import type { ActivityLogPort } from '@domain/ports/services/ActivityLogPort';

const stubActivityLog: ActivityLogPort = { log: async () => {} };

describe('SchoolSettings — Use Cases', () => {
  let repo: InMemorySchoolSettingsRepository;

  beforeEach(() => {
    repo = new InMemorySchoolSettingsRepository();
    repo.definir('school-1', {});
  });

  describe('Valeurs par défaut MINESEC', () => {
    it('gradesPerTerm doit être 2 (pas 3)', async () => {
      const useCase = new ObtenirParametresEcoleUseCase(repo);
      const settings = await useCase.execute('school-1');
      expect(settings.gradesPerTerm).toBe(MINESEC_DEFAULTS.SEQUENCES_PAR_TRIMESTRE);
      expect(settings.gradesPerTerm).toBe(2);
    });

    it('councilPassMark doit être 10 (/20), pas 50 (%)', async () => {
      const useCase = new ObtenirParametresEcoleUseCase(repo);
      const settings = await useCase.execute('school-1');
      expect(settings.councilPassMark).toBe(10);
      expect(settings.councilPassMark).toBeLessThanOrEqual(20);
    });

    it('attendanceLateAsAbsence doit être false par défaut', async () => {
      const useCase = new ObtenirParametresEcoleUseCase(repo);
      const settings = await useCase.execute('school-1');
      expect(settings.attendanceLateAsAbsence).toBe(false);
    });

    it('seuils légaux MINESEC corrects', async () => {
      const useCase = new ObtenirParametresEcoleUseCase(repo);
      const settings = await useCase.execute('school-1');
      expect(settings.legalMaxContributionFirstCycle).toBe(7500);
      expect(settings.legalMaxContributionSecondCycle).toBe(10000);
    });
  });

  describe('MettreAJourParametresEcoleUseCase', () => {
    it('devrait persister les paramètres en DB (fix du bug)', async () => {
      const useCase = new MettreAJourParametresEcoleUseCase(repo, stubActivityLog);
      await useCase.execute({
        schoolId: 'school-1',
        demandeurRole: 'ADMIN',
        schoolLanguageMode: 'anglophone',
        attendanceLateAsAbsence: true,
        bulletinBlockOnUnpaidFees: true,
        councilPassMark: 12,
      });

      expect(repo.dernieresSauvegardes).toHaveLength(1);
      const sauvegarde = repo.dernieresSauvegardes[0];
      expect(sauvegarde.schoolLanguageMode).toBe('anglophone');
      expect(sauvegarde.attendanceLateAsAbsence).toBe(true);
      expect(sauvegarde.bulletinBlockOnUnpaidFees).toBe(true);
      expect(sauvegarde.councilPassMark).toBe(12);
    });

    it('devrait rejeter si demandeur non Admin', async () => {
      const useCase = new MettreAJourParametresEcoleUseCase(repo, stubActivityLog);
      await expect(useCase.execute({
        schoolId: 'school-1',
        demandeurRole: 'TEACHER',
        schoolName: 'Nouveau nom',
      })).rejects.toThrow('Admin');
    });

    it('devrait rejeter un schoolLanguageMode invalide', async () => {
      const useCase = new MettreAJourParametresEcoleUseCase(repo, stubActivityLog);
      await expect(useCase.execute({
        schoolId: 'school-1',
        demandeurRole: 'ADMIN',
        schoolLanguageMode: 'invalid' as any,
      })).rejects.toThrow('schoolLanguageMode invalide');
    });

    it('devrait rejeter un cycle invalide', async () => {
      const useCase = new MettreAJourParametresEcoleUseCase(repo, stubActivityLog);
      await expect(useCase.execute({
        schoolId: 'school-1',
        demandeurRole: 'ADMIN',
        cycles: ['maternelle', 'invalid_cycle'] as any,
      })).rejects.toThrow('Cycles invalides');
    });

    it('councilPassMark doit être entre 0 et 20', async () => {
      const useCase = new MettreAJourParametresEcoleUseCase(repo, stubActivityLog);
      await expect(useCase.execute({
        schoolId: 'school-1',
        demandeurRole: 'ADMIN',
        councilPassMark: 25,
      })).rejects.toThrow('entre 0 et 20');
    });

    it('V2.2 : marque les champs SchoolConfig modifiés comme overrides locaux', async () => {
      const useCase = new MettreAJourParametresEcoleUseCase(repo, stubActivityLog);
      await useCase.execute({
        schoolId: 'school-1',
        demandeurRole: 'ADMIN',
        passMark: 12,
        smsEnabled: true,
        schoolName: 'Nouveau nom',
      });

      const champs = await repo.getChampsPersonnalises('school-1');
      expect(champs).toContain('passMark');
      expect(champs).toContain('smsEnabled');
      expect(champs).not.toContain('schoolName');
    });

    it('V2.2 : ne marque rien si aucun champ SchoolConfig modifié', async () => {
      const useCase = new MettreAJourParametresEcoleUseCase(repo, stubActivityLog);
      await useCase.execute({
        schoolId: 'school-1',
        demandeurRole: 'ADMIN',
        schoolName: 'Seulement le nom',
      });

      expect(repo.champsMarquesAppels).toHaveLength(0);
      expect(await repo.getChampsPersonnalises('school-1')).toEqual([]);
    });
  });
});
