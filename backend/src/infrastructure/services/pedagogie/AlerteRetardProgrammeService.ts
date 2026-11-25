import type { PrismaClient } from '@prisma/client';
import { PrismaProgrammeRepository } from '../../persistence/prisma/PrismaProgrammeRepository';
import { PrismaCahierDeTexteRepository } from '../../persistence/prisma/PrismaCahierDeTexteRepository';
import { PrismaClasseRepository } from '../../persistence/prisma/PrismaClasseRepository';
import { PrismaAnneeAcademiqueRepository } from '../../persistence/prisma/PrismaAnneeAcademiqueRepository';
import { CalculerProgressionProgrammeUseCase } from '@application/pedagogie/CalculerProgressionProgrammeUseCase';

export interface AlerteRetardProgramme {
  programmeId: string;
  programmeTitre: string;
  subjectName: string;
  className: string;
  classId: string;
  chapitresTotal: number;
  chapitresRealises: number;
  progressionPct: number;
  attenduPct: number;
  retardPct: number;
  niveau: 'CRITIQUE' | 'MODERE';
}

export async function calculerAlertesRetardProgramme(
  prisma: PrismaClient,
  schoolId: string,
  academicYearId?: string,
  seuilPct = 15,
): Promise<AlerteRetardProgramme[]> {
  const useCase = new CalculerProgressionProgrammeUseCase(
    new PrismaProgrammeRepository(prisma),
    new PrismaCahierDeTexteRepository(prisma),
    new PrismaClasseRepository(prisma),
    new PrismaAnneeAcademiqueRepository(prisma),
  );
  return useCase.calculerAlertesRetardProgramme(schoolId, academicYearId, seuilPct);
}
