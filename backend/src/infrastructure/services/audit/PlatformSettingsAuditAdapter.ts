import type { PlatformSettingsAuditPort } from '@domain/ports/services/PlatformSettingsAuditPort';
import type { PrismaClient } from '@prisma/client';

export class PlatformSettingsAuditAdapter implements PlatformSettingsAuditPort {
  constructor(private readonly prisma: PrismaClient) {}

  async enregistrerChangement(params: {
    masterUserId: string;
    ipAddress?: string | null;
    avant: boolean;
    apres: boolean;
    schoolId?: string | null;
  }): Promise<void> {
    await this.prisma.masterAuthAudit.create({
      data: {
        masterUserId: params.masterUserId,
        action: params.schoolId
          ? 'action:platform_settings_school_outbound_messaging_changed'
          : 'action:platform_settings_outbound_messaging_changed',
        description: JSON.stringify({
          setting: 'outboundMessagingEnabled',
          scope: params.schoolId ? 'school' : 'global',
          ...(params.schoolId ? { schoolId: params.schoolId } : {}),
          avant: params.avant,
          apres: params.apres,
        }),
        ipAddress: params.ipAddress ?? null,
      },
    });
  }
}
