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
    return settings;
  }

  async updateOutboundMessaging(enabled: boolean): Promise<PlatformSettings> {
    return this.prisma.platformSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, outboundMessagingEnabled: enabled },
      update: { outboundMessagingEnabled: enabled },
    });
  }
}
