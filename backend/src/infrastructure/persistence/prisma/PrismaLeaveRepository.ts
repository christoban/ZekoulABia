import type { PrismaClient, LeaveStatus, LeaveType } from '@prisma/client';
import type { LeaveRepository, LeaveRequestData, LeaveBalanceData } from '@domain/ports/repositories/LeaveRepository';

export class PrismaLeaveRepository implements LeaveRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findRequestByIdAndSchool(id: string, schoolId: string): Promise<LeaveRequestData | null> {
    return this.prisma.leaveRequest.findFirst({ where: { id, schoolId } });
  }

  async updateRequestStatus(id: string, statut: string, validatedById: string | null): Promise<LeaveRequestData> {
    return this.prisma.leaveRequest.update({ where: { id }, data: { statut: statut as LeaveStatus, validatedBy: validatedById, validatedAt: new Date() } });
  }

  async createRequest(data: { userId: string; schoolId: string; type: string; dateDebut: Date; dateFin: Date; motif?: string }): Promise<LeaveRequestData> {
    return this.prisma.leaveRequest.create({ data: { userId: data.userId, schoolId: data.schoolId, type: data.type as LeaveType, dateDebut: data.dateDebut, dateFin: data.dateFin, motif: data.motif ?? null } });
  }

  async findRequestsBySchool(schoolId: string, userId?: string): Promise<LeaveRequestData[]> {
    return this.prisma.leaveRequest.findMany({ where: { schoolId, ...(userId ? { userId } : {}) }, orderBy: { createdAt: 'desc' } });
  }

  async findBalanceForYear(userId: string, annee: number): Promise<LeaveBalanceData | null> {
    return this.prisma.leaveBalance.findUnique({ where: { userId_annee: { userId, annee } } }).catch(() => null);
  }

  async findLatestBalance(userId: string, schoolId: string): Promise<LeaveBalanceData | null> {
    return this.prisma.leaveBalance.findFirst({ where: { userId, schoolId }, orderBy: { annee: 'desc' } });
  }

  async createBalance(data: { userId: string; schoolId: string; annee: number }): Promise<LeaveBalanceData> {
    return this.prisma.leaveBalance.create({ data: { userId: data.userId, schoolId: data.schoolId, annee: data.annee, soldeInitial: 30, soldeRestant: 30 } });
  }

  async upsertBalanceForYear(userId: string, schoolId: string, annee: number): Promise<LeaveBalanceData> {
    return this.prisma.leaveBalance.upsert({
      where: { userId_annee: { userId, annee } },
      create: { userId, schoolId, annee, soldeInitial: 30, soldeRestant: 30 },
      update: {},
    });
  }

  async decrementBalance(id: string, jours: number): Promise<void> {
    const balance = await this.prisma.leaveBalance.findUnique({ where: { id } });
    if (!balance) return;
    await this.prisma.leaveBalance.update({ where: { id }, data: { soldeRestant: Math.max(0, Number(balance.soldeRestant) - jours) } });
  }

  async findBalancesByUser(userId: string, schoolId: string): Promise<LeaveBalanceData[]> {
    return this.prisma.leaveBalance.findMany({ where: { userId, schoolId }, orderBy: { annee: 'desc' } });
  }
}
