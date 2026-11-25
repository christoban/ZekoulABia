/**
 * Seed Trimestre 1 : DS1 + DS2 VALIDATED pour toutes les classes
 * + Conseils de classe LOCKED
 */
const { PrismaClient } = require('./node_modules/@prisma/client');
const p = new PrismaClient({ log: ['error'] });

const SCHOOL_ID    = 'f91c2219-13ad-465c-979e-41d448612894';
const YEAR_ID      = 'cmqh4od19000cwcy0lmtzkv7k';
const PERIOD_T1_ID = 'cmqh4od1d000ewcy0yj02898w';
const DS1_ID       = 'cmqh4od1i000gwcy0nfin4bkw';
const DS2_ID       = 'cmqh4od1q000iwcy0h1itmpgu';
const STAFF_ID     = '031bf2de-8825-4a07-8ee7-c59e492909aa'; // censeur
const ADMIN_ID     = 'cmqh4h2ze0009wcy002rtrkod';

// Note aléatoire réaliste entre 8 et 18
function note() {
  return Math.round((8 + Math.random() * 10) * 10) / 10;
}

function cuid() {
  // fallback: generate a simple unique id
  return 'cm' + Math.random().toString(36).slice(2, 16) + Date.now().toString(36);
}

async function run() {
  console.log('=== Seed Trimestre 1 ===\n');

  // 1. Récupérer toutes les classes
  const classes = await p.class.findMany({
    where: { schoolId: SCHOOL_ID },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  console.log(`${classes.length} classes trouvées`);

  // 2. SubjectCoefficient par niveau/série (pas par classId)
  // On récupère tout et on mappe via classLevel+serieCode si besoin
  // mais on utilise surtout le coefficient direct de la matière via TeachingAssignment

  let totalNotes = 0;
  let totalConseils = 0;
  let skippedClasses = 0;

  for (const cls of classes) {
    // 3. Élèves de la classe
    const students = await p.enrollment.findMany({
      where: { classId: cls.id, status: 'ACTIVE', academicYear: { isCurrent: true } },
      select: { student: { select: { userId: true } } },
    }).then(rows => rows.map(r => r.student));
    if (students.length === 0) {
      skippedClasses++;
      continue;
    }

    // 4. Matières affectées à cette classe (via TeachingAssignment)
    const assignments = await p.teachingAssignment.findMany({
      where: { classId: cls.id, schoolId: SCHOOL_ID },
      select: { subjectId: true, subject: { select: { coefficient: true } } },
    });

    if (assignments.length === 0) {
      skippedClasses++;
      console.log(`  SKIP ${cls.name} — aucune affectation matière`);
      continue;
    }

    // 5. Supprimer notes T1 existantes pour cette classe (si relance)
    await p.grade.deleteMany({
      where: {
        schoolId: SCHOOL_ID,
        classId: cls.id,
        sequenceId: { in: [DS1_ID, DS2_ID] },
      },
    });

    // 6. Construire le batch de notes
    const gradesBatch = [];
    for (const student of students) {
      for (const a of assignments) {
        const coeff = a.subject.coefficient ?? 1;
        for (const seqId of [DS1_ID, DS2_ID]) {
          const score = note();
          gradesBatch.push({
            id: cuid(),
            schoolId: SCHOOL_ID,
            studentId: student.userId,
            subjectId: a.subjectId,
            classId: cls.id,
            academicYearId: YEAR_ID,
            sequenceId: seqId,
            sequenceScore: score,
            coefficient: coeff,
            maxValue: 20,
            sequenceAverage: score,
            validationStatus: 'VALIDATED',
            validatedById: STAFF_ID,
            validatedAt: new Date(),
            recordedById: ADMIN_ID,
            observation: '',
          });
        }
      }
    }

    // createMany par lots de 500
    for (let i = 0; i < gradesBatch.length; i += 500) {
      await p.grade.createMany({
        data: gradesBatch.slice(i, i + 500),
        skipDuplicates: true,
      });
    }
    totalNotes += gradesBatch.length;

    // 7. Supprimer ancien conseil T1 si existe
    await p.classCouncilSession.deleteMany({
      where: { classId: cls.id, academicPeriodId: PERIOD_T1_ID },
    });

    // 8. Créer et verrouiller le conseil de classe T1
    await p.classCouncilSession.create({
      data: {
        id: cuid(),
        schoolId: SCHOOL_ID,
        classId: cls.id,
        academicPeriodId: PERIOD_T1_ID,
        presidedById: STAFF_ID,
        status: 'LOCKED',
        validatedAt: new Date(),
      },
    });
    totalConseils++;

    console.log(`  ✓ ${cls.name.padEnd(25)} ${students.length} élèves × ${assignments.length} matières × 2 seq = ${gradesBatch.length} notes`);
  }

  console.log(`\n✅ Terminé !`);
  console.log(`   Notes créées     : ${totalNotes}`);
  console.log(`   Conseils verrouillés : ${totalConseils}`);
  console.log(`   Classes sans affectation : ${skippedClasses}`);
  console.log(`\nTu peux maintenant générer les bulletins depuis le dashboard Admin.`);
}

run().catch(console.error).finally(() => p.$disconnect());
