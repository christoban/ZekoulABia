import type { CrossSchoolTransferGatewayPort } from '@domain/ports/services/CrossSchoolTransferGatewayPort';
import { validateNationalId } from '@application/matricule/normalizeNationalId';

export interface DetecterIdentiteTransfertCommand {
  nationalId: string;
  targetSchoolId: string;
}

export interface DetecterIdentiteTransfertResult {
  exists: boolean;
}

export class DetecterIdentiteTransfertUseCase {
  constructor(private readonly gateway: CrossSchoolTransferGatewayPort) {}

  async execute(
    command: DetecterIdentiteTransfertCommand,
  ): Promise<DetecterIdentiteTransfertResult> {
    const nationalId = validateNationalId(command.nationalId);
    return this.gateway.identityExists(nationalId, command.targetSchoolId);
  }
}
