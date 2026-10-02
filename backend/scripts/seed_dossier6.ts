/**
 * Seed du Dossier VI — Tests et fonctionnalités (Thunder Client).
 *
 * Prépare un établissement fictif complet et cohérent : comptes de test par rôle,
 * structure pédagogique, notes et conseil de classe verrouillé, afin que
 * `POST /api/v2/report-cards/generate` produise réellement des bulletins.
 *
 * Usage :
 *   cd backend
 *   DATABASE_URL="postgresql://postgres:2005@localhost:5432/zekoulabia_test?schema=public" \
 *     bun scripts/seed_dossier6.ts
 *
 * GARDE-FOUS : production refusée + refus explicite de toute base dont le nom
 * ne contient pas `_test`. Le script est idempotent (upsert sur clés
 * naturelles) : le relancer ne duplique rien.
 */

import { PrismaClient, StaffPermissionType, SubjectType, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const DATABASE_URL = process.env.DATABASE_URL ?? '';

if (process.env.NODE_ENV === 'production') {
  console.error('⛔ Interdit en production.');
  process.exit(1);
}
if (!/_test/.test(DATABASE_URL)) {
  console.error(`⛔ Base refusée : « ${DATABASE_URL} » ne contient pas « _test ».`);
  console.error('   Utilise uniquement une base de test (ex. zekoulabia_test).');
  process.exit(1);
}

const prisma = new PrismaClient();

// ─── Constantes du jeu de test ───────────────────────────────────────────────

const SCHOOL_NAME = 'Lycée Pilote ZekoulABia (TEST)';
const SCHOOL_SUBDOMAIN = 'lycee-pilote-dossier6';
const PASSWORD = 'Test1234!';

const YEAR_NAME = '2025-2026';

const MATIERES: ReadonlyArray<{
  name: string; code: string; coefficient: number; hoursPerWeek: number; isLV2?: boolean;
}> = [
  { name: 'Mathématiques', code: 'MATH', coefficient: 4, hoursPerWeek: 5 },
  { name: 'Français', code: 'FRAN', coefficient: 3, hoursPerWeek: 4 },
  { name: 'Anglais', code: 'ANGL', coefficient: 2, hoursPerWeek: 3 },
  { name: 'Informatique', code: 'INFO', coefficient: 2, hoursPerWeek: 2 },
  // LV2 : requis pour que le checkpoint d'orientation 5e/4e soit proposé par l'app.
  { name: 'Allemand', code: 'ALLE', coefficient: 1, hoursPerWeek: 2, isLV2: true },
];

// Notes volontairement contrastées : 5e A est « prête à générer », 6e A est « bloquée »
// afin de pouvoir tester les deux chemins (succès + 422 NOTES_NON_VALIDEES).
const NOTES_5A: Record<string, number[]> = {
  'Mathématiques': [15.5, 14.0],
  'Français': [13.0, 15.5],
  'Anglais': [17.0, 16.5],
  'Informatique': [18.0, 19.0],
};
const NOTES_6A: Record<string, number[]> = {
  'Mathématiques': [9.5, 11.0],
  'Français': [10.0, 12.5],
  'Anglais': [14.0, 13.5],
  'Informatique': [16.0, 15.5],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

type U = { id: string; email: string };

async function upsertUser(
  schoolId: string,
  email: string,
  firstName: string,
  lastName: string,
  role: UserRole,
  phone: string,
  passwordHash: string,
): Promise<U> {
  const u = await prisma.user.upsert({
    where: { schoolId_email: { schoolId, email } },
    update: {
      firstName, lastName, role, phone, passwordHash,
      isActive: true, mustChangePassword: false,
      // État MFA remis à zéro : le seed est ainsi déterministe. ADMIN/STAFF/TEACHER
      // restent néanmoins bloqués à l'étape « mfa_setup_required » (voir le rapport) :
      // c'est le flux normal de l'application, on ne le contourne pas.
      mfaEnabled: false, mfaSecret: null, mfaTempSecret: null,
      mfaRecoveryCodeHashes: [], mfaRecoveryCodeGeneratedAt: null,
    },
    create: { schoolId, email, firstName, lastName, role, phone, passwordHash, isActive: true, mustChangePassword: false },
    select: { id: true, email: true },
  });
  return u;
}

async function main() {
  console.log('🚀 [Dossier VI] Préparation de la base de test');
  console.log(`   Base : ${DATABASE_URL.replace(/:[^:@/]*@/, ':***@')}\n`);

  const passwordHash = bcrypt.hashSync(PASSWORD, 10);

  // ── 1. Établissement ───────────────────────────────────────────────────────
  // status ACTIVE : ConnecterUtilisateurUseCase refuse la connexion sur PENDING/SUSPENDED
  // ET RafraichirTokenUseCase exige estActive() (ACTIVE strict) pour rafraîchir le jeton.
  const school = await prisma.school.upsert({
    where: { subdomain: SCHOOL_SUBDOMAIN },
    update: { status: 'ACTIVE' },
    create: {
      name: SCHOOL_NAME,
      subdomain: SCHOOL_SUBDOMAIN,
      type: 'SECONDARY',
      subsystem: 'FRANCOPHONE',
      status: 'ACTIVE',
      city: 'Yaoundé',
      phone: '+237 699 00 00 00',
      email: 'contact@lycee-pilote-dossier6.test',
    },
  });
  console.log(`🏫 École : ${school.name} (${school.id}) — statut ${school.status}`);

  // ── 2. Année scolaire + périodes + séquences ──────────────────────────────
  const annee = await prisma.academicYear.upsert({
    where: { id: `${school.id}_an` },
    update: { isCurrent: true },
    create: {
      id: `${school.id}_an`,
      schoolId: school.id,
      name: YEAR_NAME,
      startDate: new Date('2025-09-01'),
      endDate: new Date('2026-06-30'),
      isCurrent: true,
    },
  });

  const periodDefs = [
    { name: '1er Trimestre', startDate: '2025-09-01', endDate: '2025-12-20' },
    { name: '2ème Trimestre', startDate: '2026-01-05', endDate: '2026-03-28' },
    { name: '3ème Trimestre', startDate: '2026-04-06', endDate: '2026-06-30' },
  ];
  const periods = [];
  for (const [i, p] of periodDefs.entries()) {
    periods.push(
      await prisma.academicPeriod.upsert({
        where: { id: `${school.id}_p${i + 1}` },
        update: {},
        create: {
          id: `${school.id}_p${i + 1}`,
          academicYearId: annee.id,
          name: p.name,
          type: 'TRIMESTER',
          orderIndex: i + 1,
          startDate: new Date(p.startDate),
          endDate: new Date(p.endDate),
          // Le contrôleur auto-détecte la 1re période par orderIndex ; isCurrent=true
          // reste utile pour les écrans et cohérent avec le métier.
          isCurrent: i === 0,
        },
      }),
    );
  }
  const t1 = periods[0];
  console.log(`📅 Année ${annee.name} (courante) — 3 trimestres, T1 = ${t1.id}`);

  // 2 séquences sur le T1 (le générateur de bulletin en agrège toutes celles de la période)
  const sequences = [];
  for (const [i, s] of [
    { name: 'Évaluation 1', type: 'DS' as const },
    { name: 'Composition 1', type: 'COMPOSITION' as const },
  ].entries()) {
    sequences.push(
      await prisma.academicSequence.upsert({
        where: { academicPeriodId_orderIndex: { academicPeriodId: t1.id, orderIndex: i + 1 } },
        update: {},
        create: {
          id: `${t1.id}_s${i + 1}`,
          academicPeriodId: t1.id,
          schoolId: school.id,
          name: s.name,
          type: s.type,
          orderIndex: i + 1,
          startDate: new Date('2025-10-06'),
          endDate: new Date('2025-10-10'),
          isCurrent: i === 0,
        },
      }),
    );
  }
  console.log(`   → 2 séquences sur le T1 (DS + Composition)`);

  // ── 3. Matières ────────────────────────────────────────────────────────────
  const subjects = new Map<string, { id: string; coefficient: number }>();
  for (const m of MATIERES) {
    const s = await prisma.subject.upsert({
      where: { id: `${school.id}_subj_${m.code}` },
      update: { coefficient: m.coefficient, isLV2: m.isLV2 },
      create: {
        id: `${school.id}_subj_${m.code}`,
        schoolId: school.id,
        name: m.name,
        code: m.code,
        coefficient: m.coefficient,
        hoursPerWeek: m.hoursPerWeek,
        isLV2: m.isLV2 ?? false,
        subjectType: SubjectType.THEORETICAL,
      },
    });
    subjects.set(m.name, { id: s.id, coefficient: s.coefficient });
  }
  console.log(`📚 ${subjects.size} matières`);

  // ── 4. Comptes ─────────────────────────────────────────────────────────────
  const admin = await upsertUser(school.id, 'admin.test@zekoulabia.local', 'Marie', 'ADMIN-Test', 'ADMIN', '690000001', passwordHash);

  // Censeur : STAFF avec les permissions qui débloquent conseil de classe, EDT, finances.
  const staff = await upsertUser(school.id, 'staff.test@zekoulabia.local', 'Sophie', 'STAFF-Test', 'STAFF', '690000002', passwordHash);
  await prisma.staffProfile.upsert({
    where: { userId: staff.id },
    update: { title: 'Censeur' },
    create: { schoolId: school.id, userId: staff.id, title: 'Censeur' },
  });
  const staffProfileId = (
    await prisma.staffProfile.findUniqueOrThrow({ where: { userId: staff.id }, select: { id: true } })
  ).id;
  const staffPerms: StaffPermissionType[] = [
    'MANAGE_ENROLLMENT', 'MANAGE_CLASSES', 'MANAGE_TEACHING_ASSIGNMENTS', 'MANAGE_STUDENT_ASSIGNMENTS',
    'MANAGE_TIMETABLE', 'VALIDATE_GRADES', 'MANAGE_CLASS_COUNCIL', 'MANAGE_ATTENDANCE',
    'MANAGE_FINANCE', 'VALIDATE_PAYMENTS', 'MANAGE_EXAMS', 'GENERATE_REPORTS',
  ];
  for (const permission of staffPerms) {
    await prisma.staffPermission.upsert({
      where: { staffProfileId_permission: { staffProfileId, permission } },
      update: {},
      create: { staffProfileId, permission },
    });
  }

  // 2 enseignants → nécessaire pour tester le cloisonnement enseignant→classe/matière.
  const profMath = await upsertUser(school.id, 'teacher.math.test@zekoulabia.local', 'Ibrahim', 'SOULEY-Test', 'TEACHER', '690000010', passwordHash);
  const profFr = await upsertUser(school.id, 'teacher.fr.test@zekoulabia.local', 'Awa', 'NDONGO-Test', 'TEACHER', '690000011', passwordHash);

  const teacherSubjects: Record<string, string[]> = {
    'Mathématiques': ['Mathématiques', 'Informatique'],
    'Français': ['Français', 'Anglais'],
  };
  for (const [teacherId, matieres] of Object.entries({
    [profMath.id]: teacherSubjects['Mathématiques'],
    [profFr.id]: teacherSubjects['Français'],
  })) {
    const tp = await prisma.teacherProfile.upsert({
      where: { userId: teacherId },
      update: {},
      create: { userId: teacherId, specialization: matieres.slice(0, 1) },
      select: { id: true },
    });
    for (const nom of matieres) {
      const sub = subjects.get(nom)!;
      await prisma.teacherSubject.upsert({
        where: { teacherProfileId_subjectId: { teacherProfileId: tp.id, subjectId: sub.id } },
        update: {},
        create: { teacherProfileId: tp.id, subjectId: sub.id },
      });
    }
  }

  const parent = await upsertUser(school.id, 'parent.test@zekoulabia.local', 'Paul', 'PARENT-Test', 'PARENT', '690000020', passwordHash);
  const parent2 = await upsertUser(school.id, 'parent2.test@zekoulabia.local', 'Marie-José', 'PARENT2-Test', 'PARENT', '690000021', passwordHash);
  const parentProfileId = (
    await prisma.parentProfile.upsert({
      where: { userId: parent.id }, update: {}, create: { userId: parent.id }, select: { id: true },
    })
  ).id;
  const parentProfile2Id = (
    await prisma.parentProfile.upsert({
      where: { userId: parent2.id }, update: {}, create: { userId: parent2.id }, select: { id: true },
    })
  ).id;

  // ── 5. Classes ─────────────────────────────────────────────────────────────
  const classDefs = [
    { id: `${school.id}_6A`, name: '6e A', level: '6e' },
    { id: `${school.id}_5A`, name: '5e A', level: '5e' },
  ];
  const classes = new Map<string, string>();
  for (const c of classDefs) {
    await prisma.class.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id, schoolId: school.id, academicYearId: annee.id,
        name: c.name, level: c.level, status: 'ACTIVE', capacity: 40,
      },
    });
    classes.set(c.name, c.id);
  }
  const c6A = classes.get('6e A')!;
  const c5A = classes.get('5e A')!;
  // Professeur principal de 5e A (affiché sur le bulletin PDF).
  await prisma.class.update({ where: { id: c5A }, data: { professorPrincipalId: profMath.id } });

  // Affectations enseignant → matière → classe. Indispensable : sans TeachingAssignment,
  // POST /api/v2/grades et le verrouillage des notes renvoient 403 métier.
  const assignments: Array<[string, string, string]> = [];
  for (const [classId, className] of [[c6A, '6e A'], [c5A, '5e A']] as const) {
    for (const nom of ['Mathématiques', 'Français', 'Anglais', 'Informatique']) {
      const teacherId = teacherSubjects['Mathématiques'].includes(nom) ? profMath.id : profFr.id;
      const subjectId = subjects.get(nom)!.id;
      await prisma.teachingAssignment.upsert({
        where: { classId_subjectId: { classId, subjectId } },
        update: { teacherId },
        create: { classId, subjectId, teacherId, schoolId: school.id, academicYearId: annee.id, source: 'MANUAL' },
      });
      assignments.push([classId, subjectId, teacherId]);
    }
  }
  console.log(`🏫 2 classes (6e A, 5e A) — ${assignments.length} affectations pédagogiques`);

  // ── 6. Élèves + inscriptions + rattachement parent ─────────────────────────
  const eleves = [
    { email: 'eleve1.test@zekoulabia.local', first: 'Junior', last: 'NGUEMA', classId: c5A, matricule: 'D6-ELEVE001', parentId: parentProfileId },
    { email: 'eleve2.test@zekoulabia.local', first: 'Chantal', last: 'MBALLA', classId: c5A, matricule: 'D6-ELEVE002', parentId: parentProfileId },
    { email: 'eleve3.test@zekoulabia.local', first: 'Arnaud', last: 'TATTE', classId: c6A, matricule: 'D6-ELEVE003', parentId: parentProfile2Id },
    { email: 'eleve4.test@zekoulabia.local', first: 'Blandine', last: 'EKO', classId: c6A, matricule: 'D6-ELEVE004', parentId: parentProfile2Id },
  ];
  const students: Array<{ userId: string; profileId: string; classId: string; nom: string }> = [];
  for (const [i, e] of eleves.entries()) {
    const user = await upsertUser(school.id, e.email, e.first, e.last, 'STUDENT', `69100000${i + 1}`, passwordHash);
    const profile = await prisma.studentProfile.upsert({
      where: { userId: user.id },
      update: { matricule: e.matricule, numeroInterne: e.matricule },
      create: {
        userId: user.id,
        matricule: e.matricule,
        numeroInterne: e.matricule,
        dateOfBirth: new Date(`201${2 + Math.floor(i / 2)}-0${(i % 2) + 1}-15`),
        gender: i % 2 === 0 ? 'M' : 'F',
      },
      select: { id: true },
    });
    await prisma.enrollment.upsert({
      where: { studentId_academicYearId: { studentId: profile.id, academicYearId: annee.id } },
      update: { classId: e.classId, status: 'ACTIVE' },
      create: {
        studentId: profile.id, classId: e.classId, academicYearId: annee.id,
        schoolId: school.id, status: 'ACTIVE', enrolledById: admin.id,
      },
    });
    await prisma.parentStudent.upsert({
      where: { parentProfileId_studentProfileId: { parentProfileId: e.parentId, studentProfileId: profile.id } },
      update: {},
      create: {
        parentProfileId: e.parentId, studentProfileId: profile.id,
        relation: 'PERE', contactPrincipal: true, responsableFinancier: true,
      },
    });
    students.push({ userId: user.id, profileId: profile.id, classId: e.classId, nom: `${e.first} ${e.last}` });
  }
  console.log(`👥 ${students.length} élèves inscrits (2 en 6e A, 2 en 5e A) + 2 parents rattachés`);

  // ── 7. Notes ───────────────────────────────────────────────────────────────
  // sequenceScore ET sequenceAverage : le générateur de bulletin ignore toute note dont
  // sequenceAverage est null (Note.create dérive sequenceAverage de sequenceScore, mais
  // une note insérée directement en base avec seulement classTestScore n'en aurait pas).
  // 5e A → LOCKED (bulletin générable) ; 6e A → DRAFT (déclenche le 422 attendu).
  let grades5 = 0;
  let grades6 = 0;
  for (const [classId, table, status, locked] of [
    [c5A, NOTES_5A, 'LOCKED', profMath.id],
    [c6A, NOTES_6A, 'DRAFT', profMath.id],
  ] as const) {
    const elevesDeLaClasse = students.filter(s => s.classId === classId);
    for (const s of elevesDeLaClasse) {
      for (const [nom, scores] of Object.entries(table)) {
        const sub = subjects.get(nom)!;
        for (const [seqIdx, score] of scores.entries()) {
          await prisma.grade.upsert({
            where: {
              studentId_subjectId_sequenceId: {
                studentId: s.userId, subjectId: sub.id, sequenceId: sequences[seqIdx].id,
              },
            },
            update: { sequenceScore: score, sequenceAverage: score, validationStatus: status },
            create: {
              schoolId: school.id, studentId: s.userId, subjectId: sub.id, classId,
              academicYearId: annee.id, sequenceId: sequences[seqIdx].id,
              sequenceScore: score, sequenceAverage: score,
              coefficient: sub.coefficient, maxValue: 20,
              validationStatus: status,
              recordedById: locked,
              validatedById: status === 'LOCKED' ? locked : null,
              validatedAt: status === 'LOCKED' ? new Date() : null,
            },
          });
          if (classId === c5A) grades5++; else grades6++;
        }
      }
    }
  }
  console.log(`📝 ${grades5} notes LOCKED (5e A) + ${grades6} notes DRAFT (6e A)`);

  // ── 8. Conseil de classe verrouillé sur 5e A ───────────────────────────────
  // Condition bloquante B8 de GenererBulletinUseCase : sans session LOCKED,
  // POST /report-cards/generate répond 422 CONSEIL_REQUIS.
  const session5A = await prisma.classCouncilSession.upsert({
    where: { classId_academicPeriodId: { classId: c5A, academicPeriodId: t1.id } },
    update: { status: 'LOCKED' },
    create: {
      schoolId: school.id, classId: c5A, academicPeriodId: t1.id,
      presidedById: staff.id, status: 'LOCKED', validatedAt: new Date(),
    },
  });
  for (const s of students.filter(x => x.classId === c5A)) {
    await prisma.classCouncilDecision.upsert({
      where: { sessionId_studentId: { sessionId: session5A.id, studentId: s.userId } },
      update: {},
      create: { sessionId: session5A.id, studentId: s.userId, decision: 'DELIBERATION' },
    });
  }
  console.log(`⚖️  Conseil de classe LOCKED sur 5e A/T1 — 5e A générable, 6e A bloquée (test 422)`);

  // ── 9. Présences (T1) ─────────────────────────────────────────────────────
  const attendances = [
    { i: 0, status: 'PRESENT' as const }, { i: 1, status: 'LATE' as const },
    { i: 2, status: 'ABSENT' as const }, { i: 3, status: 'ABSENT_JUSTIFIED' as const },
    { i: 4, status: 'PRESENT' as const }, { i: 5, status: 'ABSENT' as const },
  ];
  let nbAtt = 0;
  for (const s of students) {
    for (const [k, a] of attendances.entries()) {
      const date = new Date(`2025-10-${String(6 + k).padStart(2, '0')}T08:00:00Z`);
      // Attendance n'a aucune clé unique naturelle : on teste l'existence (élève + date)
      // pour que le seed reste idempotent.
      const exists = await prisma.attendance.findFirst({
        where: { schoolId: school.id, studentId: s.userId, date },
        select: { id: true },
      });
      if (exists) continue;
      await prisma.attendance.create({
        data: {
          schoolId: school.id, studentId: s.userId, classId: s.classId,
          academicPeriodId: t1.id, date,
          status: a.status, period: k % 2 === 0 ? 'MORNING' : 'AFTERNOON',
          recordedById: staff.id, teacherId: profMath.id,
          justification: a.status === 'ABSENT_JUSTIFIED' ? 'Rendez-vous médical (justificatif fourni)' : null,
          justifiedById: a.status === 'ABSENT_JUSTIFIED' ? staff.id : null,
        },
      });
      nbAtt++;
    }
  }
  console.log(`📋 ${nbAtt} enregistrements d'assiduité ajoutés (présent / retard / absent / absent justifié)`);

  // ── 10. Emploi du temps (5e A, T1) ────────────────────────────────────────
  const edt = await prisma.timetable.upsert({
    where: { schoolId_classId_academicYearId: { schoolId: school.id, classId: c5A, academicYearId: annee.id } },
    update: {},
    create: { schoolId: school.id, classId: c5A, academicYearId: annee.id, status: 'PUBLISHED', generatedByAI: false },
  });
  const creneaux: Array<[number, string, string, string]> = [
    [1, '07:30', '08:30', 'Mathématiques'],
    [1, '08:30', '09:30', 'Français'],
    [2, '07:30', '08:30', 'Anglais'],
    [3, '10:00', '11:00', 'Informatique'],
    [4, '13:00', '14:00', 'Mathématiques'],
  ];
  let nbSlots = 0;
  for (const [day, start, end, nom] of creneaux) {
    const sub = subjects.get(nom)!;
    const teacherId = teacherSubjects['Mathématiques'].includes(nom) ? profMath.id : profFr.id;
    const exists = await prisma.timetableSlot.findFirst({
      where: { timetableId: edt.id, dayOfWeek: day, startTime: start },
    });
    if (!exists) {
      await prisma.timetableSlot.create({
        data: { timetableId: edt.id, subjectId: sub.id, teacherId, dayOfWeek: day, startTime: start, endTime: end, kind: 'CLASS' },
      });
      nbSlots++;
    }
  }
  console.log(`🕓 Emploi du temps 5e A — ${nbSlots} créneaux${nbSlots ? '' : ' (déjà présent)'}`);

  // ── 11. Finances ───────────────────────────────────────────────────────────
  const invoices: Array<[typeof students[number], string, number, 'PAID' | 'PENDING' | 'OVERDUE']> = [
    [students[0], 'Scolarité 1er Trimestre', 45000, 'PAID'],
    [students[1], 'Scolarité 1er Trimestre', 45000, 'PENDING'],
    [students[2], 'Scolarité 1er Trimestre', 45000, 'OVERDUE'],
    [students[3], 'Scolarité 1er Trimestre', 45000, 'PAID'],
  ];
  let nbFin = 0;
  for (const [s, description, amount, status] of invoices) {
    const inv = await prisma.invoice.upsert({
      where: { id: `${school.id}_inv_${s.userId}` },
      update: { status, amount },
      create: {
        id: `${school.id}_inv_${s.userId}`, schoolId: school.id, studentId: s.userId,
        amount, description, status, dueDate: new Date('2025-12-20'),
      },
    });
    nbFin++;
    if (status === 'PAID') {
      await prisma.payment.upsert({
        where: { id: `${school.id}_pay_${s.userId}` },
        update: {},
        create: {
          id: `${school.id}_pay_${s.userId}`, schoolId: school.id, invoiceId: inv.id,
          studentId: s.userId, amount, method: 'MTN_MOMO', status: 'SUCCESS',
          paidAt: new Date('2025-10-05'), feeType: 'TUITION', transactionId: `D6-MOMO-${s.userId.slice(-6)}`,
        },
      });
      nbFin++;
    }
  }
  console.log(`💰 ${nbFin} écritures financières (factures payées / en attente / en retard)`);

  // ── 12. Communication ──────────────────────────────────────────────────────
  const ann = await prisma.announcement.findFirst({ where: { schoolId: school.id, title: 'Réunion parents-professeurs (TEST)' } });
  if (!ann) {
    await prisma.announcement.create({
      data: {
        schoolId: school.id, title: 'Réunion parents-professeurs (TEST)',
        content: 'Réunion de la 5e A le samedi à 08h00 en salle 1.',
        targetRoles: ['PARENT', 'STAFF', 'TEACHER', 'ADMIN'],
        authorId: admin.id, auteurRole: 'ADMIN', auteurTitre: 'Proviseure',
        isPinned: true, categorie: 'COMMUNIQUE', priorite: 'NORMALE',
      },
    });
  }
  // Deux canaux, car la messagerie filtre par type selon le rôle
  // (PrismaMessagerieRepository.listerConversationsPourAppelant) :
  // un PARENT ne voit que PARENT_CHANNEL, un élève/enseignant que CLASS_CHANNEL.
  const canaux: Array<[string, 'CLASS_CHANNEL' | 'PARENT_CHANNEL', string[]]> = [
    ['5e A — TEST (classe)', 'CLASS_CHANNEL', [admin.id, staff.id, profMath.id, profFr.id,
      ...students.filter(s => s.classId === c5A).map(s => s.userId)]],
    ['5e A — Parents (TEST)', 'PARENT_CHANNEL', [admin.id, staff.id,
      parent.id, ...students.filter(s => s.classId === c5A).map(s => s.userId)]],
  ];
  for (const [nom, type, participants] of canaux) {
    let conv = await prisma.conversation.findFirst({ where: { schoolId: school.id, name: nom } });
    if (!conv) {
      const created = await prisma.conversation.create({
        data: { schoolId: school.id, type, name: nom, classId: c5A },
      });
      for (const userId of participants) {
        await prisma.conversationParticipant.create({ data: { conversationId: created.id, userId } });
      }
      await prisma.message.create({
        data: {
          conversationId: created.id, senderId: staff.id,
          content: 'Cher(e)s parent(s), le bulletin du 1er trimestre sera publié vendredi.',
        },
      });
      conv = created;
    }
  }
  console.log('📢 1 annonce épinglée + 2 canaux messagerie (5e A — classe et 5e A — Parents)');

  // ── 13. Résumé exploitable par Thunder Client ─────────────────────────────
  console.log('\n' + '='.repeat(74));
  console.log('COMPTES DE TEST — mot de passe commun : ' + PASSWORD);
  console.log('='.repeat(74));
  const accounts = [
    ['ADMIN', 'Marie ADMIN-Test', admin.email, admin.id],
    ['STAFF (Censeur, 12 permissions)', 'Sophie STAFF-Test', staff.email, staff.id],
    ['TEACHER (Maths + Info)', 'Ibrahim SOULEY-Test', 'teacher.math.test@zekoulabia.local', profMath.id],
    ['TEACHER (Français + Anglais)', 'Awa NDONGO-Test', 'teacher.fr.test@zekoulabia.local', profFr.id],
    ['PARENT (élèves 1 et 2)', 'Paul PARENT-Test', parent.email, parent.id],
    ['PARENT (élèves 3 et 4)', 'Marie-José PARENT2-Test', parent2.email, parent2.id],
    ...students.map((s, i) => [`STUDENT ${i + 1}`, s.nom, eleves[i].email, s.userId] as const),
  ];
  for (const [role, nom, email, id] of accounts) {
    console.log(`${role.padEnd(32)} | ${nom.padEnd(20)} | ${email.padEnd(34)} | ${id}`);
  }
  console.log('\nIDS UTILES');
  console.log(`  schoolId            ${school.id}`);
  console.log(`  academicYearId      ${annee.id}`);
  console.log(`  academicPeriodId T1 ${t1.id}`);
  console.log(`  classId 5e A        ${c5A}`);
  console.log(`  classId 6e A        ${c6A}`);
  console.log(`  sequenceId DS       ${sequences[0].id}`);
  console.log(`  sequenceId Compo    ${sequences[1].id}`);
  console.log('\n✅ Base de test prête.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());