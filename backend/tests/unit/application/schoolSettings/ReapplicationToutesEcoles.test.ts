import { describe, it, expect, beforeEach } from 'bun:test';
import { ProposerReapplicationToutesEcolesUseCase } from '../../../../src/application/schoolSettings/ProposerReapplicationToutesEcolesUseCase.ts';
import { AppliquerReapplicationToutesEcolesUseCase } from '../../../../src/application/schoolSettings/AppliquerReapplicationToutesEcolesUseCase.ts';
import { AppliquerReapplicationTemplateUseCase } from '../../../../src/application/schoolSettings/AppliquerReapplicationTemplateUseCase.ts';
import { InMemorySchoolSettingsRepository } from '../../../helpers/repositories/InMemorySchoolSettingsRepository.ts';
import { InMemorySchoolTemplateVersionRepository } from '../../../helpers/repositories/InMemorySchoolTemplateVersionRepository.ts';
import type { TemplateReapplicationQueryPort, EcoleParTemplate } from '@domain/ports/repositories/TemplateReapplicationQueryPort';
import type { ActivityLogPort } from '@domain/ports/services/ActivityLogPort';

const TEMPLATE_CODE = 'LYCEE_FR';
const stubActivityLog: ActivityLogPort = { log: async () => {} };

class InMemoryEcolesParTemplate implements TemplateReapplicationQueryPort {
  constructor(private ecoles: EcoleParTemplate[]) {}
  async listerEcolesParTemplate(_templateCode: string): Promise<EcoleParTemplate[]> {
    return this.ecoles;
  }
}

function versionActive(config: Record<string, unknown>) {
  return {
    id: 'v1', templateCode: TEMPLATE_CODE, version: 1,
    config, publishedAt: new Date(), active: true, createdAt: new Date(),
  };
}

describe('Ré-application en masse (V0.4 Phase 3)', () => {
  let settingsRepo: InMemorySchoolSettingsRepository;
  let templateRepo: InMemorySchoolTemplateVersionRepository;

  beforeEach(() => {
    settingsRepo = new InMemorySchoolSettingsRepository();
    settingsRepo.definir('school-1', { passMark: 10 });
    settingsRepo.definir('school-2', { passMark: 10 });
    settingsRepo.definir('school-3', { passMark: 10 });
    templateRepo = new InMemorySchoolTemplateVersionRepository([
      versionActive({ passMark: 12, maxAbsences: 8 }),
    ]);
  });

  describe('ProposerReapplicationToutesEcolesUseCase', () => {
    it('ne persiste rien et compte les écoles impactées', async () => {
      const queryPort = new InMemoryEcolesParTemplate([
        { id: 'school-1', name: 'Lycée A' },
        { id: 'school-2', name: 'Lycée B' },
      ]);
      const useCase = new ProposerReapplicationToutesEcolesUseCase(queryPort, settingsRepo, templateRepo);

      const resultat = await useCase.execute({ templateCode: TEMPLATE_CODE });

      expect(resultat.ecolesTotal).toBe(2);
      expect(resultat.ecolesImpacts).toBe(2);
      expect(resultat.version).toBe(1);
      expect(settingsRepo.dernieresSauvegardes).toHaveLength(0);
    });

    it('compte une école à part si tous les champs changés sont overridés', async () => {
      settingsRepo.marquerChampsPersonnalises('school-2', ['passMark', 'maxAbsences']);
      const queryPort = new InMemoryEcolesParTemplate([
        { id: 'school-1', name: 'Lycée A' },
        { id: 'school-2', name: 'Lycée B (overrides)' },
      ]);
      const useCase = new ProposerReapplicationToutesEcolesUseCase(queryPort, settingsRepo, templateRepo);

      const resultat = await useCase.execute({ templateCode: TEMPLATE_CODE });

      expect(resultat.ecolesImpacts).toBe(1);
      expect(resultat.ecolesSansChangement).toBe(1);
      const detailB = resultat.details.find((d) => d.schoolId === 'school-2');
      expect(detailB?.champsPreserves).toContain('passMark');
    });

    it('rejette si aucune version active', async () => {
      const queryPort = new InMemoryEcolesParTemplate([]);
      const useCase = new ProposerReapplicationToutesEcolesUseCase(
        queryPort, settingsRepo, new InMemorySchoolTemplateVersionRepository(),
      );

      await expect(useCase.execute({ templateCode: TEMPLATE_CODE })).rejects.toThrow('Aucune version active');
    });
  });

  describe('AppliquerReapplicationToutesEcolesUseCase', () => {
    it('ré-applique chaque école et préserve les overrides', async () => {
      settingsRepo.marquerChampsPersonnalises('school-3', ['passMark']);
      const queryPort = new InMemoryEcolesParTemplate([
        { id: 'school-1', name: 'A' }, { id: 'school-2', name: 'B' }, { id: 'school-3', name: 'C' },
      ]);
      const appliquerEcole = new AppliquerReapplicationTemplateUseCase(settingsRepo, templateRepo, stubActivityLog);
      const useCase = new AppliquerReapplicationToutesEcolesUseCase(queryPort, templateRepo, appliquerEcole);

      const resultat = await useCase.execute({ templateCode: TEMPLATE_CODE, demandeurId: 'master-1' });

      expect(resultat.ecolesAppliquees).toBe(3);
      const ecole3 = await settingsRepo.getParametresEffectifs('school-3');
      expect(ecole3?.passMark).toBe(10); // override préservé
      expect(ecole3?.maxAbsences).toBe(8); // ré-appliqué
    });

    it('est idempotent : une seconde exécution retourne NO_CHANGE partout', async () => {
      const queryPort = new InMemoryEcolesParTemplate([{ id: 'school-1', name: 'A' }]);
      const appliquerEcole = new AppliquerReapplicationTemplateUseCase(settingsRepo, templateRepo, stubActivityLog);
      const useCase = new AppliquerReapplicationToutesEcolesUseCase(queryPort, templateRepo, appliquerEcole);

      await useCase.execute({ templateCode: TEMPLATE_CODE, demandeurId: 'master-1' });
      const seconde = await useCase.execute({ templateCode: TEMPLATE_CODE, demandeurId: 'master-1' });

      expect(seconde.ecolesSansChangement).toBe(1);
      expect(seconde.ecolesAppliquees).toBe(0);
    });

    it('une école en échec n’empêche pas les autres', async () => {
      // school-2 introuvable dans le dépôt de settings → getParametresEffectifs lève
      settingsRepo = new InMemorySchoolSettingsRepository();
      settingsRepo.definir('school-1', { passMark: 10 });
      settingsRepo.definir('school-3', { passMark: 10 });
      const queryPort = new InMemoryEcolesParTemplate([
        { id: 'school-1', name: 'A' }, { id: 'school-2', name: 'B (manquante)' }, { id: 'school-3', name: 'C' },
      ]);
      const appliquerEcole = new AppliquerReapplicationTemplateUseCase(settingsRepo, templateRepo, stubActivityLog);
      const useCase = new AppliquerReapplicationToutesEcolesUseCase(queryPort, templateRepo, appliquerEcole);

      const resultat = await useCase.execute({ templateCode: TEMPLATE_CODE, demandeurId: 'master-1' });

      expect(resultat.ecolesAppliquees).toBe(2);
      expect(resultat.ecolesEnEchec).toBe(1);
      const echec = resultat.resultats.find((r) => r.schoolId === 'school-2');
      expect(echec?.status).toBe('ERROR');
      expect(echec?.erreur).toContain('introuvable');
    });
  });
});
