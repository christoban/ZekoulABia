const { PrismaClient } = require('./node_modules/@prisma/client');
const p = new PrismaClient();

async function run() {
  // 1. Fix duplicate professorPrincipalId
  const classes = await p.class.findMany({
    where: { professorPrincipalId: { not: null } },
    select: { id: true, name: true, professorPrincipalId: true },
    orderBy: { name: 'asc' },
  });

  const byTeacher = {};
  for (const c of classes) {
    if (!byTeacher[c.professorPrincipalId]) byTeacher[c.professorPrincipalId] = [];
    byTeacher[c.professorPrincipalId].push(c);
  }

  let fixedPP = 0;
  for (const [teacherId, teacherClasses] of Object.entries(byTeacher)) {
    if (teacherClasses.length > 1) {
      console.log('Doublon prof principal:', teacherClasses.map(c => c.name).join(', '));
      const toNull = teacherClasses.slice(1);
      for (const c of toNull) {
        await p.class.update({ where: { id: c.id }, data: { professorPrincipalId: null } });
        console.log('  -> Supprimé:', c.name);
        fixedPP++;
      }
    }
  }
  console.log('Doublons prof principal corrigés:', fixedPP);

  // 2. Fix duplicate Department.headId
  const depts = await p.department.findMany({
    where: { headId: { not: null } },
    select: { id: true, name: true, headId: true },
  });

  const byHead = {};
  for (const d of depts) {
    if (!byHead[d.headId]) byHead[d.headId] = [];
    byHead[d.headId].push(d);
  }

  let fixedDept = 0;
  for (const [headId, headDepts] of Object.entries(byHead)) {
    if (headDepts.length > 1) {
      console.log('Doublon dept head:', headDepts.map(d => d.name).join(', '));
      const toNull = headDepts.slice(1);
      for (const d of toNull) {
        await p.department.update({ where: { id: d.id }, data: { headId: null } });
        console.log('  -> Supprimé:', d.name);
        fixedDept++;
      }
    }
  }
  console.log('Doublons dept head corrigés:', fixedDept);

  // 3. Apply the missing SQL changes directly
  console.log('\nApplication des changements DB...');

  // 3a. Add observation column to Grade
  await p.$executeRawUnsafe(`ALTER TABLE "Grade" ADD COLUMN IF NOT EXISTS "observation" TEXT`);
  console.log('+ observation ajoutée à Grade');

  // 3b. Add ABSENT_JUSTIFIED to AttendanceStatus enum
  try {
    await p.$executeRawUnsafe(`ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'ABSENT_JUSTIFIED'`);
    console.log('+ ABSENT_JUSTIFIED ajouté à AttendanceStatus');
  } catch (e) {
    console.log('  (ABSENT_JUSTIFIED déjà présent ou erreur ignorée)');
  }

  // 3c. Create ClassSubjectOverride table
  await p.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ClassSubjectOverride" (
      "id" TEXT NOT NULL,
      "schoolId" TEXT NOT NULL,
      "classId" TEXT NOT NULL,
      "subjectId" TEXT NOT NULL,
      "coefficient" DOUBLE PRECISION NOT NULL,
      CONSTRAINT "ClassSubjectOverride_pkey" PRIMARY KEY ("id")
    )
  `);
  console.log('+ Table ClassSubjectOverride créée');

  await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ClassSubjectOverride_schoolId_idx" ON "ClassSubjectOverride"("schoolId")`);
  await p.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ClassSubjectOverride_classId_subjectId_key" ON "ClassSubjectOverride"("classId", "subjectId")`);

  try {
    await p.$executeRawUnsafe(`ALTER TABLE "ClassSubjectOverride" ADD CONSTRAINT "ClassSubjectOverride_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    await p.$executeRawUnsafe(`ALTER TABLE "ClassSubjectOverride" ADD CONSTRAINT "ClassSubjectOverride_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    await p.$executeRawUnsafe(`ALTER TABLE "ClassSubjectOverride" ADD CONSTRAINT "ClassSubjectOverride_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE`);
    console.log('+ Foreign keys ClassSubjectOverride ajoutées');
  } catch (e) {
    console.log('  (FK déjà existantes)');
  }

  // 3d. Unique constraint on Class.professorPrincipalId
  await p.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Class_professorPrincipalId_key" ON "Class"("professorPrincipalId")`);
  console.log('+ Contrainte unique Class.professorPrincipalId');

  // 3e. Unique constraint on Department.headId
  await p.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Department_headId_key" ON "Department"("headId")`);
  console.log('+ Contrainte unique Department.headId');

  // 4. Mark migration as applied in Prisma migrations table
  console.log('\nTout appliqué avec succès.');
}

run().catch(console.error).finally(() => p.$disconnect());
