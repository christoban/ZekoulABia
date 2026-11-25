import { PrismaClient } from '@prisma/client';
import { PrismaTeachingAssignmentGeneratorRepository } from '../src/infrastructure/persistence/prisma/PrismaTeachingAssignmentGeneratorRepository';
import { GenererAffectationsUseCase } from '../src/application/teachingAssignment/GenererAffectationsUseCase';

const prisma = new PrismaClient();
const SCHOOL_ID = '19f9d4de-715c-4e8a-8672-cefd84ce806d'; // Lycée de Bafia

async function main() {
  console.log('🚀 Génération des affectations pour le Lycée de Bafia...');

  const ay = await prisma.academicYear.findFirst({
    where: { schoolId: SCHOOL_ID, isCurrent: true },
    select: { id: true, name: true },
  });
  if (!ay) throw new Error('Année courante introuvable !');

  const repo = new PrismaTeachingAssignmentGeneratorRepository(prisma);
  const uc = new GenererAffectationsUseCase(repo);

  const resultat = await uc.execute({
    schoolId: SCHOOL_ID,
    academicYearId: ay.id,
    rebalanceExisting: true,
  });

  console.log(`✅ Affectations créées : ${resultat.createdCount}`);
  console.log(`✅ Affectations rééquilibrées : ${resultat.rebalancedCount}`);
  console.log(`⚠️ Matières non résolues : ${resultat.nonResolus.length}`);
  if (resultat.nonResolus.length > 0) {
    console.log(resultat.nonResolus.map(n => `${n.className} - ${n.subjectName}: ${n.raison}`).join('\n'));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
