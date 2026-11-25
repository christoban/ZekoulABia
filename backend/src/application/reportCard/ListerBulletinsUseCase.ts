import type { BulletinRepository } from '@domain/ports/repositories/BulletinRepository';
import type { ParentRepository } from '@domain/ports/repositories/ParentRepository';

export interface MesBulletinsInput {
  schoolId: string;
  studentId: string;
  academicYearId?: string;
}

export interface ListerInput {
  schoolId: string;
  role: string;
  userId: string;
  page?: number;
  limit?: number;
  academicYearId?: string;
  academicPeriodId?: string;
  studentId?: string;
  classId?: string;
}

export class ListerBulletinsUseCase {
  constructor(
    private readonly bulletinRepository: BulletinRepository,
    private readonly parentRepository: ParentRepository,
  ) {}

  async mesBulletins(input: MesBulletinsInput): Promise<{ reportCards: Record<string, unknown>[] }> {
    const reportCards = await this.bulletinRepository.findByEleveFiltre({
      schoolId: input.schoolId,
      studentId: input.studentId,
      academicYearId: input.academicYearId,
      classWorkflowStatusIn: ['SUBMITTED', 'VALIDATED', 'PUBLISHED'],
    });
    return { reportCards };
  }

  async lister(input: ListerInput): Promise<{ reportCards: Record<string, unknown>[]; pagination: { total: number; page: number; pages: number; limit: number } }> {
    const page = Math.max(1, Number(input.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(input.limit) || 10));
    const role = input.role.toUpperCase();

    let studentIdFilter: string | { in: string[] } | undefined;
    let classWorkflowStatusIn: string[] | undefined;
    if (role === 'STUDENT') {
      studentIdFilter = input.userId;
      classWorkflowStatusIn = ['SUBMITTED', 'VALIDATED', 'PUBLISHED'];
    } else if (role === 'PARENT') {
      const childIds = await this.parentRepository.findStudentIdsByParent(input.userId);
      if (input.studentId && childIds.includes(input.studentId)) studentIdFilter = input.studentId;
      else studentIdFilter = { in: childIds };
      classWorkflowStatusIn = ['SUBMITTED', 'VALIDATED', 'PUBLISHED'];
    } else if (input.studentId) {
      studentIdFilter = input.studentId;
    }

    const { items, total } = await this.bulletinRepository.findPaginated({
      schoolId: input.schoolId,
      academicYearId: input.academicYearId,
      academicPeriodId: input.academicPeriodId,
      studentId: studentIdFilter,
      classId: input.classId,
      classWorkflowStatusIn,
      page,
      limit,
    });

    return { reportCards: items, pagination: { total, page, pages: Math.ceil(total / limit), limit } };
  }
}
