import { describe, expect, it } from 'bun:test';
import { GetPlatformSettingsUseCase } from '../../../../src/application/masterAdmin/GetPlatformSettingsUseCase.ts';
import { UpdatePlatformSettingsUseCase } from '../../../../src/application/masterAdmin/UpdatePlatformSettingsUseCase.ts';
import type { PlatformSettingsCache } from '@domain/ports/cache/PlatformSettingsCache';
import type { PlatformSettings, PlatformSettingsRepository } from '@domain/ports/repositories/PlatformSettingsRepository';
import type { PlatformSettingsAuditPort } from '@domain/ports/services/PlatformSettingsAuditPort';

class FakeCache implements PlatformSettingsCache {
  private value: PlatformSettings | null = null;

  async get(): Promise<PlatformSettings | null> {
    return this.value;
  }

  async set(settings: PlatformSettings): Promise<void> {
    this.value = settings;
  }

  async invalidate(): Promise<void> {
    this.value = null;
  }
}

class FakeRepository implements PlatformSettingsRepository {
  settings: PlatformSettings = {
    id: 'singleton',
    outboundMessagingEnabled: true,
    disabledSchoolIds: [],
    updatedAt: new Date(),
  };

  async get(): Promise<PlatformSettings> {
    return this.settings;
  }

  async updateOutboundMessaging(enabled: boolean): Promise<PlatformSettings> {
    this.settings = { ...this.settings, outboundMessagingEnabled: enabled, updatedAt: new Date() };
    return this.settings;
  }

  async updateDisabledSchools(disabledSchoolIds: string[]): Promise<PlatformSettings> {
    this.settings = { ...this.settings, disabledSchoolIds, updatedAt: new Date() };
    return this.settings;
  }
}

class FakeAudit implements PlatformSettingsAuditPort {
  calls: Array<{ masterUserId: string; avant: boolean; apres: boolean; schoolId?: string | null }> = [];

  async enregistrerChangement(params: {
    masterUserId: string;
    ipAddress?: string | null;
    avant: boolean;
    apres: boolean;
    schoolId?: string | null;
  }): Promise<void> {
    this.calls.push({
      masterUserId: params.masterUserId,
      avant: params.avant,
      apres: params.apres,
      ...(params.schoolId ? { schoolId: params.schoolId } : {}),
    });
  }
}

describe('Platform settings use cases', () => {
  it('retourne active par défaut et réutilise le cache', async () => {
    const repository = new FakeRepository();
    const cache = new FakeCache();
    const useCase = new GetPlatformSettingsUseCase(repository, cache);

    expect(await useCase.execute()).toEqual({ outboundMessagingEnabled: true, disabledSchoolIds: [] });

    repository.settings = { ...repository.settings, outboundMessagingEnabled: false };
    expect(await useCase.execute()).toEqual({ outboundMessagingEnabled: true, disabledSchoolIds: [] });
  });

  it('met à jour le réglage global puis attend la journalisation du changement', async () => {
    const repository = new FakeRepository();
    const cache = new FakeCache();
    const audit = new FakeAudit();
    const useCase = new UpdatePlatformSettingsUseCase(repository, cache, audit);

    const result = await useCase.execute({
      outboundMessagingEnabled: false,
      masterUserId: 'master-1',
      ipAddress: '127.0.0.1',
    });

    expect(result).toEqual({ outboundMessagingEnabled: false, disabledSchoolIds: [] });
    expect(audit.calls).toEqual([{ masterUserId: 'master-1', avant: true, apres: false }]);
    expect(await cache.get()).toMatchObject({ outboundMessagingEnabled: false, disabledSchoolIds: [] });
  });

  it('active et désactive le mode test ciblé par établissement avec journalisation', async () => {
    const repository = new FakeRepository();
    const cache = new FakeCache();
    const audit = new FakeAudit();
    const useCase = new UpdatePlatformSettingsUseCase(repository, cache, audit);

    const disabledResult = await useCase.execute({
      outboundMessagingEnabled: false,
      schoolId: 'school-demo-1',
      masterUserId: 'super-admin-1',
    });

    expect(disabledResult).toEqual({
      outboundMessagingEnabled: true,
      disabledSchoolIds: ['school-demo-1'],
    });
    expect(audit.calls).toEqual([
      { masterUserId: 'super-admin-1', avant: true, apres: false, schoolId: 'school-demo-1' },
    ]);

    const reenabledResult = await useCase.execute({
      outboundMessagingEnabled: true,
      schoolId: 'school-demo-1',
      masterUserId: 'super-admin-1',
    });

    expect(reenabledResult).toEqual({
      outboundMessagingEnabled: true,
      disabledSchoolIds: [],
    });
    expect(audit.calls).toHaveLength(2);
    expect(audit.calls[1]).toEqual({
      masterUserId: 'super-admin-1',
      avant: false,
      apres: true,
      schoolId: 'school-demo-1',
    });
  });

  it('ne journalise pas une mise à jour sans changement', async () => {
    const repository = new FakeRepository();
    const cache = new FakeCache();
    const audit = new FakeAudit();
    const useCase = new UpdatePlatformSettingsUseCase(repository, cache, audit);

    await useCase.execute({ outboundMessagingEnabled: true, masterUserId: 'master-1' });

    expect(audit.calls).toHaveLength(0);
  });
});
