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
    updatedAt: new Date(),
  };

  async get(): Promise<PlatformSettings> {
    return this.settings;
  }

  async updateOutboundMessaging(enabled: boolean): Promise<PlatformSettings> {
    this.settings = { ...this.settings, outboundMessagingEnabled: enabled, updatedAt: new Date() };
    return this.settings;
  }
}

class FakeAudit implements PlatformSettingsAuditPort {
  calls: Array<{ masterUserId: string; avant: boolean; apres: boolean }> = [];

  async enregistrerChangement(params: {
    masterUserId: string;
    ipAddress?: string | null;
    avant: boolean;
    apres: boolean;
  }): Promise<void> {
    this.calls.push({ masterUserId: params.masterUserId, avant: params.avant, apres: params.apres });
  }
}

describe('Platform settings use cases', () => {
  it('retourne active par défaut et réutilise le cache', async () => {
    const repository = new FakeRepository();
    const cache = new FakeCache();
    const useCase = new GetPlatformSettingsUseCase(repository, cache);

    expect(await useCase.execute()).toEqual({ outboundMessagingEnabled: true });

    repository.settings = { ...repository.settings, outboundMessagingEnabled: false };
    expect(await useCase.execute()).toEqual({ outboundMessagingEnabled: true });
  });

  it('met à jour le réglage puis attend la journalisation du changement', async () => {
    const repository = new FakeRepository();
    const cache = new FakeCache();
    const audit = new FakeAudit();
    const useCase = new UpdatePlatformSettingsUseCase(repository, cache, audit);

    const result = await useCase.execute({
      outboundMessagingEnabled: false,
      masterUserId: 'master-1',
      ipAddress: '127.0.0.1',
    });

    expect(result).toEqual({ outboundMessagingEnabled: false });
    expect(audit.calls).toEqual([{ masterUserId: 'master-1', avant: true, apres: false }]);
    expect(await cache.get()).toMatchObject({ outboundMessagingEnabled: false });
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