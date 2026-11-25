/**
 * Génération complète des notes + observations pour DS1 et DS2
 * - Chaque enseignant remplit les notes de toutes ses classes/matières
 * - Notes réalistes (distribution normale 7–19/20)
 * - Observations automatiques selon le niveau de la note
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const SCHOOL_ID    = 'f91c2219-13ad-465c-979e-41d448612894';
const YEAR_ID      = 'cmqh4od19000cwcy0lmtzkv7k';
const SEQ1_ID      = 'cmqh4od1i000gwcy0nfin4bkw'; // DS1
const SEQ2_ID      = 'cmqh4od1q000iwcy0h1itmpgu'; // DS2

const OBSERVATIONS_BY_RANGE: { min: number; max: number; texts: string[] }[] = [
  { min: 0,  max: 7,  texts: [
    "Résultats très insuffisants. Des efforts sérieux s'imposent.",
    "Travail nettement insuffisant. L'élève doit revoir ses méthodes.",
    "Note très basse. Un soutien est vivement recommandé.",
    "Des lacunes importantes. Beaucoup de travail est nécessaire.",
  ]},
  { min: 7,  max: 10, texts: [
    "Résultats faibles. Peut et doit mieux faire.",
    "Travail insuffisant. Des efforts supplémentaires sont attendus.",
    "L'élève doit s'investir davantage pour progresser.",
    "Résultats en deçà des attentes. Courage !",
  ]},
  { min: 10, max: 12, texts: [
    "Résultats passables. Des progrès sont encore possibles.",
    "Travail moyen. Continuez vos efforts.",
    "Assez bien mais des améliorations sont souhaitées.",
    "L'élève progresse doucement. Persévérez.",
  ]},
  { min: 12, max: 14, texts: [
    "Résultats satisfaisants. Continuez dans cette voie.",
    "Bon travail. Des efforts constants permettront de progresser.",
    "Travail régulier et sérieux. Bravo.",
    "Satisfaisant. L'élève montre de la bonne volonté.",
  ]},
  { min: 14, max: 16, texts: [
    "Bon travail. Résultats encourageants.",
    "Très bien. L'élève est en nette progression.",
    "Travail sérieux et résultats très satisfaisants.",
    "Bon trimestre. Félicitations, continuez ainsi.",
  ]},
  { min: 16, max: 18, texts: [
    "Excellent travail. Bravo !",
    "Très bons résultats. L'élève est à féliciter.",
    "Remarquable. Continuez sur cette lancée.",
    "Très bonne maîtrise de la matière. Félicitations.",
  ]},
  { min: 18, max: 20.1, texts: [
    "Exceptionnel ! L'élève est un exemple à suivre.",
    "Résultats brillants. Toutes nos félicitations.",
    "Parfait. Bravo pour ce travail remarquable.",
    "Excellence absolue. Félicitations chaleureuses.",
  ]},
];

function pickObservation(score: number): string {
  const range = OBSERVATIONS_BY_RANGE.find(r => score >= r.min && score < r.max)
    ?? OBSERVATIONS_BY_RANGE[OBSERVATIONS_BY_RANGE.length - 1]!;
  return range.texts[Math.floor(Math.random() * range.texts.length)]!;
}

function randomScore(): number {
  // Distribution réaliste : concentration autour de 10-14
  const u1 = Math.random(), u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); // Box-Muller
  const score = 12 + z * 3.5; // moyenne=12, écart-type=3.5
  return Math.max(2, Math.min(20, Math.round(score * 10) / 10));
}

async function main() {
  console.log('\n📝 Génération notes + observations — DS1 et DS2\n');

  // Charger toutes les données nécessaires
  const [assignments, studentProfiles, coefficients] = await Promise.all([
    prisma.teachingAssignment.findMany({
      where: { schoolId: SCHOOL_ID },
      select: { teacherId: true, classId: true, subjectId: true },
    }),
    prisma.enrollment.findMany({
      where: { schoolId: SCHOOL_ID, status: 'ACTIVE', academicYear: { isCurrent: true } },
      select: { student: { select: { userId: true } }, classId: true },
    }),
    prisma.subjectCoefficient.findMany({
      where: { schoolId: SCHOOL_ID },
      select: { classLevel: true, serieCode: true, subjectId: true, coefficient: true },
    }),
  ]);

  const classes = await prisma.class.findMany({
    where: { schoolId: SCHOOL_ID },
    select: { id: true, level: true, serie: true, filiere: true },
  });

  // Map classId → subjectId → coefficient
  const CYCLE1 = ['6e','5e','4e','3e'];
  const classSerieCode = new Map<string, string | null>();
  for (const c of classes) {
    let code: string | null = null;
    if (c.serie) code = c.serie;
    else if (c.filiere) code = c.filiere;
    else if (c.level && CYCLE1.includes(c.level)) code = 'FR_GENERAL';
    classSerieCode.set(c.id, code);
  }

  const coeffMap = new Map<string, number>(); // classId|subjectId → coefficient
  for (const c of classes) {
    const serie = classSerieCode.get(c.id) ?? null;
    for (const coeff of coefficients) {
      if (coeff.classLevel === c.level && coeff.serieCode === serie) {
        coeffMap.set(`${c.id}|${coeff.subjectId}`, coeff.coefficient);
      }
    }
  }

  // Index assignments par classId → {subjectId, teacherId}[]
  const assignByClass = new Map<string, { subjectId: string; teacherId: string }[]>();
  for (const a of assignments) {
    if (!assignByClass.has(a.classId)) assignByClass.set(a.classId, []);
    assignByClass.get(a.classId)!.push({ subjectId: a.subjectId, teacherId: a.teacherId });
  }

  // Index students par classId
  const studentsByClass = new Map<string, string[]>();
  for (const sp of studentProfiles) {
    if (!studentsByClass.has(sp.classId)) studentsByClass.set(sp.classId, []);
    studentsByClass.get(sp.classId)!.push(sp.student.userId);
  }

  const SEQUENCES = [SEQ1_ID, SEQ2_ID];

  // Supprimer les notes existantes pour DS1 et DS2
  const deleted = await prisma.grade.deleteMany({
    where: { schoolId: SCHOOL_ID, sequenceId: { in: SEQUENCES } },
  });
  console.log(`   🗑️  ${deleted.count} notes précédentes supprimées`);

  // Chaque élève a un profil de performance stable (légère variation entre séquences)
  // studentId → baseScore (0-1) pour reproduire un niveau cohérent
  const studentLevel = new Map<string, number>();
  for (const [, students] of studentsByClass) {
    for (const sid of students) {
      studentLevel.set(sid, Math.random());
    }
  }

  let totalGrades = 0;
  const BATCH = 1000;
  const gradesToCreate: {
    schoolId: string; studentId: string; subjectId: string; classId: string;
    academicYearId: string; sequenceId: string; sequenceScore: number;
    coefficient: number; maxValue: number; validationStatus: string;
    recordedById: string; observation: string;
  }[] = [];

  const flushIfNeeded = async (force = false) => {
    if (gradesToCreate.length >= BATCH || (force && gradesToCreate.length > 0)) {
      await prisma.grade.createMany({ data: gradesToCreate as any, skipDuplicates: true });
      totalGrades += gradesToCreate.length;
      gradesToCreate.length = 0;
    }
  };

  for (const seqId of SEQUENCES) {
    const seqLabel = seqId === SEQ1_ID ? 'DS1' : 'DS2';
    let seqCount = 0;

    for (const [classId, classAssignments] of assignByClass) {
      const students = studentsByClass.get(classId) ?? [];
      if (students.length === 0) continue;

      for (const student of students) {
        const level = studentLevel.get(student) ?? 0.5;

        for (const { subjectId, teacherId } of classAssignments) {
          // Score cohérent : le niveau de base de l'élève + variation matière
          const subjectVariation = (Math.random() - 0.5) * 4;
          // Légère variation entre DS1 et DS2 (progression ou régression)
          const seqVariation = seqId === SEQ2_ID ? (Math.random() - 0.4) * 2 : 0;
          const rawScore = 5 + level * 14 + subjectVariation + seqVariation;
          const score = Math.max(2, Math.min(20, Math.round(rawScore * 10) / 10));

          const coeff = coeffMap.get(`${classId}|${subjectId}`) ?? 1;
          const obs = pickObservation(score);

          gradesToCreate.push({
            schoolId: SCHOOL_ID,
            studentId: student,
            subjectId,
            classId,
            academicYearId: YEAR_ID,
            sequenceId: seqId,
            sequenceScore: score,
            coefficient: coeff,
            maxValue: 20,
            validationStatus: 'VALIDATED',
            recordedById: teacherId,
            observation: obs,
          });
          seqCount++;

          await flushIfNeeded();
        }
      }
    }

    await flushIfNeeded(true);
    console.log(`   ✓ ${seqLabel} : ${seqCount} notes créées`);
  }

  console.log(`\n✅ Total : ${totalGrades} notes créées avec observations`);

  // Vérification
  const counts = await prisma.grade.groupBy({
    by: ['sequenceId'],
    where: { schoolId: SCHOOL_ID, sequenceId: { in: SEQUENCES } },
    _count: { id: true },
  });
  for (const c of counts) {
    const label = c.sequenceId === SEQ1_ID ? 'DS1' : 'DS2';
    console.log(`   ${label} : ${c._count.id} notes en base`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
