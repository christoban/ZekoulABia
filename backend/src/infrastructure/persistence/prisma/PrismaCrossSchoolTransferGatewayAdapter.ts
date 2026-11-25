import type { PrismaClient } from '@prisma/client';
import type {
  CrossSchoolTransferGatewayPort,
  TransferIdentityLookupResult,
} from '@domain/ports/services/CrossSchoolTransferGatewayPort';

export class PrismaCrossSchoolTransferGatewayAdapter implements CrossSchoolTransferGatewayPort {
  constructor(private readonly prisma: PrismaClient) {}

  async identityExists(nationalId: string, targetSchoolId: string): Promise<TransferIdentityLookupResult> {
    const identity = await this.prisma.studentIdentity.findFirst({
      where: {
        nationalId,
        profiles: { some: { schoolId: { not: targetSchoolId } } },
      },
      select: { id: true },
    });
    return { exists: identity !== null };
  }
}
