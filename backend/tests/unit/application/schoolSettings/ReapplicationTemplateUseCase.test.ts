import { describe, it, expect, beforeEach } from 'bun:test';
import { ProposerReapplicationTemplateUseCase } from '../../../../src/application/schoolSettings/ProposerReapplicationTemplateUseCase.ts';
import { AppliquerReapplicationTemplateUseCase } from '../../../../src/application/schoolSettings/AppliquerReapplicationTemplateUseCase.ts';
import { InMemorySchoolSettingsRepository } from '../../../helpers/repositories/InMemorySchoolSettingsRepository.ts';
import { InMemorySchoolTemplateVersionRepository } from '../../../helpers/repositories/InMemorySchoolTemplateVersionRepository.ts';
import type { ActivityLogPort } from '@domain/ports/services/ActivityLogPort';

const stubActivityLog: ActivityLogPort = { log: async () => {} };

const TEMPLATE_CODE = 'DPPC-MINESEC';

function versionActive(config: Record<string, unknown>) {
  return {
    id: 'v1', templateCode: TEMPLATE_CODE, version: 1,
    config, publishedAt: new Date(), active: true, createdAt: new Date(),
  };
}

describe('Ré-application du template (V0.4 Phase 2)', () => {
  let settingsRepo: InMemorySchoolSettingsRepository;
  let templateRepo: InMemorySchoolTemplateVersionRepository;

  beforeEach(() => {
    settingsRepo = new InMemorySchoolSettingsRepository();
    settingsRepo.definir('school-1', {});
    templateRepo = new InMemorySchoolTemplateVersionRepository([
      versionActive({ passMark: 12, smsEnabled: true, maxAbsences: 5 }),
    ]);
  });

  describe('ProposerReapplicationTemplateUseCase', () => {
    it('propose un diff sans rien écrire', async () => {
      const useCase = new ProposerReapplicationTemplateUseCase(settingsRepo, templateRepo);
      const result = await useCase.execute({ schoolId: 'school-1', templateCode: TEMPLATE_CODE });

      expect(result.champsReappliques).toContain('passMark');
      expect(result.champsReappliques).toContain('smsEnabled');
      expect(result.champsReappliques).toContain('maxAbsences');
      expect(settingsRepo.dernieresSauvegardes).toHaveLength(0);
    });

    it('préserve les champs personnalisés (overrides)', async () => {
      await settingsRepo.marquerChampsPersonnalises('school-1', ['passMark']);
      const useCase = new ProposerReapplicationTemplateUseCase(settingsRepo, templateRepo);
      const result = await useCase.execute({ schoolId: 'school-1', templateCode: TEMPLATE_CODE });

      expect(result.champsPreserves).toContain('passMark');
      expect(result.champsReappliques).not.toContain('passMark');
      expect(settingsRepo.dernieresSauvegardes).toHaveLength(0);
    });

    it('lève une erreur si aucune version active', async () => {
      const useCase = new ProposerReapplicationTemplateUseCase(settingsRepo, new InMemorySchoolTemplateVersionRepository([]));
      await expect(useCase.execute({ schoolId: 'school-1', templateCode: TEMPLATE_CODE })).rejects.toThrow('Aucune version active');
    });
  });

  describe('AppliquerReapplicationTemplateUseCase', () => {
    it('applique la fusion atomiquement', async () => {
      const useCase = new AppliquerReapplicationTemplateUseCase(settingsRepo, templateRepo, stubActivityLog);
      const result = await useCase.execute({ schoolId: 'school-1', templateCode: TEMPLATE_CODE, demandeurId: 'admin-1' });

      expect(result.status).toBe('APPLIED');
      expect(settingsRepo.dernieresSauvegardes).toHaveLength(1);
      const sauvegarde = settingsRepo.dernieresSauvegardes[0];
      expect(sauvegarde.passMark).toBe(12);
      expect(sauvegarde.smsEnabled).toBe(true);
      expect(sauvegarde.maxAbsences).toBe(5);
    });

    it('retourne NO_CHANGE si rien ne change', async () => {
      await settingsRepo.marquerChampsPersonnalises('school-1', ['passMark', 'smsEnabled', 'maxAbsences']);
      const useCase = new AppliquerReapplicationTemplateUseCase(settingsRepo, templateRepo, stubActivityLog);
      const result = await useCase.execute({ schoolId: 'school-1', templateCode: TEMPLATE_CODE });

      expect(result.status).toBe('NO_CHANGE');
      expect(settingsRepo.dernieresSauvegardes).toHaveLength(0);
    });

    it('ne réplique jamais un champ personnalisé', async () => {
      await settingsRepo.marquerChampsPersonnalises('school-1', ['passMark']);
      const useCase = new AppliquerReapplicationTemplateUseCase(settingsRepo, templateRepo, stubActivityLog);
      const result = await useCase.execute({ schoolId: 'school-1', templateCode: TEMPLATE_CODE, demandeurId: 'admin-1' });

      const sauvegarde = settingsRepo.dernieresSauvegardes[0];
      // passMark est personnalisé (override) → exclu des champs réappliqués, jamais écrit
      expect(sauvegarde.passMark).toBeUndefined();
      expect(result.status).toBe('APPLIED');
    });

    it('audit trail avec avant/apres', async () => {
      let logged: any = null;
      const auditLog: ActivityLogPort = { log: async (entry) => { logged = entry; } };
      const useCase = new AppliquerReapplicationTemplateUseCase(settingsRepo, templateRepo, auditLog);
      await useCase.execute({ schoolId: 'school-1', templateCode: TEMPLATE_CODE, demandeurId: 'admin-1' });

      expect(logged).not.toBeNull();
      expect(logged.action).toBe('Ré-application du template');
      expect(logged.userId).toBe('admin-1');
      expect(JSON.parse(logged.details).templateCode).toBe(TEMPLATE_CODE);
    });
  });
});
