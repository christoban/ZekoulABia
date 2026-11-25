import type { PrismaClient } from '@prisma/client';
import type { ChapitreRepository, ChapitreProps, ChapitreCreateData, ChapitreUpdateData } from '@domain/ports/repositories/ChapitreRepository';

export class PrismaChapitreRepository implements ChapitreRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByIdAndSchool(id: string, schoolId: string): Promise<(ChapitreProps & { programme: { schoolId: string } }) | null> {
    return this.prisma.chapitre.findFirst({ where: { id, programme: { schoolId } }, include: { programme: { select: { schoolId: true } } } });
  }

  async findNextOrdre(programmeId: string): Promise<number> {
    const last = await this.prisma.chapitre.findFirst({ where: { programmeId }, orderBy: { ordre: 'desc' }, select: { ordre: true } });
    return last ? last.ordre + 1 : 1;
  }

  async create(data: ChapitreCreateData): Promise<ChapitreProps> {
    return this.prisma.chapitre.create({ data: { programmeId: data.programmeId, titre: data.titre, ordre: data.ordre, volumeHeuresPrevu: data.volumeHeuresPrevu, sequenceCibleFin: data.sequenceCibleFin } });
  }

  async update(data: ChapitreUpdateData): Promise<ChapitreProps> {
    return this.prisma.chapitre.update({
      where: { id: data.id },
      data: { ...(data.titre !== undefined && { titre: data.titre }), ...(data.ordre !== undefined && { ordre: data.ordre }), ...(data.volumeHeuresPrevu !== undefined && { volumeHeuresPrevu: data.volumeHeuresPrevu }), ...(data.sequenceCibleFin !== undefined && { sequenceCibleFin: data.sequenceCibleFin }) },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.chapitre.delete({ where: { id } });
  }
}
