import type { PrismaClient } from '@prisma/client';
import type {
  StudentFollowUpRepository,
  FollowUpActionDetail,
  CreerFollowUpData,
  ConseillerDisponible,
  CreerConvocationData,
} from '@domain/ports/repositories/StudentFollowUpRepository';

const SELECT_DETAIL = {
  id: true,
  schoolId: true,
  studentProfileId: true,
  triggeringRecommendationId: true,
  subjectId: true,
  type: true,
  status: true,
  createdById: true,
  assignedToId: true,
  targetDate: true,
  interviewMode: true,
  note: true,
  createdAt: true,
  closedAt: true,
  closedById: true,
  closingNote: true,
  studentProfile: {
    select: {
      userId: true,
      user: { select: { firstName: true, lastName: true } },
      enrollmentsYearScoped: {
        where: { status: 'ACTIVE' as const, academicYear: { isCurrent: true } },
        take: 1,
        select: { classId: true, class: { select: { name: true, professorPrincipalId: true } } },
      },
    },
  },
  subject: { select: { name: true } },
  createdBy: { select: { firstName: true, lastName: true } },
  assignedTo: { select: { firstName: true, lastName: true } },
  closedBy: { select: { firstName: true, lastName: true } },
} as const;

type RawFollowUp = {
  id: string;
  schoolId: string;
  studentProfileId: string;
  triggeringRecommendationId: string | null;
  subjectId: string | null;
  type: string;
  status: string;
  createdById: string;
  assignedToId: string | null;
  targetDate: Date | null;
  interviewMode: string | null;
  note: string | null;
  createdAt: Date;
  closedAt: Date | null;
  closedById: string | null;
  closingNote: string | null;
  studentProfile: {
    userId: string;
    user: { firstName: string; lastName: string };
    enrollmentsYearScoped: {
      classId: string;
      class: { name: string; professorPrincipalId: string | null } | null;
    }[];
  };
  subject: { name: string } | null;
  createdBy: { firstName: string; lastName: string };
  assignedTo: { firstName: string; lastName: string } | null;
  closedBy: { firstName: string; lastName: string } | null;
};

function versDetail(r: RawFollowUp): FollowUpActionDetail {
  return {
    id: r.id,
    schoolId: r.schoolId,
    studentProfileId: r.studentProfileId,
    studentId: r.studentProfile.userId,
    studentName: `${r.studentProfile.user.firstName} ${r.studentProfile.user.lastName}`,
    classId: r.studentProfile.enrollmentsYearScoped[0]?.classId ?? null,
    className: r.studentProfile.enrollmentsYearScoped[0]?.class?.name ?? null,
    classProfessorPrincipalId: r.studentProfile.enrollmentsYearScoped[0]?.class?.professorPrincipalId ?? null,
    triggeringRecommendationId: r.triggeringRecommendationId,
    subjectId: r.subjectId,
    subjectName: r.subject?.name ?? null,
    type: r.type as FollowUpActionDetail['type'],
    status: r.status as FollowUpActionDetail['status'],
    createdById: r.createdById,
    createdByName: `${r.createdBy.firstName} ${r.createdBy.lastName}`,
    assignedToId: r.assignedToId,
    assignedToName: r.assignedTo ? `${r.assignedTo.firstName} ${r.assignedTo.lastName}` : null,
    targetDate: r.targetDate,
    interviewMode: r.interviewMode as FollowUpActionDetail['interviewMode'],
    note: r.note,
    createdAt: r.createdAt,
    closedAt: r.closedAt,
    closedById: r.closedById,
    closedByName: r.closedBy ? `${r.closedBy.firstName} ${r.closedBy.lastName}` : null,
    closingNote: r.closingNote,
  };
}

