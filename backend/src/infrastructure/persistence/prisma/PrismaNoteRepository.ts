import type { PrismaClient } from '@prisma/client';
import { Note } from '@domain/entities/Note';
import type { NoteRepository, NoteNonValideeInfo, NoteFilters, PaginatedResult } from '@domain/ports/repositories/NoteRepository';
import type { GradeValidationStatus } from '@domain/types/enums';

export class PrismaNoteRepository implements NoteRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string, schoolId: string): Promise<Note | null> {
    // findFirst et non findUnique : `where` de findUnique n'accepte que des champs uniques,
    // or schoolId ne l'est pas.
    const data = await this.prisma.grade.findFirst({ where: { id, schoolId } });
    if (!data) return null;
    return this.toDomain(data);
  }

  async findByEleve(studentId: string, academicYearId: string): Promise<Note[]> {
    const data = await this.prisma.grade.findMany({
      where: { studentId, academicYearId },
    });
    return data.map(d => this.toDomain(d));
  }

  async findByClasse(classId: string, sequenceId: string): Promise<Note[]> {
    const data = await this.prisma.grade.findMany({
      where: { classId, sequenceId },
    });
    return data.map(d => this.toDomain(d));
  }

  async findByEnseignant(teacherId: string, sequenceId: string): Promise<Note[]> {
    const data = await this.prisma.grade.findMany({
      where: { recordedById: teacherId, sequenceId },
    });
    return data.map(d => this.toDomain(d));
  }

  async findByEleveEtMatiere(
    studentId: string,
    subjectId: string,
    sequenceId: string
  ): Promise<Note | null> {
    const data = await this.prisma.grade.findUnique({
      where: { studentId_subjectId_sequenceId: { studentId, subjectId, sequenceId } },
    });
    if (!data) return null;
    return this.toDomain(data);
  }

  async findByStatut(
    classId: string,
    sequenceId: string,
    statut: GradeValidationStatus
  ): Promise<Note[]> {
    const data = await this.prisma.grade.findMany({
      where: { classId, sequenceId, validationStatus: statut },
    });
    return data.map(d => this.toDomain(d));
  }

  async findByStatuts(
    classId: string,
    sequenceId: string,
    statuts: GradeValidationStatus[]
  ): Promise<Note[]> {
    const data = await this.prisma.grade.findMany({
      where: { classId, sequenceId, validationStatus: { in: statuts } },
    });
    return data.map(d => this.toDomain(d));
  }

  async findClassmatesAverages(
    classId: string,
    sequenceId: string,
    schoolId: string
  ): Promise<{ studentId: string; average: number }[]> {
    const rows = await this.prisma.grade.groupBy({
      by: ['studentId'],
      where: {
        schoolId,
        classId,
        sequenceId,
        validationStatus: 'LOCKED',
        isAbsentGrade: false,
      },
      _avg: { sequenceAverage: true },
      orderBy: { _avg: { sequenceAverage: 'desc' } },
    });

    return rows.map(r => ({
      studentId: r.studentId,
      average: r._avg.sequenceAverage ?? 0,
    }));
  }

  async findNotesNonValideesParClasse(
    classId: string,
    academicPeriodId: string
  ): Promise<NoteNonValideeInfo[]> {
    const sequences = await this.prisma.academicSequence.findMany({
      where: { academicPeriodId },
      select: { id: true },
    });
    const sequenceIds = sequences.map(s => s.id);

    const notes = await this.prisma.grade.findMany({
      where: {
        classId,
        sequenceId: { in: sequenceIds },
        validationStatus: 'DRAFT',
      },
      include: {
        subject: { select: { name: true } },
        recordedBy: { select: { firstName: true, lastName: true } },
      },
    });

    return notes.map(n => ({
      matiereNom: n.subject.name,
      enseignantNom: n.recordedBy
        ? `${n.recordedBy.firstName} ${n.recordedBy.lastName}`
        : 'Enseignant inconnu',
      statut: n.validationStatus as GradeValidationStatus,
    }));
  }

  async toutesNotesValideesParClasse(
    classId: string,
    academicPeriodId: string
  ): Promise<boolean> {
    const nonValidees = await this.findNotesNonValideesParClasse(classId, academicPeriodId);
    return nonValidees.length === 0;
  }

  async find(filters: NoteFilters, page: number, limit: number): Promise<PaginatedResult<Note>> {
    const where: any = { schoolId: filters.schoolId };
    if (filters.classId) where.classId = filters.classId;
    if (filters.subjectId) where.subjectId = filters.subjectId;
    if (filters.subjectIds) where.subjectId = { in: filters.subjectIds };
    if (filters.sequenceId) where.sequenceId = filters.sequenceId;
    if (filters.studentId) where.studentId = filters.studentId;
    if (filters.studentIds) where.studentId = { in: filters.studentIds };
    if (filters.validationStatus) where.validationStatus = filters.validationStatus;

    const [total, data] = await Promise.all([
      this.prisma.grade.count({ where }),
      this.prisma.grade.findMany({
        where,
        orderBy: [{ classId: 'asc' }, { subjectId: 'asc' }, { studentId: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: data.map(d => this.toDomain(d)),
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
    };
  }

  async save(note: Note): Promise<void> {
    const data = note.toObject();
    await this.prisma.grade.create({
      data: {
        id: data.id,
        schoolId: data.schoolId,
        studentId: data.studentId,
        subjectId: data.subjectId,
        classId: data.classId,
        academicYearId: data.academicYearId,
        sequenceId: data.sequenceId,
        recordedById: data.recordedById,
        sequenceScore: data.sequenceScore,
        classTestScore: data.classTestScore,
        terminalExamScore: data.terminalExamScore,
        theoreticalScore: data.theoreticalScore,
        practicalScore: data.practicalScore,
        professionalAttitude: data.professionalAttitude,
        oralScore: data.oralScore,
        selfDevelopmentScore: data.selfDevelopmentScore,
        coefficient: data.coefficient,
        maxValue: data.maxValue,
        sequenceAverage: data.sequenceAverage,
        validationStatus: data.validationStatus,
        isOfflineSync: data.isOfflineSync,
        isAbsentGrade: data.isAbsentGrade,
        harmonizedAssessmentSessionId: data.harmonizedAssessmentSessionId ?? null,
        createdAt: data.createdAt,
      },
    });
  }

  async update(note: Note): Promise<void> {
    const data = note.toObject();
    await this.prisma.grade.update({
      where: { id: data.id },
      data: {
        sequenceScore: data.sequenceScore,
        classTestScore: data.classTestScore,
        terminalExamScore: data.terminalExamScore,
        theoreticalScore: data.theoreticalScore,
        practicalScore: data.practicalScore,
        professionalAttitude: data.professionalAttitude,
        oralScore: data.oralScore,
        selfDevelopmentScore: data.selfDevelopmentScore,
        sequenceAverage: data.sequenceAverage,
        coefficient: data.coefficient,
        maxValue: data.maxValue,
        validationStatus: data.validationStatus,
        validatedById: data.validatedById ?? null,
        validatedAt: data.validatedAt ?? null,
        rejectionReason: data.rejectionReason ?? null,
        isOfflineSync: data.isOfflineSync,
        syncedAt: data.syncedAt ?? null,
        isAbsentGrade: data.isAbsentGrade,
        harmonizedAssessmentSessionId: data.harmonizedAssessmentSessionId ?? null,
      },
    });
  }

  async updateStatut(
    noteId: string,
    statut: GradeValidationStatus,
    validateurId?: string,
    motif?: string
  ): Promise<void> {
    await this.prisma.grade.update({
      where: { id: noteId },
      data: {
        validationStatus: statut,
        validatedById: validateurId ?? null,
        validatedAt: validateurId ? new Date() : null,
        rejectionReason: motif ?? null,
      },
    });
  }

  async verrouillerNotesValidees(studentId: string, classId: string, academicPeriodId: string): Promise<void> {
    const sequences = await this.prisma.academicSequence.findMany({
      where: { academicPeriodId },
      select: { id: true },
    });
    const sequenceIds = sequences.map(s => s.id);
    await this.prisma.grade.updateMany({
      where: {
        studentId,
        classId,
        sequenceId: { in: sequenceIds },
        validationStatus: 'DRAFT',
      },
      data: { validationStatus: 'LOCKED' },
    });
  }

  async findNotesEnAttenteDepuis(heures: number): Promise<Note[]> {
    const depuis = new Date(Date.now() - heures * 60 * 60 * 1000);
    const data = await this.prisma.grade.findMany({
      where: {
        validationStatus: 'DRAFT',
        createdAt: { lte: depuis },
      },
    });
    return data.map(d => this.toDomain(d));
  }

  async findValideesParClasseEtEleves(schoolId: string, classId: string, studentIds: string[]): Promise<Array<{ studentId: string; sequenceAverage: number | null; coefficient: number; isAbsentGrade: boolean }>> {
    if (studentIds.length === 0) return [];
    const data = await this.prisma.grade.findMany({
      where: { schoolId, classId, studentId: { in: studentIds }, validationStatus: 'LOCKED' },
      select: { studentId: true, sequenceAverage: true, coefficient: true, isAbsentGrade: true },
    });
    return data;
  }

  async findForBulletin(params: { schoolId: string; studentId: string; academicYearId: string; classId: string; sequenceIds: string[] }): Promise<Note[]> {
    const data = await this.prisma.grade.findMany({
      where: {
        schoolId: params.schoolId,
        studentId: params.studentId,
        academicYearId: params.academicYearId,
        classId: params.classId,
        sequenceId: { in: params.sequenceIds },
      },
      include: { subject: { select: { id: true, name: true, coefficient: true } } },
    });
    // Conserve le subject inclus pour enrichissement côté use case (coefficient/name)
    return data.map((d: any) => {
      const note = this.toDomain(d);
      // Attache subject en propriété non typée pour usage inngest historique (facultatif)
      (note as any).__subject = d.subject;
      return note;
    });
  }

  async groupMoyennesPourPeriode(params: { schoolId: string; classId: string; academicYearId: string; sequenceIds: string[] }): Promise<Array<{ studentId: string; average: number }>> {
    const rows = await this.prisma.grade.groupBy({
      by: ['studentId'],
      where: {
        schoolId: params.schoolId,
        classId: params.classId,
        academicYearId: params.academicYearId,
        sequenceId: { in: params.sequenceIds },
        isAbsentGrade: false,
      },
      _avg: { sequenceAverage: true },
      orderBy: { _avg: { sequenceAverage: 'desc' } },
    });
    return rows.map(r => ({ studentId: r.studentId, average: r._avg.sequenceAverage ?? 0 }));
  }

  async getStatsValidationParClasse(classId: string, schoolId: string, sequenceIds: string[]): Promise<{ total: number; DRAFT: number; LOCKED: number }> {
    const where: Record<string, unknown> = { schoolId, classId };
    if (sequenceIds.length > 0) (where as Record<string, unknown>).sequenceId = { in: sequenceIds };
    const grades = await this.prisma.grade.findMany({ where: where as never, select: { validationStatus: true } });
    const stats: { total: number; DRAFT: number; LOCKED: number } = { total: grades.length, DRAFT: 0, LOCKED: 0 };
    for (const g of grades) {
      if (g.validationStatus === 'DRAFT') stats.DRAFT++;
      else if (g.validationStatus === 'LOCKED') stats.LOCKED++;
    }
    return stats;
  }

  private toDomain(data: any): Note {
    return Note.reconstituer({
      id: data.id,
      schoolId: data.schoolId,
      studentId: data.studentId,
      subjectId: data.subjectId,
      classId: data.classId,
      academicYearId: data.academicYearId,
      sequenceId: data.sequenceId,
      recordedById: data.recordedById ?? undefined,
      sequenceScore: data.sequenceScore ?? undefined,
      classTestScore: data.classTestScore ?? undefined,
      terminalExamScore: data.terminalExamScore ?? undefined,
      theoreticalScore: data.theoreticalScore ?? undefined,
      practicalScore: data.practicalScore ?? undefined,
      professionalAttitude: data.professionalAttitude ?? undefined,
      oralScore: data.oralScore ?? undefined,
      selfDevelopmentScore: data.selfDevelopmentScore ?? undefined,
      coefficient: data.coefficient,
      maxValue: data.maxValue,
      sequenceAverage: data.sequenceAverage ?? undefined,
      validationStatus: data.validationStatus as GradeValidationStatus,
      validatedById: data.validatedById ?? undefined,
      validatedAt: data.validatedAt ?? undefined,
      rejectionReason: data.rejectionReason ?? undefined,
      isOfflineSync: data.isOfflineSync,
      isAbsentGrade: data.isAbsentGrade ?? false,
      harmonizedAssessmentSessionId: data.harmonizedAssessmentSessionId ?? undefined,
      syncedAt: data.syncedAt ?? undefined,
      createdAt: data.createdAt,
    });
  }
}
