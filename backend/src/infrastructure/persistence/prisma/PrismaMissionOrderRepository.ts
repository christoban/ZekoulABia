import type { PrismaClient } from '@prisma/client';
import type { MissionOrderRepository, MissionOrderData } from '@domain/ports/repositories/MissionOrderRepository';

export class PrismaMissionOrderRepository implements MissionOrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: { userId: string; schoolId: string; motif: string; lieu: string; dateDebut: Date; dateFin: Date; signataire?: string }): Promise<MissionOrderData> {
    return this.prisma.missionOrder.create({ data: { userId: data.userId, schoolId: data.schoolId, motif: data.motif, lieu: data.lieu, dateDebut: data.dateDebut, dateFin: data.dateFin, signataire: data.signataire ?? null } });
  }

  async findByIdAndSchool(id: string, schoolId: string): Promise<MissionOrderData | null> {
    return this.prisma.missionOrder.findFirst({ where: { id, schoolId } });
  }
}
