import type { PlatformSettingsRepository } from '@domain/ports/repositories/PlatformSettingsRepository';
import type { PlatformSettingsCache } from '@domain/ports/cache/PlatformSettingsCache';

export class GetPlatformSettingsUseCase {
  constructor(
    private readonly repository: PlatformSettingsRepository,
    private readonly cache: PlatformSettingsCache,
  ) {}

  async execute(): Promise<{ outboundMessagingEnabled: boolean }> {
    const cached = await this.cache.get();
    if (cached) return { outboundMessagingEnabled: cached.outboundMessagingEnabled };

    const settings = await this.repository.get();
    await this.cache.set(settings);
    return { outboundMessagingEnabled: settings.outboundMessagingEnabled };
  }
}
