import type { PrismaClient } from '@prisma/client';
import { PrismaProgrammeRepository } from '../../persistence/prisma/PrismaProgrammeRepository';
import { PrismaCahierDeTexteRepository } from '../../persistence/prisma/PrismaCahierDeTexteRepository';
import { PrismaClasseRepository } from '../../persistence/prisma/PrismaClasseRepository';
import { PrismaAnneeAcademiqueRepository } from '../../persistence/prisma/PrismaAnneeAcademiqueRepository';
import { PrismaChapitreAvancementRepository } from '../../persistence/prisma/PrismaChapitreAvancementRepository';
import {
  CalculerProgressionProgrammeUseCase,
  type AlerteRetardProgramme,
} from '@application/pedagogie/CalculerProgressionProgrammeUseCase';

export type { AlerteRetardProgramme };

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
    new PrismaChapitreAvancementRepository(prisma),
  );
  return useCase.calculerAlertesRetardProgramme(schoolId, academicYearId, seuilPct);
}
