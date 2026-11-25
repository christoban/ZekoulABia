import type { PrismaClient } from '@prisma/client';
import type {
  GroupTransferRepository,
  DemandeTransfertData,
} from '@domain/ports/repositories/GroupTransferRepository';

export class PrismaGroupTransferRepository implements GroupTransferRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async trouverParId(demandeId: string): Promise<DemandeTransfertData | null> {
    return this.prisma.groupTransferRequest.findUnique({ where: { id: demandeId } }) as Promise<DemandeTransfertData | null>;
  }

  async creer(data: {
    groupId: string;
    type: 'STUDENT' | 'STAFF';
    sourceSchoolId: string;
    targetSchoolId: string;
    sourceUserId: string;
    requestedByOwnerId: string;
  }): Promise<DemandeTransfertData> {
    return this.prisma.groupTransferRequest.create({ data }) as Promise<DemandeTransfertData>;
  }

  async listerEntrantesEnAttente(targetSchoolId: string): Promise<DemandeTransfertData[]> {
    return this.prisma.groupTransferRequest.findMany({
      where: { targetSchoolId, status: 'PENDING_TARGET_ADMIN' },
      orderBy: { createdAt: 'asc' },
    }) as Promise<DemandeTransfertData[]>;
  }

  async listerParGroupe(groupId: string): Promise<DemandeTransfertData[]> {
    return this.prisma.groupTransferRequest.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
    }) as Promise<DemandeTransfertData[]>;
  }

  async rejeter(demandeId: string): Promise<DemandeTransfertData> {
    return this.prisma.groupTransferRequest.update({
      where: { id: demandeId },
      data: { status: 'REJECTED', decidedAt: new Date() },
    }) as Promise<DemandeTransfertData>;
  }

  async accepterEleve(demandeId: string, onboardingId: string, studentProfileId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.groupTransferRequest.update({
        where: { id: demandeId },
        data: { status: 'ACCEPTED', onboardingId, decidedAt: new Date() },
      }),
      this.prisma.studentProfile.update({
        where: { id: studentProfileId },
        data: { studentStatus: 'TRANSFERRED' },
      }),
    ]);
  }

  async accepterEnseignant(demandeId: string): Promise<void> {
    await this.prisma.groupTransferRequest.update({
      where: { id: demandeId },
      data: { status: 'ACCEPTED', decidedAt: new Date() },
    });
  }
}