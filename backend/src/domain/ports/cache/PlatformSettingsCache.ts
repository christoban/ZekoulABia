import type { PlatformSettings } from '@domain/ports/repositories/PlatformSettingsRepository';

export interface PlatformSettingsCache {
  get(): Promise<PlatformSettings | null>;
  set(settings: PlatformSettings): Promise<void>;
  invalidate(): Promise<void>;
}
