import type { PrismaClient } from '@prisma/client';
import type { CopilotDataGateway } from '@domain/ports/repositories/CopilotDataGateway';
import { PrismaCopilotSharedGateway } from './PrismaCopilotSharedGateway';
import { PrismaCopilotAdminAcademicGateway } from './PrismaCopilotAdminAcademicGateway';
import { PrismaCopilotAdminOpsGateway } from './PrismaCopilotAdminOpsGateway';
import { PrismaCopilotPortalGateway } from './PrismaCopilotPortalGateway';

/**
 * INFRASTRUCTURE — Adaptateur composite fournissant au catalogue d'actions
 * Copilot l'ensemble de ses passerelles de données segmentées par domaine.
 */
export class PrismaCopilotDataGateway implements CopilotDataGateway {
  readonly shared: PrismaCopilotSharedGateway;
  readonly adminAcademic: PrismaCopilotAdminAcademicGateway;
  readonly adminOps: PrismaCopilotAdminOpsGateway;
  readonly portal: PrismaCopilotPortalGateway;

  constructor(prisma: PrismaClient) {
    this.shared = new PrismaCopilotSharedGateway(prisma);
    this.adminAcademic = new PrismaCopilotAdminAcademicGateway(prisma);
    this.adminOps = new PrismaCopilotAdminOpsGateway(prisma);
    this.portal = new PrismaCopilotPortalGateway(prisma);
  }
}

