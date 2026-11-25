import type { PrismaClient } from '@prisma/client';
import type { TransferFeatureFlagPort } from '@domain/ports/services/TransferFeatureFlagPort';

export class PrismaTransferFeatureFlagAdapter implements TransferFeatureFlagPort {
  constructor(private readonly prisma: PrismaClient) {}

  async isEnabled(schoolId: string): Promise<boolean> {
    const config = await this.prisma.schoolConfig.findUnique({
      where: { schoolId },
      select: { studentTransferEnabled: true },
    });
    return config?.studentTransferEnabled === true;
  }
}
