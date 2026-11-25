import type { PrismaClient, CareerEventType } from '@prisma/client';
import type { CareerEventRepository, CareerEventData } from '@domain/ports/repositories/CareerEventRepository';

export class PrismaCareerEventRepository implements CareerEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByUserOrdered(userId: string, schoolId: string): Promise<CareerEventData[]> {
    return this.prisma.careerEvent.findMany({ where: { userId, schoolId }, orderBy: { date: 'desc' } });
  }

  async create(data: { userId: string; schoolId: string; type: string; date: Date; observation?: string }): Promise<CareerEventData> {
    return this.prisma.careerEvent.create({ data: { userId: data.userId, schoolId: data.schoolId, type: data.type as CareerEventType, date: data.date, observation: data.observation ?? null } });
  }

  async findByUser(userId: string, schoolId: string, order: 'asc' | 'desc' = 'desc'): Promise<CareerEventData[]> {
    return this.prisma.careerEvent.findMany({ where: { userId, schoolId }, orderBy: { date: order } });
  }
}
