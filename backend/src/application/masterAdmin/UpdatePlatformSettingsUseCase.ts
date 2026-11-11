import type { PlatformSettingsRepository } from '@domain/ports/repositories/PlatformSettingsRepository';
import type { PlatformSettingsCache } from '@domain/ports/cache/PlatformSettingsCache';
import type { PlatformSettingsAuditPort } from '@domain/ports/services/PlatformSettingsAuditPort';

export interface UpdatePlatformSettingsCommand {
  outboundMessagingEnabled: boolean;
  masterUserId: string;
  ipAddress?: string | null;
}

export class UpdatePlatformSettingsUseCase {
  constructor(
    private readonly repository: PlatformSettingsRepository,
    private readonly cache: PlatformSettingsCache,
    private readonly audit: PlatformSettingsAuditPort,
  ) {}

  async execute(command: UpdatePlatformSettingsCommand): Promise<{ outboundMessagingEnabled: boolean }> {
    if (typeof command.outboundMessagingEnabled !== 'boolean') {
      throw new Error('outboundMessagingEnabled doit être un booléen');
    }

    const current = await this.repository.get();
    if (current.outboundMessagingEnabled !== command.outboundMessagingEnabled) {
      const updated = await this.repository.updateOutboundMessaging(command.outboundMessagingEnabled);
      await this.cache.invalidate();
      await this.cache.set(updated);
      await this.audit.enregistrerChangement({
        masterUserId: command.masterUserId,
        ipAddress: command.ipAddress,
        avant: current.outboundMessagingEnabled,
        apres: updated.outboundMessagingEnabled,
      });
      return { outboundMessagingEnabled: updated.outboundMessagingEnabled };
    }

    await this.cache.set(current);
    return { outboundMessagingEnabled: current.outboundMessagingEnabled };
  }
}
