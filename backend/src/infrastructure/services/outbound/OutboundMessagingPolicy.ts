import { GetPlatformSettingsUseCase } from '@application/masterAdmin/GetPlatformSettingsUseCase';
import type { OutboundMessagingPolicy } from '@domain/ports/services/OutboundMessagingPolicy';
import { platformSettingsCachePartagee } from '../../cache/PlatformSettingsCache';
import { PrismaPlatformSettingsRepository } from '../../persistence/prisma/PrismaPlatformSettingsRepository';
import { prisma } from '../../../config/prisma';

export class PlatformSettingsOutboundMessagingPolicy implements OutboundMessagingPolicy {
  private readonly obtenir = new GetPlatformSettingsUseCase(
    new PrismaPlatformSettingsRepository(prisma),
    platformSettingsCachePartagee,
  );

  async estActive(): Promise<boolean> {
    const settings = await this.obtenir.execute();
    return settings.outboundMessagingEnabled;
  }
}

// Seam d'injection minimal : les fonctions d'interception (module-level) appellent
// estEnvoiSortantActif(), les tests remplacent la politique via definirOutboundMessagingPolicy().
const politiqueEnvoiSortantPlateforme: OutboundMessagingPolicy = new PlatformSettingsOutboundMessagingPolicy();
let politiqueActive: OutboundMessagingPolicy = politiqueEnvoiSortantPlateforme;

export function definirOutboundMessagingPolicy(politique: OutboundMessagingPolicy): void {
  politiqueActive = politique;
}

export async function estEnvoiSortantActif(): Promise<boolean> {
  return politiqueActive.estActive();
}

// Instance par défaut pour le wiring du container (cache partagé → PATCH vu immédiatement).
export { politiqueEnvoiSortantPlateforme };

