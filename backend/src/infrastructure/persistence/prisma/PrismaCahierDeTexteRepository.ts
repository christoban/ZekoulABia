import type { PrismaClient } from '@prisma/client';
import type {
  CahierDeTexteRepository,
  CahierDeTexteProps,
  CahierDeTexteCreateData,
  CahierDeTexteFilters,
  RapportCahierEntry,
  RapportFilters,
} from '@domain/ports/repositories/CahierDeTexteRepository';

export class PrismaCahierDeTexteRepository implements CahierDeTexteRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByFilters(schoolId: string, filters: CahierDeTexteFilters): Promise<CahierDeTexteProps[]> {
    return this.prisma.cahierDeTexte.findMany({
      where: {
        schoolId,
        ...(filters.classId && { classId: filters.classId }),
        ...(filters.enseignantId && { teacherId: filters.enseignantId }),
        ...(filters.subjectId && { subjectId: filters.subjectId }),
        ...(filters.academicYearId && { academicYearId: filters.academicYearId }),
        ...(filters.since ? { createdAt: { gt: filters.since } } : {}),
        ...(filters.depuis || filters.jusqua ? { date: { ...(filters.depuis && { gte: filters.depuis }), ...(filters.jusqua && { lte: filters.jusqua }) } } : {}),
      },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true } },
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
        academicYear: { select: { id: true, name: true } },
      },
      orderBy: { date: filters.orderDate ?? 'desc' },
      ...(filters.take ? { take: filters.take } : {}),
    });
  }

  async create(data: CahierDeTexteCreateData): Promise<CahierDeTexteProps> {
    return this.prisma.cahierDeTexte.create({
      data: { schoolId: data.schoolId, teacherId: data.teacherId, classId: data.classId, subjectId: data.subjectId, academicYearId: data.academicYearId, chapitreId: data.chapitreId, contenuRealise: data.contenuRealise, contenuLibre: data.contenuLibre, devoirsDonnes: data.devoirsDonnes, date: data.date },
    });
  }

  async findForRapport(schoolId: string, filters: RapportFilters): Promise<RapportCahierEntry[]> {
    return this.prisma.cahierDeTexte.findMany({
      where: {
        schoolId,
        ...(filters.academicYearId && { academicYearId: filters.academicYearId }),
        ...(filters.teacherId && { teacherId: filters.teacherId }),
        ...(filters.classId && { classId: filters.classId }),
        ...(filters.subjectIds?.length ? { subjectId: { in: filters.subjectIds } } : {}),
      },
      include: { teacher: { select: { id: true, firstName: true, lastName: true } }, class: { select: { id: true, name: true } }, subject: { select: { id: true, name: true, code: true } } },
      orderBy: { date: 'asc' },
    });
  }
}
