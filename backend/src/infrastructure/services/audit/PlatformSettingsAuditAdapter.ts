import type { PlatformSettingsAuditPort } from '@domain/ports/services/PlatformSettingsAuditPort';
import type { PrismaClient } from '@prisma/client';

export class PlatformSettingsAuditAdapter implements PlatformSettingsAuditPort {
  constructor(private readonly prisma: PrismaClient) {}

  async enregistrerChangement(params: {
    masterUserId: string;
    ipAddress?: string | null;
    avant: boolean;
    apres: boolean;
  }): Promise<void> {
    await this.prisma.masterAuthAudit.create({
      data: {
        masterUserId: params.masterUserId,
        action: 'action:platform_settings_outbound_messaging_changed',
        description: JSON.stringify({
          setting: 'outboundMessagingEnabled',
          avant: params.avant,
          apres: params.apres,
        }),
        ipAddress: params.ipAddress ?? null,
      },
    });
  }
}
