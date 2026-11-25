import type { PrismaClient } from '@prisma/client';
import type {
  MinesecJobsRepository,
  EcoleActive,
  AnneeCourante,
  PaiementOverdueForRelance,
} from '@domain/ports/repositories/MinesecJobsRepository';

export class PrismaMinesecJobsRepository implements MinesecJobsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listerEcolesActives(): Promise<EcoleActive[]> {
    return this.prisma.school.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true },
    }) as Promise<EcoleActive[]>;
  }

  async trouverAnneeCourante(schoolId: string): Promise<AnneeCourante | null> {
    return this.prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
    }) as Promise<AnneeCourante | null>;
  }

  async listerPaiementsEnRetard(schoolId: string, anneeScolaire: string, seuilDate: Date): Promise<PaiementOverdueForRelance[]> {
    return this.prisma.paiementMinesec.findMany({
      where: {
        schoolId,
        anneeScolaire,
        status: 'IMPAYE',
        dateEcheance: { lt: seuilDate },
      },
      include: {
        student: {
          include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } },
        },
      },
    }) as unknown as Promise<PaiementOverdueForRelance[]>;
  }

  async compterElevesActifs(schoolId: string): Promise<number> {
    return this.prisma.studentProfile.count({
      where: { user: { schoolId }, studentStatus: 'ACTIVE' },
    });
  }

  async compterSansMatricule(schoolId: string): Promise<number> {
    return this.prisma.studentProfile.count({
      where: {
        user: { schoolId },
        studentStatus: 'ACTIVE',
        matricule: null,
      },
    });
  }
}
