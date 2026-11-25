/**
 * Script d'enrichissement de la base locale pour le Lycée de Bafia
 * - Présences S1 et S2 pour tous les 120 élèves
 * - Notes S1 et S2 verrouillées pour toutes les 12 classes et 120 élèves
 * - Conseils de classe verrouillés et décisions individuelles
 * - Bulletins générés, enrichis par l'IA (aiComment) et mot du PP, et PUBLIÉS
 * - ZÉRO blocage, idempotent.
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const SCHOOL_ID = '19f9d4de-715c-4e8a-8672-cefd84ce806d';

const OBSERVATIONS_NOTES: { min: number; max: number; texts: string[] }[] = [
  { min: 0, max: 8, texts: [
    "Résultats très insuffisants. Des efforts sérieux et un encadrement soutenu s'imposent.",
    "Bases non acquises. L'élève doit reprendre méthodiquement les leçons.",
    "Difficultés manifestes. Nécessite un soutien actif pour combler les lacunes.",
  ]},
  { min: 8, max: 10, texts: [
    "Résultats encore fragiles. Doit s'investir davantage pour atteindre la moyenne.",
    "Travail irrégulier. Des capacités existent, intensifiez les révisions.",
    "Proche de la moyenne. Ne relâchez pas l'effort.",
  ]},
  { min: 10, max: 12, texts: [
    "Résultats passables. Travail convenable mais perfectible.",
    "Ensemble moyen. Maintenez vos efforts pour progresser au second trimestre.",
    "Notions comprises dans l'ensemble. Approfondissez les exercices d'application.",
  ]},
  { min: 12, max: 14, texts: [
    "Bon travail. Des résultats satisfaisants et réguliers.",
    "Résultats encourageants. Poursuivez dans cette dynamique positive.",
    "Élève sérieux et attentif. Bon niveau d'assimilation.",
  ]},
  { min: 14, max: 16, texts: [
    "Très bon travail. Notions très bien maîtrisées.",
    "Travail rigoureux et résultats solides. Félicitations pour cette constance.",
    "Excellente participation et compréhension approfondie du programme.",
  ]},
  { min: 16, max: 20.1, texts: [
    "Excellent trimestre. Travail remarquable et grande autonomie.",
    "Performances exceptionnelles. Élève brillant et moteur pour la classe.",
    "Parfaite maîtrise des compétences requises. Toutes nos félicitations.",
  ]},
];

function pickNoteObservation(score: number): string {
  const range = OBSERVATIONS_NOTES.find(r => score >= r.min && score < r.max) ?? OBSERVATIONS_NOTES[OBSERVATIONS_NOTES.length - 1]!;
  return range.texts[Math.floor(Math.random() * range.texts.length)]!;
}

function generateAiComment(studentName: string, avg: number, rank: number, total: number, strengths: string[], weaknesses: string[]): string {
  const strengthsStr = strengths.length > 0 ? strengths.slice(0, 2).join(' et ') : 'l\'ensemble des disciplines';
  const weaknessesStr = weaknesses.length > 0 ? weaknesses.slice(0, 2).join(' et ') : 'les matières scientifiques';

  if (avg >= 16) {
    return `Excellente performance globale pour ${studentName} qui se classe ${rank}e/${total} avec une remarquable moyenne de ${avg.toFixed(2)}/20. L'élève démontre une maturité intellectuelle et une rigueur exemplaire, particulièrement en ${strengthsStr}. Félicitations chaleureuses du corps professoral, maintenez ce haut niveau d'exigence.`;
  } else if (avg >= 14) {
    return `Très bon trimestre pour ${studentName} (${rank}e/${total}, moyenne ${avg.toFixed(2)}/20). Les acquis sont solides et valorisés par de très bons résultats en ${strengthsStr}. En intensifiant la rigueur en ${weaknessesStr}, l'élève a le potentiel pour intégrer le peloton de tête. Continuez ainsi !`;
  } else if (avg >= 12) {
    return `Bilan trimestriel satisfaisant pour ${studentName} (${rank}e/${total}, moyenne ${avg.toFixed(2)}/20). L'attitude en classe est constructive et les résultats en ${strengthsStr} sont encourageants. Un travail plus soutenu et régulier en ${weaknessesStr} permettra de franchir un cap au second trimestre.`;
  } else if (avg >= 10) {
    return `Trimestre convenable pour ${studentName} qui obtient la moyenne (${avg.toFixed(2)}/20, ${rank}e/${total}). L'élève possède des capacités certaines comme en témoignent ses scores en ${strengthsStr}, mais des lacunes subsistent en ${weaknessesStr}. Une méthodologie plus rigoureuse et une concentration accrue sont attendues.`;
  } else {
    return `Résultats en deçà des exigences académiques pour ${studentName} (${avg.toFixed(2)}/20, ${rank}e/${total}). Malgré des prédispositions perceptibles en ${strengthsStr}, des difficultés substantielles en ${weaknessesStr} pénalisent la moyenne. Un sursaut impératif, un travail quotidien et un encadrement ciblé sont recommandés dès la rentrée.`;
  }
}

function generatePpComment(avg: number): string {
  if (avg >= 16) return "Trimestre exceptionnel. Félicitations du conseil et encouragements vifs pour le concours !";
  if (avg >= 14) return "Très bon travail d'ensemble. Élève travailleur et sérieux. Continuez ainsi.";
  if (avg >= 12) return "Bon travail. Les bases sont acquises. Poursuivez vos efforts avec régularité.";
  if (avg >= 10) return "Ensemble passable. Vous pouvez nettement mieux faire en intensifiant votre travail personnel.";
  return "Trimestre insuffisant. Réaction énergique et travail méthodique indispensables au 2ème trimestre.";
}

async function main() {
  console.log('🚀 Démarrage de l\'enrichissement sur la base locale (Lycée de Bafia)...\n');
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL est absent. Définissez-la dans l’environnement avant de lancer ce script.',
    );
  }
  const prisma = new PrismaClient();

  try {
    // 1. Charger l'école et les métadonnées
    const school = await prisma.school.findUnique({
      where: { id: SCHOOL_ID },
      select: { id: true, name: true },
    });
    if (!school) throw new Error('Lycée de Bafia introuvable en local !');

    const ay = await prisma.academicYear.findFirst({
      where: { schoolId: SCHOOL_ID, isCurrent: true },
      select: { id: true, name: true },
    });
    if (!ay) throw new Error('Année académique courante introuvable !');

    const period1 = await prisma.academicPeriod.findFirst({
      where: { academicYearId: ay.id, orderIndex: 1 },
      select: { id: true, name: true },
    });
    if (!period1) throw new Error('Trimestre 1 introuvable !');

    const seqs = await prisma.academicSequence.findMany({
      where: { academicPeriodId: period1.id },
      orderBy: { orderIndex: 'asc' },
      select: { id: true, name: true, orderIndex: true },
    });
    const seq1 = seqs.find(s => s.orderIndex === 1);
    const seq2 = seqs.find(s => s.orderIndex === 2);
    if (!seq1 || !seq2) throw new Error('Séquences 1 et 2 introuvables !');

    console.log(`📌 Établissement : ${school.name}`);
    console.log(`📌 Année : ${ay.name} | Période : ${period1.name}`);
    console.log(`📌 Séquences : ${seq1.name} & ${seq2.name}`);

    const validatorId = '449fa672-5d0b-433b-9936-4170e4fbd85e'; // Christophe Ndzana (Staff/Admin)

    // Charger les classes, élèves et affectations
    const classes = await prisma.class.findMany({
      where: { schoolId: SCHOOL_ID },
      include: {
        enrollments: {
          where: { status: 'ACTIVE' },
          include: {
            student: {
              select: {
                userId: true,
                user: { select: { id: true, firstName: true, lastName: true } },
              },
            },
          },
        },
        teachingAssignments: {
          include: { subject: { select: { id: true, name: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });

    console.log(`📌 ${classes.length} classes chargées.`);

    // Coefficients
    const coeffRows = await prisma.subjectCoefficient.findMany({
      where: { schoolId: SCHOOL_ID },
      select: { classLevel: true, subjectId: true, coefficient: true },
    });
    const coeffMap = new Map<string, number>();
    for (const c of coeffRows) {
      if (c.classLevel && c.subjectId) coeffMap.set(`${c.classLevel}:${c.subjectId}`, c.coefficient);
    }

    // ─────────────────────────────────────────────────────────────
    // ÉTAPE 1 : PRÉSENCES (ATTENDANCE) POUR LES 120 ÉLÈVES
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 1. Préparation des présences (15 jours ouvrés) ---');
    const schoolDays = [
      new Date('2026-09-28T07:30:00Z'), new Date('2026-09-29T07:30:00Z'), new Date('2026-09-30T07:30:00Z'),
      new Date('2026-10-01T07:30:00Z'), new Date('2026-10-02T07:30:00Z'), new Date('2026-10-05T07:30:00Z'),
      new Date('2026-10-06T07:30:00Z'), new Date('2026-10-07T07:30:00Z'), new Date('2026-10-08T07:30:00Z'),
      new Date('2026-10-09T07:30:00Z'), new Date('2026-10-12T07:30:00Z'), new Date('2026-10-13T07:30:00Z'),
      new Date('2026-10-14T07:30:00Z'), new Date('2026-10-15T07:30:00Z'), new Date('2026-10-16T07:30:00Z'),
    ];

    const existingAttendancesCount = await prisma.attendance.count({ where: { schoolId: SCHOOL_ID } });
    const absencesPerStudent = new Map<string, number>();

    if (existingAttendancesCount === 0) {
      const attendancesToInsert: any[] = [];
      for (const cls of classes) {
        for (const enr of cls.enrollments) {
          const studentId = enr.student.userId;
          const hash = studentId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
          const diligence = 0.88 + (hash % 12) / 100;
          let studentAbs = 0;

          for (const date of schoolDays) {
            const r = Math.random();
            let status: 'PRESENT' | 'ABSENT' | 'LATE' | 'ABSENT_JUSTIFIED' = 'PRESENT';
            let justification: string | null = null;

            if (r > diligence) {
              const sr = Math.random();
              if (sr < 0.45) {
                status = 'LATE';
                justification = 'Retard matinal (15 min) - Problème de transport';
              } else if (sr < 0.8) {
                status = 'ABSENT';
                studentAbs++;
              } else {
                status = 'ABSENT_JUSTIFIED';
                justification = 'Certificat médical / Motif familial';
                studentAbs++;
              }
            }

            attendancesToInsert.push({
              id: randomUUID(),
              schoolId: SCHOOL_ID,
              studentId,
              classId: cls.id,
              academicPeriodId: period1.id,
              date,
              period: 'MORNING',
              status,
              justification,
              recordedById: validatorId,
              isOfflineSync: false,
              createdAt: new Date(),
            });
          }
          absencesPerStudent.set(studentId, studentAbs);
        }
      }

      console.log(`   Insertion de ${attendancesToInsert.length} présences...`);
      const resAtt = await prisma.attendance.createMany({ data: attendancesToInsert, skipDuplicates: true });
      console.log(`   ✅ ${resAtt.count} fiches de présence insérées.`);
    } else {
      console.log(`   ℹ️ ${existingAttendancesCount} présences déjà existantes.`);
      const atts = await prisma.attendance.findMany({
        where: { schoolId: SCHOOL_ID, status: { in: ['ABSENT', 'ABSENT_JUSTIFIED'] } },
        select: { studentId: true },
      });
      for (const a of atts) {
        absencesPerStudent.set(a.studentId, (absencesPerStudent.get(a.studentId) || 0) + 1);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // ÉTAPE 2 : NOTES S1 ET S2 POUR TOUTES LES CLASSES
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 2. Préparation des notes S1 et S2 ---');
    const existingGrades = await prisma.grade.findMany({
      where: { schoolId: SCHOOL_ID },
      select: { studentId: true, subjectId: true, sequenceId: true, sequenceScore: true, coefficient: true },
    });

    const existingGradeKey = new Set<string>();
    const gradeValuesMap = new Map<string, { s1?: number; s2?: number; coeff?: number }>();

    for (const g of existingGrades) {
      existingGradeKey.add(`${g.studentId}:${g.subjectId}:${g.sequenceId}`);
      const pairKey = `${g.studentId}:${g.subjectId}`;
      const cur = gradeValuesMap.get(pairKey) || {};
      if (g.sequenceId === seq1.id) cur.s1 = g.sequenceScore ?? undefined;
      if (g.sequenceId === seq2.id) cur.s2 = g.sequenceScore ?? undefined;
      cur.coeff = g.coefficient;
      gradeValuesMap.set(pairKey, cur);
    }

    const gradesToInsert: any[] = [];

    for (const cls of classes) {
      const level = cls.level || cls.name.split(' ')[0] || '6e';

      for (const enr of cls.enrollments) {
        const studentId = enr.student.userId;
        const studentHash = studentId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const intrinsicAvg = 9.5 + (studentHash % 75) / 10; // 9.5 à 17.0

        for (const ta of cls.teachingAssignments) {
          const subjectId = ta.subjectId;
          const teacherId = ta.teacherId;
          const coeff = coeffMap.get(`${level}:${subjectId}`) ?? coeffMap.get(`3e:${subjectId}`) ?? 2;

          const key1 = `${studentId}:${subjectId}:${seq1.id}`;
          const key2 = `${studentId}:${subjectId}:${seq2.id}`;
          const pairKey = `${studentId}:${subjectId}`;

          let s1 = gradeValuesMap.get(pairKey)?.s1;
          let s2 = gradeValuesMap.get(pairKey)?.s2;

          if (!existingGradeKey.has(key1)) {
            const subHash = subjectId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
            const varSub = ((subHash % 7) - 3) * 0.5;
            s1 = Math.max(5.5, Math.min(19.5, Math.round((intrinsicAvg + varSub + (Math.random() * 2 - 1)) * 2) / 2));

            gradesToInsert.push({
              id: randomUUID(),
              schoolId: SCHOOL_ID,
              studentId,
              subjectId,
              classId: cls.id,
              academicYearId: ay.id,
              sequenceId: seq1.id,
              sequenceScore: s1,
              coefficient: coeff,
              sequenceAverage: s1,
              maxValue: 20,
              validationStatus: 'LOCKED',
              validatedById: validatorId,
              validatedAt: new Date('2026-10-04T10:00:00Z'),
              recordedById: teacherId,
              observation: pickNoteObservation(s1),
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          if (!existingGradeKey.has(key2)) {
            const progress = (Math.random() * 2.0 - 0.9);
            const base = s1 ?? intrinsicAvg;
            s2 = Math.max(5.0, Math.min(19.5, Math.round((base + progress) * 2) / 2));

            gradesToInsert.push({
              id: randomUUID(),
              schoolId: SCHOOL_ID,
              studentId,
              subjectId,
              classId: cls.id,
              academicYearId: ay.id,
              sequenceId: seq2.id,
              sequenceScore: s2,
              coefficient: coeff,
              sequenceAverage: s2,
              maxValue: 20,
              validationStatus: 'LOCKED',
              validatedById: validatorId,
              validatedAt: new Date('2026-10-06T10:00:00Z'),
              recordedById: teacherId,
              observation: pickNoteObservation(s2),
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          gradeValuesMap.set(pairKey, { s1, s2, coeff });
        }
      }
    }

    if (gradesToInsert.length > 0) {
      console.log(`   Insertion de ${gradesToInsert.length} nouvelles notes...`);
      // Blocs de 500 pour Postgres
      for (let i = 0; i < gradesToInsert.length; i += 500) {
        const chunk = gradesToInsert.slice(i, i + 500);
        await prisma.grade.createMany({ data: chunk, skipDuplicates: true });
      }
      console.log(`   ✅ ${gradesToInsert.length} notes créées et verrouillées.`);
    } else {
      console.log(`   ℹ️ Toutes les notes sont déjà présentes.`);
    }

    // ─────────────────────────────────────────────────────────────
    // ÉTAPE 3 : BULLETINS & LIGNES DE MATIÈRES POUR LES 12 CLASSES
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 3. Calcul, Génération IA et Publication des Bulletins ---');

    const existingReports = await prisma.reportCard.findMany({
      where: { schoolId: SCHOOL_ID, academicPeriodId: period1.id },
      select: { id: true, studentId: true },
    });
    const existingReportMap = new Map<string, string>();
    for (const r of existingReports) existingReportMap.set(r.studentId, r.id);

    const reportCardsToInsert: any[] = [];
    const subjectLinesToInsert: any[] = [];
    const reportCardsToUpdate: any[] = [];

    const councilSessionsToUpsert: any[] = [];
    const councilDecisionsToInsert: any[] = [];
    const bulletinSessionsToUpsert: any[] = [];

    for (const cls of classes) {
      const studentMetrics: Array<{
        studentId: string;
        studentName: string;
        generalAverage: number;
        absenceCount: number;
        subjectLines: Array<{
          subjectId: string;
          subjectName: string;
          coefficient: number;
          seq1Score: number;
          seq2Score: number;
          subjectAverage: number;
          weightedScore: number;
          teacherComment: string;
        }>;
      }> = [];

      for (const enr of cls.enrollments) {
        const studentId = enr.student.userId;
        const studentUser = enr.student.user;
        const studentName = `${studentUser?.firstName ?? ''} ${studentUser?.lastName ?? ''}`.trim() || 'Élève';
        const abs = absencesPerStudent.get(studentId) || 0;

        let totalWeighted = 0;
        let totalCoeff = 0;
        const subLines: typeof studentMetrics[0]['subjectLines'] = [];

        for (const ta of cls.teachingAssignments) {
          const pairKey = `${studentId}:${ta.subjectId}`;
          const gData = gradeValuesMap.get(pairKey) || { s1: 10, s2: 10, coeff: 2 };
          const s1 = gData.s1 ?? 10;
          const s2 = gData.s2 ?? s1;
          const coeff = gData.coeff ?? 2;
          const avg = Math.round(((s1 + s2) / 2) * 100) / 100;
          const weighted = Math.round(avg * coeff * 100) / 100;

          totalWeighted += weighted;
          totalCoeff += coeff;

          subLines.push({
            subjectId: ta.subjectId,
            subjectName: ta.subject.name,
            coefficient: coeff,
            seq1Score: s1,
            seq2Score: s2,
            subjectAverage: avg,
            weightedScore: weighted,
            teacherComment: pickNoteObservation(avg),
          });
        }

        const genAvg = totalCoeff > 0 ? Math.round((totalWeighted / totalCoeff) * 100) / 100 : 10;

        studentMetrics.push({
          studentId,
          studentName,
          generalAverage: genAvg,
          absenceCount: abs,
          subjectLines: subLines,
        });
      }

      // Classement
      studentMetrics.sort((a, b) => b.generalAverage - a.generalAverage);
      const totalStudents = studentMetrics.length;

      // Session conseil de classe
      const councilSessionId = randomUUID();
      councilSessionsToUpsert.push({
        id: councilSessionId,
        schoolId: SCHOOL_ID,
        classId: cls.id,
        academicPeriodId: period1.id,
        presidedById: validatorId,
        status: 'LOCKED',
        validatedAt: new Date('2026-10-06T16:00:00Z'),
        createdAt: new Date(),
      });

      // Session bulletin
      bulletinSessionsToUpsert.push({
        id: randomUUID(),
        schoolId: SCHOOL_ID,
        classId: cls.id,
        academicPeriodId: period1.id,
        status: 'PUBLISHED',
        submittedById: validatorId,
        validatedById: validatorId,
        submittedAt: new Date('2026-10-06T14:00:00Z'),
        validatedAt: new Date('2026-10-07T09:00:00Z'),
        publishedAt: new Date('2026-10-07T10:00:00Z'),
      });

      for (let i = 0; i < studentMetrics.length; i++) {
        const sm = studentMetrics[i]!;
        const rank = i + 1;

        let mention = 'Insuffisant';
        if (sm.generalAverage >= 16) mention = 'Très Bien';
        else if (sm.generalAverage >= 14) mention = 'Bien';
        else if (sm.generalAverage >= 12) mention = 'Assez Bien';
        else if (sm.generalAverage >= 10) mention = 'Passable';

        const strengths = sm.subjectLines.filter(s => s.subjectAverage >= 13.5).map(s => s.subjectName);
        const weaknesses = sm.subjectLines.filter(s => s.subjectAverage < 10.5).map(s => s.subjectName);

        const aiComment = generateAiComment(sm.studentName, sm.generalAverage, rank, totalStudents, strengths, weaknesses);
        const ppComment = generatePpComment(sm.generalAverage);

        let dec: 'PASS' | 'REPEAT' | 'DELIBERATION' = 'PASS';
        let decObs = 'Admis en classe supérieure avec les félicitations du conseil.';
        if (sm.generalAverage >= 14) {
          dec = 'PASS';
          decObs = 'Félicitations du conseil de classe pour ce remarquable trimestre.';
        } else if (sm.generalAverage >= 12) {
          dec = 'PASS';
          decObs = 'Tableau d\'honneur du conseil de classe. Bon travail.';
        } else if (sm.generalAverage >= 10) {
          dec = 'PASS';
          decObs = 'Encouragements du conseil de classe. Poursuivez vos efforts.';
        } else {
          dec = 'DELIBERATION';
          decObs = 'Avertissement travail. Mobilisation impérative au 2ème trimestre.';
        }

        councilDecisionsToInsert.push({
          id: randomUUID(),
          sessionId: councilSessionId,
          studentId: sm.studentId,
          decision: dec,
          observations: decObs,
          createdAt: new Date(),
        });

        const existingRepId = existingReportMap.get(sm.studentId);
        if (existingRepId) {
          reportCardsToUpdate.push({
            id: existingRepId,
            aiComment,
            classMasterComment: ppComment,
            isGenerated: true,
            classWorkflowStatus: 'PUBLISHED',
            validationStatus: 'SENT',
          });
        } else {
          const repId = randomUUID();
          reportCardsToInsert.push({
            id: repId,
            schoolId: SCHOOL_ID,
            studentId: sm.studentId,
            academicYearId: ay.id,
            academicPeriodId: period1.id,
            generalAverage: sm.generalAverage,
            rank,
            mention,
            absenceCount: sm.absenceCount,
            isGenerated: true,
            aiComment,
            classMasterComment: ppComment,
            conductGrade: 'Bonne',
            template: 'FR_SECONDARY',
            totalStudents,
            validationStatus: 'SENT',
            classWorkflowStatus: 'PUBLISHED',
            createdAt: new Date(),
          });

          for (const l of sm.subjectLines) {
            subjectLinesToInsert.push({
              id: randomUUID(),
              reportCardId: repId,
              subjectId: l.subjectId,
              subjectName: l.subjectName,
              coefficient: l.coefficient,
              seq1Score: l.seq1Score,
              seq2Score: l.seq2Score,
              subjectAverage: l.subjectAverage,
              weightedScore: l.weightedScore,
              teacherComment: l.teacherComment,
            });
          }
        }
      }
    }

    if (reportCardsToInsert.length > 0) {
      console.log(`   Insertion de ${reportCardsToInsert.length} nouveaux bulletins...`);
      const resRep = await prisma.reportCard.createMany({ data: reportCardsToInsert, skipDuplicates: true });
      console.log(`   ✅ ${resRep.count} bulletins créés.`);
    }

    if (subjectLinesToInsert.length > 0) {
      console.log(`   Insertion de ${subjectLinesToInsert.length} lignes de matières...`);
      for (let i = 0; i < subjectLinesToInsert.length; i += 400) {
        const chunk = subjectLinesToInsert.slice(i, i + 400);
        await prisma.reportCardSubjectLine.createMany({ data: chunk, skipDuplicates: true });
      }
      console.log(`   ✅ Lignes de matières insérées.`);
    }

    for (const r of reportCardsToUpdate) {
      await prisma.reportCard.update({
        where: { id: r.id },
        data: {
          aiComment: r.aiComment,
          classMasterComment: r.classMasterComment,
          isGenerated: true,
          classWorkflowStatus: 'PUBLISHED',
          validationStatus: 'SENT',
        },
      });
    }

    // Conseils de classe
    for (const cs of councilSessionsToUpsert) {
      const existing = await prisma.classCouncilSession.findFirst({
        where: { classId: cs.classId, academicPeriodId: cs.academicPeriodId },
      });
      if (!existing) {
        const created = await prisma.classCouncilSession.create({ data: cs });
        const decs = councilDecisionsToInsert.filter(d => d.sessionId === cs.id).map(d => ({ ...d, sessionId: created.id }));
        if (decs.length > 0) {
          await prisma.classCouncilDecision.createMany({ data: decs, skipDuplicates: true });
        }
      }
    }

    for (const bs of bulletinSessionsToUpsert) {
      const existing = await prisma.bulletinValidationSession.findFirst({
        where: { classId: bs.classId, academicPeriodId: bs.academicPeriodId },
      });
      if (!existing) {
        await prisma.bulletinValidationSession.create({ data: bs });
      } else {
        await prisma.bulletinValidationSession.update({
          where: { id: existing.id },
          data: { status: 'PUBLISHED', publishedAt: new Date('2026-10-07T10:00:00Z') },
        });
      }
    }

    console.log('\n📊 Contrôle des compteurs finaux en local pour le Lycée de Bafia :');
    const finalGrades = await prisma.grade.count({ where: { schoolId: SCHOOL_ID } });
    const finalAttendances = await prisma.attendance.count({ where: { schoolId: SCHOOL_ID } });
    const finalReportCards = await prisma.reportCard.count({ where: { schoolId: SCHOOL_ID } });
    const finalCouncilSessions = await prisma.classCouncilSession.count({ where: { schoolId: SCHOOL_ID } });
    const finalBulletinSessions = await prisma.bulletinValidationSession.count({ where: { schoolId: SCHOOL_ID } });

    console.log(`   - Notes verrouillées : ${finalGrades}`);
    console.log(`   - Présences enregistrées : ${finalAttendances}`);
    console.log(`   - Bulletins générés & publiés : ${finalReportCards}`);
    console.log(`   - Conseils de classe validés : ${finalCouncilSessions}`);
    console.log(`   - Sessions de bulletins publiées : ${finalBulletinSessions}`);
    console.log('\n🎉 Enrichissement local terminé avec succès à 100% !');

  } catch (error) {
    console.error('❌ Erreur lors de l\'enrichissement :', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
