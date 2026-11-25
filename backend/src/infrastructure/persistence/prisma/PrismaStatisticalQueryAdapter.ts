import type { PrismaClient } from '@prisma/client';
import type {
  StatisticalQueryPort,
  EleveEsgRow,
  ElevePrimaireRow,
  EcoleIdentification,
  FeePlanRow,
  PersonnelRow,
} from '@domain/ports/repositories/StatisticalQueryPort';
import { NIVEAUX_ESG, NIVEAUX_ESG_EN, NIVEAUX_PRIMAIRES } from '@domain/ports/repositories/StatisticalQueryPort';

export class PrismaStatisticalQueryAdapter implements StatisticalQueryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async listerElevesEsg(schoolId: string): Promise<EleveEsgRow[]> {
    const students = await this.prisma.studentProfile.findMany({
      where: {
        studentStatus: 'ACTIVE',
        user: { schoolId },
        enrollmentsYearScoped: {
          some: {
            status: 'ACTIVE',
            academicYear: { isCurrent: true },
            class: { level: { in: [...NIVEAUX_ESG, ...NIVEAUX_ESG_EN] } },
          },
        },
      },
      select: {
        gender: true,
        dateOfBirth: true,
        enrollmentsYearScoped: {
          where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
          select: { class: { select: { level: true, serie: true, filiere: true } } },
          take: 1,
        },
        lv2Subject: { select: { name: true } },
      },
    });
    return students.flatMap((s): EleveEsgRow[] => {
      const classe = s.enrollmentsYearScoped[0]?.class;
      if (!classe) return [];
      return [{
        gender: s.gender,
        dateOfBirth: s.dateOfBirth,
        niveau: classe.level,
        serie: classe.serie,
        filiere: classe.filiere,
        lv2Name: s.lv2Subject?.name ?? null,
      }];
    });
  }

  async listerElevesPrimaire(schoolId: string): Promise<ElevePrimaireRow[]> {
    const students = await this.prisma.studentProfile.findMany({
      where: {
        studentStatus: 'ACTIVE',
        user: { schoolId },
        enrollmentsYearScoped: {
          some: {
            status: 'ACTIVE',
            academicYear: { isCurrent: true },
            class: { level: { in: [...NIVEAUX_PRIMAIRES] } },
          },
        },
      },
      select: {
        gender: true, dateOfBirth: true,
        enrollmentsYearScoped: {
          where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
          select: { class: { select: { level: true } } },
          take: 1,
        },
      },
    });
    return students.flatMap((s): ElevePrimaireRow[] => {
      const classe = s.enrollmentsYearScoped[0]?.class;
      if (!classe) return [];
      return [{ gender: s.gender, dateOfBirth: s.dateOfBirth, niveau: classe.level }];
    });
  }

  async trouverEcole(schoolId: string): Promise<EcoleIdentification | null> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, subdomain: true, city: true, region: true, address: true, phone: true, educationType: true, ownership: true, subsystem: true },
    });
    return school;
  }

  async listerFeePlans(schoolId: string): Promise<FeePlanRow[]> {
    const plans = await this.prisma.feePlan.findMany({
      where: { schoolId, feeType: { in: ['APEE_PTA', 'INSCRIPTION'] } },
      select: { feeType: true, level: true, amount: true },
    });
    return plans;
  }

  async listerPersonnel(schoolId: string): Promise<PersonnelRow[]> {
    const staff = await this.prisma.user.findMany({
      where: { schoolId, isActive: true, role: { in: ['TEACHER', 'STAFF', 'ADMIN'] } },
      select: {
        firstName: true,
        lastName: true,
        staffProfile: { select: { title: true } },
        teacherProfile: { select: { specialization: true } },
        employeeFile: { select: { dateNaissance: true, gender: true, diplomes: true, numeroCNPS: true, typeContrat: true, echelonActuel: true, dateEmbauche: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return staff.map((u): PersonnelRow => ({
      firstName: u.firstName,
      lastName: u.lastName,
      staffTitle: u.staffProfile?.title ?? null,
      specialization: u.teacherProfile?.specialization ?? [],
      employeeFile: u.employeeFile
        ? {
            dateNaissance: u.employeeFile.dateNaissance,
            gender: u.employeeFile.gender,
            diplomes: (u.employeeFile.diplomes as unknown[]) ?? [],
            numeroCNPS: u.employeeFile.numeroCNPS,
            typeContrat: u.employeeFile.typeContrat,
            echelonActuel: u.employeeFile.echelonActuel,
            dateEmbauche: u.employeeFile.dateEmbauche,
          }
        : null,
    }));
  }
}
