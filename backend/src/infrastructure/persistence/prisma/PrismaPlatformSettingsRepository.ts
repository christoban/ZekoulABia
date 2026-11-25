import type { PrismaClient } from '@prisma/client';
import type {
  PlatformSettings,
  PlatformSettingsRepository,
} from '@domain/ports/repositories/PlatformSettingsRepository';

const SINGLETON_ID = 'singleton';

export class PrismaPlatformSettingsRepository implements PlatformSettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async get(): Promise<PlatformSettings> {
    const settings = await this.prisma.platformSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID },
      update: {},
    });
    return {
      ...settings,
      disabledSchoolIds: settings.disabledSchoolIds ?? [],
    };
  }

  async updateOutboundMessaging(enabled: boolean): Promise<PlatformSettings> {
    const settings = await this.prisma.platformSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, outboundMessagingEnabled: enabled },
      update: { outboundMessagingEnabled: enabled },
    });
    return {
      ...settings,
      disabledSchoolIds: settings.disabledSchoolIds ?? [],
    };
  }

  async updateDisabledSchools(disabledSchoolIds: string[]): Promise<PlatformSettings> {
    const uniques = Array.from(new Set(disabledSchoolIds.filter((id) => typeof id === 'string' && id.trim().length > 0)));
    const settings = await this.prisma.platformSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, disabledSchoolIds: uniques },
      update: { disabledSchoolIds: uniques },
    });
    return {
      ...settings,
      disabledSchoolIds: settings.disabledSchoolIds ?? [],
    };
  }
}
