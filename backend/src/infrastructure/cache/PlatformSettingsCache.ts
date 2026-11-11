import type { PlatformSettingsCache as PlatformSettingsCachePort } from '@domain/ports/cache/PlatformSettingsCache';
import type { PlatformSettings } from '@domain/ports/repositories/PlatformSettingsRepository';

const TTL_MS = 5_000;

export class PlatformSettingsCache implements PlatformSettingsCachePort {
  private entry: { settings: PlatformSettings; expiresAt: number } | null = null;

  async get(): Promise<PlatformSettings | null> {
    if (!this.entry || this.entry.expiresAt <= Date.now()) {
      this.entry = null;
      return null;
    }
    return this.entry.settings;
  }

  async set(settings: PlatformSettings): Promise<void> {
    this.entry = { settings, expiresAt: Date.now() + TTL_MS };
  }

  async invalidate(): Promise<void> {
    this.entry = null;
  }
}

// Instance partagée par le contrôleur et la politique d'envoi : une invalidation
// après PATCH est vue immédiatement par l'interception, sans attendre le TTL.
export const platformSettingsCachePartagee = new PlatformSettingsCache();
