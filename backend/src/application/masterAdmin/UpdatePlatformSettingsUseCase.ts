import type { PlatformSettingsRepository } from '@domain/ports/repositories/PlatformSettingsRepository';
import type { PlatformSettingsCache } from '@domain/ports/cache/PlatformSettingsCache';
import type { PlatformSettingsAuditPort } from '@domain/ports/services/PlatformSettingsAuditPort';
import type { PlatformSettingsView } from './GetPlatformSettingsUseCase';

export interface UpdatePlatformSettingsCommand {
  outboundMessagingEnabled: boolean;
  schoolId?: string | null;
  masterUserId: string;
  ipAddress?: string | null;
}

export class UpdatePlatformSettingsUseCase {
  constructor(
    private readonly repository: PlatformSettingsRepository,
    private readonly cache: PlatformSettingsCache,
    private readonly audit: PlatformSettingsAuditPort,
  ) {}

  async execute(command: UpdatePlatformSettingsCommand): Promise<PlatformSettingsView> {
    if (typeof command.outboundMessagingEnabled !== 'boolean') {
      throw new Error('outboundMessagingEnabled doit être un booléen');
    }

    const current = await this.repository.get();
    const currentDisabled = current.disabledSchoolIds ?? [];
    const targetSchoolId = typeof command.schoolId === 'string' && command.schoolId.trim().length > 0
      ? command.schoolId.trim()
      : null;

    if (targetSchoolId) {
      const avant = !currentDisabled.includes(targetSchoolId);
      const apres = command.outboundMessagingEnabled;

      if (avant !== apres) {
        const nextDisabled = apres
          ? currentDisabled.filter((id) => id !== targetSchoolId)
          : Array.from(new Set([...currentDisabled, targetSchoolId]));

        const updated = this.repository.updateDisabledSchools
          ? await this.repository.updateDisabledSchools(nextDisabled)
          : { ...current, disabledSchoolIds: nextDisabled };

        const normalized = { ...updated, disabledSchoolIds: updated.disabledSchoolIds ?? nextDisabled };
        await this.cache.invalidate();
        await this.cache.set(normalized);
        await this.audit.enregistrerChangement({
          masterUserId: command.masterUserId,
          ipAddress: command.ipAddress,
          avant,
          apres,
          schoolId: targetSchoolId,
        });
        return {
          outboundMessagingEnabled: normalized.outboundMessagingEnabled,
          disabledSchoolIds: normalized.disabledSchoolIds,
        };
      }

      const normalized = { ...current, disabledSchoolIds: currentDisabled };
      await this.cache.set(normalized);
      return {
        outboundMessagingEnabled: normalized.outboundMessagingEnabled,
        disabledSchoolIds: normalized.disabledSchoolIds,
      };
    }

    if (current.outboundMessagingEnabled !== command.outboundMessagingEnabled) {
      const updated = await this.repository.updateOutboundMessaging(command.outboundMessagingEnabled);
      const normalized = { ...updated, disabledSchoolIds: updated.disabledSchoolIds ?? currentDisabled };
      await this.cache.invalidate();
      await this.cache.set(normalized);
      await this.audit.enregistrerChangement({
        masterUserId: command.masterUserId,
        ipAddress: command.ipAddress,
        avant: current.outboundMessagingEnabled,
        apres: normalized.outboundMessagingEnabled,
      });
      return {
        outboundMessagingEnabled: normalized.outboundMessagingEnabled,
        disabledSchoolIds: normalized.disabledSchoolIds,
      };
    }

    const normalized = { ...current, disabledSchoolIds: currentDisabled };
    await this.cache.set(normalized);
    return {
      outboundMessagingEnabled: normalized.outboundMessagingEnabled,
      disabledSchoolIds: normalized.disabledSchoolIds,
    };
  }
}
