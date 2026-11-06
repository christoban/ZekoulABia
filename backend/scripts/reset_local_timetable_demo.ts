import { PrismaClient } from '@prisma/client';

const SCHOOL_ID = '19f9d4de-715c-4e8a-8672-cefd84ce806d'; // Lycée de Bafia

async function main() {
  console.log('🔄 Nettoyage de la base locale pour la démo Emplois du Temps & Affectations...');
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL est absent. Définissez-la dans l’environnement avant de lancer ce script.',
    );
  }
  const prisma = new PrismaClient();

  try {
    const school = await prisma.school.findUnique({
      where: { id: SCHOOL_ID },
      select: { id: true, name: true },
    });

    if (!school) {
      throw new Error(`École avec l'ID ${SCHOOL_ID} introuvable en local !`);
    }

    console.log(`École ciblée : ${school.name} (${school.id})`);

    // 1. Supprimer les créneaux d'emploi du temps
    const deletedSlots = await prisma.timetableSlot.deleteMany({
      where: {
        timetable: {
          schoolId: SCHOOL_ID,
        },
      },
    });
    console.log(`✅ ${deletedSlots.count} créneaux d'emploi du temps (TimetableSlot) supprimés.`);

    // 2. Supprimer les emplois du temps
    const deletedTimetables = await prisma.timetable.deleteMany({
      where: { schoolId: SCHOOL_ID },
    });
    console.log(`✅ ${deletedTimetables.count} emplois du temps (Timetable) supprimés.`);

    // 3. Supprimer les affectations d'enseignants
    const deletedAssignments = await prisma.teachingAssignment.deleteMany({
      where: { schoolId: SCHOOL_ID },
    });
    console.log(`✅ ${deletedAssignments.count} affectations d'enseignants (TeachingAssignment) supprimées.`);

    // 4. Supprimer notes et bulletins éventuels en local s'il en existe
    const deletedReportCardLines = await prisma.reportCardSubjectLine.deleteMany({
      where: { reportCard: { schoolId: SCHOOL_ID } },
    });
    const deletedReportCards = await prisma.reportCard.deleteMany({
      where: { schoolId: SCHOOL_ID },
    });
    const deletedCouncilDecisions = await prisma.classCouncilDecision.deleteMany({
      where: { session: { schoolId: SCHOOL_ID } },
    });
    const deletedCouncilSessions = await prisma.classCouncilSession.deleteMany({
      where: { schoolId: SCHOOL_ID },
    });
    const deletedBulletinSessions = await prisma.bulletinValidationSession.deleteMany({
      where: { schoolId: SCHOOL_ID },
    });
    const deletedGrades = await prisma.grade.deleteMany({
      where: { schoolId: SCHOOL_ID },
    });
    const deletedAttendances = await prisma.attendance.deleteMany({
      where: { schoolId: SCHOOL_ID },
    });

    console.log(`✅ Données académiques locales nettoyées :`);
    console.log(`   - Notes supprimées : ${deletedGrades.count}`);
    console.log(`   - Bulletins supprimés : ${deletedReportCards.count}`);
    console.log(`   - Conseils de classe supprimés : ${deletedCouncilSessions.count}`);
    console.log(`   - Présences supprimées : ${deletedAttendances.count}`);

    // Vérification finale de l'état de l'école
    const remainingClasses = await prisma.class.count({ where: { schoolId: SCHOOL_ID } });
    const remainingTeachers = await prisma.user.count({ where: { schoolId: SCHOOL_ID, role: 'TEACHER' } });
    const remainingStudents = await prisma.enrollment.count({ where: { schoolId: SCHOOL_ID, status: 'ACTIVE' } });
    const remainingSubjects = await prisma.subject.count({ where: { schoolId: SCHOOL_ID } });

    console.log('\n📊 État final de la base locale pour le Lycée de Bafia :');
    console.log(`   - Classes prêtes : ${remainingClasses}`);
    console.log(`   - Enseignants disponibles : ${remainingTeachers}`);
    console.log(`   - Élèves inscrits : ${remainingStudents}`);
    console.log(`   - Matières configurées : ${remainingSubjects}`);
    console.log(`   - Affectations : 0 (prêt pour la génération/affectation live)`);
    console.log(`   - Emplois du temps : 0 (prêt pour la génération live)`);

  } catch (error) {
    console.error('❌ Erreur lors du nettoyage local :', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
