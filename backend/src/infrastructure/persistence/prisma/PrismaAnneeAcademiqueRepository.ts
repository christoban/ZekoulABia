// ponytail: 362l < 500l hard ceiling, single adapter — no split needed until >500l or 2nd impl
import type { PrismaClient, AcademicYear, AcademicPeriod, AcademicSequence } from '@prisma/client';
import type {
  AnneeAcademiqueRepository,
  AnneeAcademiqueProps,
  PeriodeAcademiqueProps,
  SequenceAcademiqueProps,
  CalendrierPeriode,
} from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { AcademicYearStatus, PeriodType, SequenceType } from '@domain/types/enums';

export class PrismaAnneeAcademiqueRepository implements AnneeAcademiqueRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // --- Années ---

  async findById(id: string): Promise<AnneeAcademiqueProps | null> {
    const data = await this.prisma.academicYear.findUnique({ where: { id } });
    if (!data) return null;
    return this.anneeToProps(data);
  }

  async findBySchool(schoolId: string): Promise<AnneeAcademiqueProps[]> {
    const data = await this.prisma.academicYear.findMany({ where: { schoolId } });
    return data.map(d => this.anneeToProps(d));
  }

  async findCourante(schoolId: string): Promise<AnneeAcademiqueProps | null> {
    const data = await this.prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
    });
    if (!data) return null;
    return this.anneeToProps(data);
  }

  async existsByName(schoolId: string, name: string): Promise<boolean> {
    const count = await this.prisma.academicYear.count({ where: { schoolId, name } });
    return count > 0;
  }

  async save(annee: AnneeAcademiqueProps): Promise<void> {
    await this.prisma.academicYear.create({ data: annee });
  }

  async update(annee: AnneeAcademiqueProps): Promise<void> {
    await this.prisma.academicYear.update({
      where: { id: annee.id },
      data: {
        name: annee.name,
        isCurrent: annee.isCurrent,
        status: annee.status,
        startDate: annee.startDate,
        endDate: annee.endDate,
      },
    });
  }

  async archiver(anneeId: string): Promise<void> {
    await this.prisma.academicYear.update({
      where: { id: anneeId },
      data: { status: 'ARCHIVED', isCurrent: false },
    });
  }

  async desactiverToutesAnneesEcole(schoolId: string): Promise<void> {
    await this.prisma.academicYear.updateMany({
      where: { schoolId },
      data: { isCurrent: false },
    });
  }

  // --- Périodes ---

  async findPeriodeById(id: string, schoolId: string): Promise<PeriodeAcademiqueProps | null> {
    // AcademicPeriod ne porte PAS de colonne schoolId : la tenancy est portée par son AcademicYear.
    // Le filtre passe donc par la relation. findFirst et non findUnique — le `where` de findUnique
    // n'accepte que des champs uniques.
    const data = await this.prisma.academicPeriod.findFirst({
      where: { id, academicYear: { schoolId } },
    });
    if (!data) return null;
    return this.periodeToProps(data);
  }

  async findPeriodesByAnnee(academicYearId: string): Promise<PeriodeAcademiqueProps[]> {
    const data = await this.prisma.academicPeriod.findMany({
      where: { academicYearId },
      orderBy: { orderIndex: 'asc' },
    });
    return data.map(d => this.periodeToProps(d));
  }

  async findPeriodeCourante(schoolId: string): Promise<PeriodeAcademiqueProps | null> {
    const annee = await this.findCourante(schoolId);
    if (!annee) return null;
    const data = await this.prisma.academicPeriod.findFirst({
      where: { academicYearId: annee.id, isCurrent: true },
    });
    if (!data) return null;
    return this.periodeToProps(data);
  }

  async findDernierePeriode(academicYearId: string): Promise<PeriodeAcademiqueProps | null> {
    const data = await this.prisma.academicPeriod.findFirst({
      where: { academicYearId },
      orderBy: { orderIndex: 'desc' },
    });
    if (!data) return null;
    return this.periodeToProps(data);
  }

  async savePeriode(periode: PeriodeAcademiqueProps): Promise<void> {
    await this.prisma.academicPeriod.create({ data: periode });
  }

  async desactiverToutesPeriodes(academicYearId: string): Promise<void> {
    await this.prisma.academicPeriod.updateMany({
      where: { academicYearId },
      data: { isCurrent: false },
    });
  }

  async activerPeriode(periodeId: string): Promise<void> {
    await this.prisma.academicPeriod.update({
      where: { id: periodeId },
      data: { isCurrent: true },
    });
  }

  // --- Séquences ---

  async findSequenceById(id: string, schoolId: string): Promise<SequenceAcademiqueProps | null> {
    // AcademicSequence porte un schoolId direct, contrairement à AcademicPeriod.
    const data = await this.prisma.academicSequence.findFirst({ where: { id, schoolId } });
    if (!data) return null;
    return this.sequenceToProps(data);
  }

  async findSequencesByPeriode(academicPeriodId: string): Promise<SequenceAcademiqueProps[]> {
    const data = await this.prisma.academicSequence.findMany({
      where: { academicPeriodId },
      orderBy: { orderIndex: 'asc' },
    });
    return data.map(d => this.sequenceToProps(d));
  }

  async findSequenceCourante(schoolId: string): Promise<SequenceAcademiqueProps | null> {
    const data = await this.prisma.academicSequence.findFirst({
      where: { schoolId, isCurrent: true },
    });
    if (!data) return null;
    return this.sequenceToProps(data);
  }

  async saveSequence(sequence: SequenceAcademiqueProps): Promise<void> {
    await this.prisma.academicSequence.create({ data: sequence });
  }

  async desactiverToutesSequences(academicPeriodId: string): Promise<void> {
    await this.prisma.academicSequence.updateMany({
      where: { academicPeriodId },
      data: { isCurrent: false },
    });
  }

  async activerSequence(sequenceId: string): Promise<void> {
    await this.prisma.academicSequence.update({
      where: { id: sequenceId },
      data: { isCurrent: true },
    });
  }

  // --- Calendrier ---

  async upsertCalendrier(
    academicYearId: string,
    schoolId: string,
    periodes: CalendrierPeriode[]
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const periodeData of periodes) {
        let periodeId: string;

        if (periodeData.id) {
          await tx.academicPeriod.update({
            where: { id: periodeData.id },
            data: {
              name: periodeData.name,
              type: periodeData.type,
              orderIndex: periodeData.orderIndex,
              startDate: periodeData.startDate,
              endDate: periodeData.endDate,
            },
          });
          periodeId = periodeData.id;
        } else {
          const created = await tx.academicPeriod.create({
            data: {
              id: crypto.randomUUID(),
              academicYearId,
              name: periodeData.name,
              type: periodeData.type,
              orderIndex: periodeData.orderIndex,
              startDate: periodeData.startDate,
              endDate: periodeData.endDate,
              isCurrent: false,
            },
          });
          periodeId = created.id;
        }

        for (const seqData of periodeData.sequences) {
          if (seqData.id) {
            await tx.academicSequence.update({
              where: { id: seqData.id },
              data: {
                name: seqData.name,
                type: seqData.type,
                orderIndex: seqData.orderIndex,
                startDate: seqData.startDate,
                endDate: seqData.endDate,
              },
            });
          } else {
            await tx.academicSequence.create({
              data: {
                id: crypto.randomUUID(),
                academicPeriodId: periodeId,
                schoolId,
                name: seqData.name,
                type: seqData.type,
                orderIndex: seqData.orderIndex,
                startDate: seqData.startDate,
                endDate: seqData.endDate,
                isCurrent: false,
              },
            });
          }
        }
      }
    });
  }

  // --- Vérifications pré-clôture ---

  async countNotesNonValidees(academicYearId: string): Promise<number> {
    return this.prisma.grade.count({
      where: {
        academicYearId,
        validationStatus: { notIn: ['LOCKED'] },
      },
    });
  }

  async getClassesAvecBulletinsManquants(
    academicYearId: string
  ): Promise<{ classeId: string; classeNom: string; periodeNom: string }[]> {
    const periodes = await this.prisma.academicPeriod.findMany({
      where: { academicYearId },
      select: { id: true, name: true },
    });

    const classes = await this.prisma.class.findMany({
      where: { grades: { some: { academicYearId } } },
      select: { id: true, name: true },
    });

    const bulletinsGeneres = await this.prisma.reportCard.groupBy({
      by: ['academicPeriodId'],
      where: { academicYearId, isGenerated: true },
      _count: { studentId: true },
    });
    const bulletinsMap = new Map(bulletinsGeneres.map(b => [b.academicPeriodId, b._count.studentId]));

    const resultat: { classeId: string; classeNom: string; periodeNom: string }[] = [];

    for (const classe of classes) {
      const nbEleves = await this.prisma.studentProfile.count({
        where: { enrollmentsYearScoped: { some: { classId: classe.id, status: 'ACTIVE' as const, academicYear: { isCurrent: true } } } },
      });
      if (nbEleves === 0) continue;

      for (const periode of periodes) {
        const nbBulletins = bulletinsMap.get(periode.id) ?? 0;
        if (nbBulletins < nbEleves) {
          resultat.push({
            classeId: classe.id,
            classeNom: classe.name,
            periodeNom: periode.name,
          });
        }
      }
    }

    return resultat;
  }

  async getClassesSansConseilVerrouille(
    academicYearId: string
  ): Promise<{ classeId: string; classeNom: string }[]> {
    const dernierePeriode = await this.findDernierePeriode(academicYearId);
    if (!dernierePeriode) return [];

    const classes = await this.prisma.class.findMany({
      where: { grades: { some: { academicYearId } } },
      select: { id: true, name: true },
    });

    const conseils = await this.prisma.classCouncilSession.findMany({
      where: {
        academicPeriodId: dernierePeriode.id,
        status: 'LOCKED',
      },
      select: { classId: true },
    });
    const classesAvecConseil = new Set(conseils.map(c => c.classId));

    return classes
      .filter(c => !classesAvecConseil.has(c.id))
      .map(c => ({ classeId: c.id, classeNom: c.name }));
  }

  // --- Conversions ---

  private anneeToProps(data: AcademicYear): AnneeAcademiqueProps {
    return {
      id: data.id,
      schoolId: data.schoolId,
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      isCurrent: data.isCurrent,
      status: data.status as AcademicYearStatus,
    };
  }

  private periodeToProps(data: AcademicPeriod): PeriodeAcademiqueProps {
    return {
      id: data.id,
      academicYearId: data.academicYearId,
      name: data.name,
      type: data.type as PeriodType,
      orderIndex: data.orderIndex,
      startDate: data.startDate,
      endDate: data.endDate,
      isCurrent: data.isCurrent,
    };
  }

  private sequenceToProps(data: AcademicSequence): SequenceAcademiqueProps {
    return {
      id: data.id,
      academicPeriodId: data.academicPeriodId,
      schoolId: data.schoolId,
      name: data.name,
      type: data.type as SequenceType,
      orderIndex: data.orderIndex,
      startDate: data.startDate ?? undefined,
      endDate: data.endDate ?? undefined,
      isCurrent: data.isCurrent,
    };
  }
}
