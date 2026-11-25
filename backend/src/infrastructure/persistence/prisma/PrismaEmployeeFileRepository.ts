import type { PrismaClient, Prisma } from '@prisma/client';
import type { EmployeeFileRepository, EmployeeFileData } from '@domain/ports/repositories/EmployeeFileRepository';

export class PrismaEmployeeFileRepository implements EmployeeFileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByUser(userId: string): Promise<EmployeeFileData | null> {
    return this.prisma.employeeFile.findUnique({ where: { userId } });
  }

  async findManyByUserIds(userIds: string[]): Promise<EmployeeFileData[]> {
    return this.prisma.employeeFile.findMany({ where: { userId: { in: userIds } } });
  }

  async findByUserAndSchool(userId: string, schoolId: string): Promise<EmployeeFileData | null> {
    return this.prisma.employeeFile.findUnique({ where: { userId } }).then(f => (f && f.schoolId === schoolId ? f : null));
  }

  async save(data: EmployeeFileData): Promise<EmployeeFileData> {
    return this.prisma.employeeFile.upsert({
      where: { userId: data.userId },
      create: { userId: data.userId, schoolId: data.schoolId, dateNaissance: data.dateNaissance, gender: data.gender, diplomes: (data.diplomes ?? []) as unknown as Prisma.InputJsonValue, numeroCNPS: data.numeroCNPS, typeContrat: data.typeContrat, dateEmbauche: data.dateEmbauche, echelonActuel: data.echelonActuel, documentsUrls: (data.documentsUrls ?? []) as unknown as Prisma.InputJsonValue },
      update: { dateNaissance: data.dateNaissance, gender: data.gender, diplomes: (data.diplomes ?? []) as unknown as Prisma.InputJsonValue, numeroCNPS: data.numeroCNPS, typeContrat: data.typeContrat, dateEmbauche: data.dateEmbauche, echelonActuel: data.echelonActuel, documentsUrls: (data.documentsUrls ?? []) as unknown as Prisma.InputJsonValue },
    });
  }

  async upsertByUser(userId: string, schoolId: string, data: Partial<EmployeeFileData>): Promise<EmployeeFileData> {
    const { id: _id, userId: _uid, schoolId: _sid, ...fields } = data;
    return this.prisma.employeeFile.upsert({
      where: { userId },
      create: { userId, schoolId, ...fields } as Prisma.EmployeeFileUncheckedCreateInput,
      update: fields as Prisma.EmployeeFileUpdateInput,
    });
  }
}
