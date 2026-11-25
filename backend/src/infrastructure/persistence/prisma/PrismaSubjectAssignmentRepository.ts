import type { PrismaClient, Prisma } from '@prisma/client';
import type {
  SubjectAssignmentRepository,
  MatiereReference,
  BacMatiereReference,
} from '@domain/ports/repositories/SubjectAssignmentRepository';

type DbClient = PrismaClient | Prisma.TransactionClient;

export class PrismaSubjectAssignmentRepository implements SubjectAssignmentRepository {
  constructor(private readonly db: DbClient) {}

  async createSubject(schoolId: string, data: {
    name: string; code: string; coefficient: number; hoursPerWeek: number;
  }): Promise<{ id: string }> {
    const created = await this.db.subject.create({
      data: { schoolId, name: data.name, code: data.code, coefficient: data.coefficient, hoursPerWeek: data.hoursPerWeek, subjectType: 'THEORETICAL' },
    });
    return { id: created.id };
  }

  async upsertSubjectCoefficient(
    schoolId: string,
    subjectId: string,
    classLevel: string,
    serieCode: string | null,
    coefficient: number,
    weeklyPeriods?: number | null,
  ): Promise<void> {
    const payload = { coefficient, weeklyPeriods };
    if (serieCode !== null) {
      await this.db.subjectCoefficient.upsert({
        where: { schoolId_subjectId_classLevel_serieCode: { schoolId, subjectId, classLevel, serieCode } },
        update: payload,
        create: { schoolId, subjectId, classLevel, serieCode, ...payload },
      });
      return;
    }
    const existing = await this.db.subjectCoefficient.findFirst({
      where: { schoolId, subjectId, classLevel, serieCode: null },
      select: { id: true },
    });
    if (existing) {
      await this.db.subjectCoefficient.update({ where: { id: existing.id }, data: payload });
    } else {
      await this.db.subjectCoefficient.create({ data: { schoolId, subjectId, classLevel, serieCode: null, ...payload } });
    }
  }

  async findSubjectCoefficient(schoolId: string, subjectId: string, classLevel: string, serieCode: string | null): Promise<{ id: string } | null> {
    return this.db.subjectCoefficient.findFirst({
      where: { schoolId, subjectId, classLevel, serieCode },
      select: { id: true },
    });
  }

  async findSubjects(schoolId: string): Promise<{ id: string; name: string; coefficient: number }[]> {
    return this.db.subject.findMany({ where: { schoolId } });
  }

  async findAnySubjectCoefficient(schoolId: string, classLevel: string): Promise<{ id: string } | null> {
    return this.db.subjectCoefficient.findFirst({
      where: { schoolId, classLevel },
      select: { id: true },
    });
  }

  async findAnglophoneSubjectLoads(templateCode: string, classLevel: string, filiere: string): Promise<MatiereReference[]> {
    return this.db.anglophoneSubjectLoad.findMany({
      where: { templateCode, classLevel, filiere },
      select: { subjectName: true, coefficient: true, weeklyPeriods: true },
    });
  }

  async findAnglophoneSubjectLoadExists(templateCode: string, classLevel: string): Promise<boolean> {
    const loads = await this.db.anglophoneSubjectLoad.findMany({
      where: { templateCode, classLevel },
      select: { id: true },
      take: 1,
    });
    return loads.length > 0;
  }

  async findCycleCoefficients(templateCode: string, classLevel: string, filiere: string): Promise<MatiereReference[]> {
    return this.db.cycleCoefficient.findMany({
      where: { templateCode, classLevel, filiere },
      select: { subjectName: true, coefficient: true, weeklyPeriods: true },
    });
  }

  async findBacCoefficients(serie: string, niveau: string, templateCode: string): Promise<BacMatiereReference[]> {
    return this.db.bacCoefficient.findMany({
      where: { serie, niveau, templateCode: { in: [templateCode, '__ALL__'] } },
      select: { subjectName: true, coefficient: true },
    });
  }
}