export class PrismaStudentFollowUpRepository implements StudentFollowUpRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreerFollowUpData): Promise<FollowUpActionDetail> {
    const created = await this.prisma.studentFollowUpAction.create({
      data: {
        schoolId: data.schoolId,
        studentProfileId: data.studentProfileId,
        triggeringRecommendationId: data.triggeringRecommendationId ?? null,
        subjectId: data.subjectId ?? null,
        type: data.type,
        createdById: data.createdById,
        assignedToId: data.assignedToId ?? null,
        targetDate: data.targetDate ?? null,
        interviewMode: data.interviewMode ?? null,
        note: data.note ?? null,
      },
      select: SELECT_DETAIL,
    });
    return versDetail(created);
  }

  async findById(id: string, schoolId: string): Promise<FollowUpActionDetail | null> {
    const found = await this.prisma.studentFollowUpAction.findFirst({
      where: { id, schoolId },
      select: SELECT_DETAIL,
    });
    return found ? versDetail(found) : null;
  }

  // updateMany({where: {id, status: {not: 'CLOS'}}}) plutôt que update({where: {id}}) : le use
  // case lit déjà le statut avant d'appeler close()/reassign(), mais entre cette lecture et
  // l'écriture, une autre requête concurrente (le créateur ET l'assigné qui cliquent "Clôturer"
  // à quelques millisecondes d'écart) peut avoir déjà clôturé l'action — sans cette condition sur
  // l'écriture elle-même, la seconde clôture écraserait silencieusement closingNote/closedById de
  // la première. count===0 signale que la course a été perdue, sans quoi update() aurait de toute
  // façon réussi silencieusement.
  async close(id: string, closedById: string, closingNote: string): Promise<FollowUpActionDetail> {
    const result = await this.prisma.studentFollowUpAction.updateMany({
      where: { id, status: { not: 'CLOS' } },
      data: { status: 'CLOS', closedAt: new Date(), closedById, closingNote },
    });
    if (result.count === 0) {
      throw new Error('Cette action est déjà clôturée');
    }
    const updated = await this.prisma.studentFollowUpAction.findUniqueOrThrow({
      where: { id },
      select: SELECT_DETAIL,
    });
    return versDetail(updated);
  }

  async reassign(id: string, assignedToId: string): Promise<FollowUpActionDetail> {
    const result = await this.prisma.studentFollowUpAction.updateMany({
      where: { id, status: { not: 'CLOS' } },
      data: { assignedToId, status: 'EN_COURS' },
    });
    if (result.count === 0) {
      throw new Error('Impossible de réassigner une action déjà clôturée');
    }
    const updated = await this.prisma.studentFollowUpAction.findUniqueOrThrow({
      where: { id },
      select: SELECT_DETAIL,
    });
    return versDetail(updated);
  }

  async listOpen(schoolId: string, options: { assignedToId?: string }): Promise<FollowUpActionDetail[]> {
    const rows = await this.prisma.studentFollowUpAction.findMany({
      where: {
        schoolId,
        status: { in: ['OUVERT', 'EN_COURS'] },
        ...(options.assignedToId ? { assignedToId: options.assignedToId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: SELECT_DETAIL,
    });
    return rows.map(versDetail);
  }

  async listForStudent(studentProfileId: string, schoolId: string): Promise<FollowUpActionDetail[]> {
    const rows = await this.prisma.studentFollowUpAction.findMany({
      where: { studentProfileId, schoolId },
      orderBy: { createdAt: 'desc' },
      select: SELECT_DETAIL,
    });
    return rows.map(versDetail);
  }

  async listConseillersDisponibles(schoolId: string): Promise<ConseillerDisponible[]> {
    const conseillers = await this.prisma.staffProfile.findMany({
      where: { schoolId, permissions: { some: { permission: { in: ['MANAGE_ORIENTATION', 'MANAGE_PEDAGOGICAL_BRIEF'] } } } },
      select: { userId: true, user: { select: { firstName: true, lastName: true } } },
    });
    return conseillers.map((c) => ({ id: c.userId, name: `${c.user.firstName} ${c.user.lastName}` }));
  }

  async createConvocation(data: CreerConvocationData): Promise<void> {
    await this.prisma.studentRecommendation.create({
      data: {
        schoolId: data.schoolId,
        studentId: data.studentId,
        recipientRole: 'STUDENT',
        contextType: 'CONVOCATION',
        content: data.content,
      },
    });
  }
}
