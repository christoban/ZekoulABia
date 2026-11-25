import { describe, it, expect } from 'bun:test';
import { PublierVersionTemplateUseCase } from '../../../../src/application/schoolSettings/PublierVersionTemplateUseCase.ts';
import { InMemorySchoolTemplateVersionRepository } from '../../../helpers/repositories/InMemorySchoolTemplateVersionRepository.ts';
import type { ActivityLogPort } from '@domain/ports/services/ActivityLogPort';

const TEMPLATE_CODE = 'LYCEE_FR';

function versionActive(version: number, config: Record<string, unknown>) {
  return {
    id: `v${version}`, templateCode: TEMPLATE_CODE, version,
    config, publishedAt: new Date(), active: true, createdAt: new Date(),
  };
}

function logFactice() {
  const appels: { userId: string; schoolId: string; action: string }[] = [];
  const log: ActivityLogPort['log'] = async (p) => { appels.push(p); };
  return { appels, port: { log } as ActivityLogPort };
}

describe('PublierVersionTemplateUseCase (V0.4)', () => {
  it('publie la version N+1 active et désactive la précédente', async () => {
    const repo = new InMemorySchoolTemplateVersionRepository([
      versionActive(1, { passMark: 10 }),
    ]);
    const useCase = new PublierVersionTemplateUseCase(repo);

    const publiee = await useCase.execute({
      templateCode: TEMPLATE_CODE,
      config: { passMark: 12, maxAbsences: 8 },
      demandeurId: 'master-1',
    });

    expect(publiee.version).toBe(2);
    expect(publiee.active).toBe(true);
    expect(publiee.config['passMark']).toBe(12);

    const ancienne = await repo.trouverParCodeEtVersion(TEMPLATE_CODE, 1);
    expect(ancienne?.active).toBe(false);
  });

  it('rejette un champ hors liste blanche', async () => {
    const useCase = new PublierVersionTemplateUseCase(
      new InMemorySchoolTemplateVersionRepository(),
    );

    await expect(
      useCase.execute({ templateCode: TEMPLATE_CODE, config: { champInconnu: 1 }, demandeurId: 'm' })
    ).rejects.toThrow('hors liste blanche');
  });

  it('rejette une config vide', async () => {
    const useCase = new PublierVersionTemplateUseCase(
      new InMemorySchoolTemplateVersionRepository(),
    );

    await expect(
      useCase.execute({ templateCode: TEMPLATE_CODE, config: {}, demandeurId: 'm' })
    ).rejects.toThrow('vide');
  });

  it('trace la publication dans le journal d’activité', async () => {
    const repo = new InMemorySchoolTemplateVersionRepository();
    const { appels, port } = logFactice();
    const useCase = new PublierVersionTemplateUseCase(repo, port);

    await useCase.execute({ templateCode: TEMPLATE_CODE, config: { passMark: 12 }, demandeurId: 'master-9' });

    expect(appels).toHaveLength(1);
    expect(appels[0].userId).toBe('master-9');
    expect(appels[0].action).toContain('version template');
  });
});
