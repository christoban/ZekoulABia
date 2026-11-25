import { GetPlatformSettingsUseCase } from '@application/masterAdmin/GetPlatformSettingsUseCase';
import type {
  OutboundMessagingContext,
  OutboundMessagingPolicy,
} from '@domain/ports/services/OutboundMessagingPolicy';
import { platformSettingsCachePartagee } from '../../cache/PlatformSettingsCache';
import { PrismaPlatformSettingsRepository } from '../../persistence/prisma/PrismaPlatformSettingsRepository';
import { prisma } from '../../../config/prisma';

export class PlatformSettingsOutboundMessagingPolicy implements OutboundMessagingPolicy {
  private readonly obtenir = new GetPlatformSettingsUseCase(
    new PrismaPlatformSettingsRepository(prisma),
    platformSettingsCachePartagee,
  );

  async estActive(contexte?: OutboundMessagingContext): Promise<boolean> {
    const settings = await this.obtenir.execute();
    if (!settings.outboundMessagingEnabled) {
      return false;
    }

    const disabledSchoolIds = settings.disabledSchoolIds ?? [];
    if (disabledSchoolIds.length === 0) {
      return true;
    }

    if (contexte?.schoolId && contexte.schoolId.trim().length > 0) {
      return !disabledSchoolIds.includes(contexte.schoolId.trim());
    }

    const email = contexte?.recipientEmail?.trim().toLowerCase();
    const phone = contexte?.recipientPhone?.trim();
    if (email || phone) {
      try {
        const match = await prisma.user.findFirst({
          where: {
            schoolId: { in: disabledSchoolIds },
            OR: [
              ...(email ? [{ email }] : []),
              ...(phone ? [{ phone }] : []),
            ],
          },
          select: { id: true },
        });
        if (match) {
          return false;
        }
      } catch {
        // Ne pas bloquer le flux d'envoi en cas d'erreur de lookup secondaire
      }
    }

    return true;
  }
}

// Seam d'injection minimal : les fonctions d'interception (module-level) appellent
// estEnvoiSortantActif(), les tests remplacent la politique via definirOutboundMessagingPolicy().
const politiqueEnvoiSortantPlateforme: OutboundMessagingPolicy = new PlatformSettingsOutboundMessagingPolicy();
let politiqueActive: OutboundMessagingPolicy = politiqueEnvoiSortantPlateforme;

export function definirOutboundMessagingPolicy(politique: OutboundMessagingPolicy): void {
  politiqueActive = politique;
}

export async function estEnvoiSortantActif(contexte?: OutboundMessagingContext): Promise<boolean> {
  return politiqueActive.estActive(contexte);
}

// Instance par défaut pour le wiring du container (cache partagé → PATCH vu immédiatement).
export { politiqueEnvoiSortantPlateforme };
