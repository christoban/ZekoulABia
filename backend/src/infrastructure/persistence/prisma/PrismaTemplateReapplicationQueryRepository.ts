import type { PrismaClient } from '@prisma/client';
import type { TemplateReapplicationQueryPort, EcoleParTemplate } from '@domain/ports/repositories/TemplateReapplicationQueryPort';

export class PrismaTemplateReapplicationQueryRepository implements TemplateReapplicationQueryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async listerEcolesParTemplate(templateCode: string): Promise<EcoleParTemplate[]> {
    const ecoles = await this.prisma.school.findMany({
      where: { templateCode, status: 'ACTIVE' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return ecoles;
  }
}
