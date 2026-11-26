/**
 * INFRASTRUCTURE LAYER — Adaptateur Prisma pour ChapitreAvancement (coche directe)
 * et ProgrammeModuleEtat (activation/désactivation de modules).
 */
import type { PrismaClient } from '@prisma/client';
import type {
  ChapitreAvancementProps,
  ChapitreAvancementRepository,
  ChapitreContextePourCoche,
  ProgrammeContextePourModule,
  ProgrammeModuleEtatProps,
} from '@domain/ports/repositories/ChapitreAvancementRepository';

export class PrismaChapitreAvancementRepository implements ChapitreAvancementRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAvancementsByClass(
    schoolId: string,
    classId: string,
    academicYearId: string,
  ): Promise<ChapitreAvancementProps[]> {
    return this.prisma.chapitreAvancement.findMany({
      where: { schoolId, classId, academicYearId },
    });
  }

  async findAvancementsByClassAndChapitres(
    schoolId: string,
    classId: string,
    chapitreIds: string[],
  ): Promise<ChapitreAvancementProps[]> {
    if (chapitreIds.length === 0) return [];
    return this.prisma.chapitreAvancement.findMany({
      where: { schoolId, classId, chapitreId: { in: chapitreIds } },
    });
  }

  async marquerFait(data: {
    schoolId: string;
    classId: string;
    chapitreId: string;
    academicYearId: string;
    cocheParId: string;
  }): Promise<ChapitreAvancementProps> {
    return this.prisma.chapitreAvancement.upsert({
      where: {
        classId_chapitreId: {
          classId: data.classId,
          chapitreId: data.chapitreId,
        },
      },
      create: {
        schoolId: data.schoolId,
        classId: data.classId,
        chapitreId: data.chapitreId,
        academicYearId: data.academicYearId,
        statut: 'FAIT',
        cocheParId: data.cocheParId,
        cocheLe: new Date(),
      },
      update: {
        statut: 'FAIT',
        cocheParId: data.cocheParId,
        cocheLe: new Date(),
      },
    });
  }

  async retirerCocheDirecte(
    schoolId: string,
    classId: string,
    chapitreId: string,
  ): Promise<boolean> {
    const res = await this.prisma.chapitreAvancement.deleteMany({
      where: { schoolId, classId, chapitreId },
    });
    return res.count > 0;
  }

  async findModuleEtatsByProgramme(
    schoolId: string,
    programmeId: string,
  ): Promise<ProgrammeModuleEtatProps[]> {
    return this.prisma.programmeModuleEtat.findMany({
      where: { schoolId, programmeId },
      orderBy: { moduleOrdre: 'asc' },
    });
  }

  async findModuleEtatsByProgrammes(
    schoolId: string,
    programmeIds: string[],
  ): Promise<ProgrammeModuleEtatProps[]> {
    if (programmeIds.length === 0) return [];
    return this.prisma.programmeModuleEtat.findMany({
      where: { schoolId, programmeId: { in: programmeIds } },
    });
  }

  async definirModuleActif(data: {
    schoolId: string;
    programmeId: string;
    moduleOrdre: number;
    actif: boolean;
    modifieParId: string;
  }): Promise<ProgrammeModuleEtatProps> {
    return this.prisma.programmeModuleEtat.upsert({
      where: {
        programmeId_moduleOrdre: {
          programmeId: data.programmeId,
          moduleOrdre: data.moduleOrdre,
        },
      },
      create: {
        schoolId: data.schoolId,
        programmeId: data.programmeId,
        moduleOrdre: data.moduleOrdre,
        actif: data.actif,
        modifieParId: data.modifieParId,
        modifieLe: new Date(),
      },
      update: {
        actif: data.actif,
        modifieParId: data.modifieParId,
        modifieLe: new Date(),
      },
    });
  }

  async findChapitreContextePourCoche(
    schoolId: string,
    chapitreId: string,
  ): Promise<ChapitreContextePourCoche | null> {
    const row = await this.prisma.chapitre.findFirst({
      where: { id: chapitreId, programme: { schoolId } },
      select: {
        id: true,
        programmeId: true,
        moduleOrdre: true,
        programme: {
          select: {
            schoolId: true,
            subjectId: true,
            classId: true,
            level: true,
            academicYearId: true,
          },
        },
      },
    });
    if (!row) return null;

    return {
      chapitreId: row.id,
      programmeId: row.programmeId,
      schoolId: row.programme.schoolId,
      subjectId: row.programme.subjectId,
      classId: row.programme.classId,
      level: row.programme.level,
      academicYearId: row.programme.academicYearId,
      moduleOrdre: row.moduleOrdre,
    };
  }

  async findProgrammeContextePourModule(
    schoolId: string,
    programmeId: string,
  ): Promise<ProgrammeContextePourModule | null> {
    const row = await this.prisma.programme.findFirst({
      where: { id: programmeId, schoolId },
      select: {
        id: true,
        schoolId: true,
        subjectId: true,
        classId: true,
        level: true,
        academicYearId: true,
        chapitres: { select: { moduleOrdre: true } },
      },
    });
    if (!row) return null;

    const ordres = Array.from(
      new Set(
        row.chapitres
          .map((c) => c.moduleOrdre)
          .filter((m): m is number => m !== null && m !== undefined),
      ),
    ).sort((a, b) => a - b);

    return {
      programmeId: row.id,
      schoolId: row.schoolId,
      subjectId: row.subjectId,
      classId: row.classId,
      level: row.level,
      academicYearId: row.academicYearId,
      modulesOrdresExistants: ordres,
    };
  }

  async estAnimateurPedagogiqueDeMatiere(
    schoolId: string,
    userId: string,
    subjectId: string,
  ): Promise<boolean> {
    const dept = await this.prisma.department.findFirst({
      where: {
        schoolId,
        headId: userId,
        subjects: { some: { id: subjectId } },
      },
      select: { id: true },
    });
    return dept !== null;
  }
}
