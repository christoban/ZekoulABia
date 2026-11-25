import type { PrismaClient } from '@prisma/client';
import type { StudentRecommendationRepository, StudentRecommendationData } from '@domain/ports/repositories/StudentRecommendationRepository';

export class PrismaStudentRecommendationRepository implements StudentRecommendationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: Omit<StudentRecommendationData, 'id' | 'createdAt'>): Promise<StudentRecommendationData> {
    return this.prisma.studentRecommendation.create({
      data: {
        schoolId: data.schoolId,
        studentId: data.studentId,
        subjectId: data.subjectId ?? null,
        recipientRole: data.recipientRole,
        contextType: data.contextType,
        content: data.content,
      },
    });
  }

  async findById(id: string, schoolId: string): Promise<StudentRecommendationData | null> {
    return this.prisma.studentRecommendation.findFirst({
      where: { id, schoolId },
    });
  }

  async findByStudent(studentId: string, schoolId: string): Promise<StudentRecommendationData[]> {
    return this.prisma.studentRecommendation.findMany({
      where: { studentId, schoolId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByStudentAndSubject(studentId: string, subjectId: string, schoolId: string): Promise<StudentRecommendationData | null> {
    return this.prisma.studentRecommendation.findFirst({
      where: { studentId, subjectId, schoolId },
    });
  }
}