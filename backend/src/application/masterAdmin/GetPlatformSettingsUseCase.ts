import type { PlatformSettingsRepository } from '@domain/ports/repositories/PlatformSettingsRepository';
import type { PlatformSettingsCache } from '@domain/ports/cache/PlatformSettingsCache';

export interface PlatformSettingsView {
  outboundMessagingEnabled: boolean;
  disabledSchoolIds: string[];
}

export class GetPlatformSettingsUseCase {
  constructor(
    private readonly repository: PlatformSettingsRepository,
    private readonly cache: PlatformSettingsCache,
  ) {}

  async execute(): Promise<PlatformSettingsView> {
    const cached = await this.cache.get();
    if (cached) {
      return {
        outboundMessagingEnabled: cached.outboundMessagingEnabled,
        disabledSchoolIds: cached.disabledSchoolIds ?? [],
      };
    }

    const settings = await this.repository.get();
    const normalized = {
      ...settings,
      disabledSchoolIds: settings.disabledSchoolIds ?? [],
    };
    await this.cache.set(normalized);
    return {
      outboundMessagingEnabled: normalized.outboundMessagingEnabled,
      disabledSchoolIds: normalized.disabledSchoolIds,
    };
  }
}
