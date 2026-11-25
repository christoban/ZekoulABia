import type { PrismaClient } from '@prisma/client';
import type { StudentDocumentRepository, VerifiableDocumentData } from '@domain/ports/repositories/StudentDocumentRepository';

export class PrismaStudentDocumentRepository implements StudentDocumentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: { type: string; studentId: string; schoolId: string; dataSnapshot: unknown }): Promise<{ id: string }> {
    const doc = await this.prisma.verifiableDocument.create({
      data: {
        type: data.type as never,
        studentId: data.studentId,
        schoolId: data.schoolId,
        dataSnapshot: data.dataSnapshot as never,
      },
    });
    return { id: doc.id };
  }

  async findById(id: string): Promise<VerifiableDocumentData | null> {
    const doc = await this.prisma.verifiableDocument.findUnique({ where: { id } });
    if (!doc) return null;
    return {
      id: doc.id,
      type: doc.type as string,
      schoolId: doc.schoolId,
      generatedAt: doc.generatedAt,
      dataSnapshot: doc.dataSnapshot,
    };
  }
}
