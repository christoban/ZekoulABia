/**
 * DOMAIN LAYER — Passerelle de données agrégée pour les actions du copilot.
 *
 * Expose uniquement des sous-passerelles métier typées sans accès direct à un client technique.
 */
import type { CopilotSharedGateway } from './copilot/CopilotSharedGateway';
import type { CopilotAdminAcademicGateway } from './copilot/CopilotAdminAcademicGateway';
import type { CopilotAdminOpsGateway } from './copilot/CopilotAdminOpsGateway';
import type { CopilotPortalGateway } from './copilot/CopilotPortalGateway';

export interface CopilotDataGateway {
  readonly shared: CopilotSharedGateway;
  readonly adminAcademic: CopilotAdminAcademicGateway;
  readonly adminOps: CopilotAdminOpsGateway;
  readonly portal: CopilotPortalGateway;
}
