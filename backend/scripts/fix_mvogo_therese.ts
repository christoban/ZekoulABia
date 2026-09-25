/**
 * 1. Ajouter Sciences dans TeacherSubject d'EDZOA Simon
 * 2. Transférer 2 Sciences de MVOGO Therese → EDZOA Simon (+ slots EDT)
 * 3. Donner 1 Physique + 1 Chimie à MVOGO Therese (depuis profs avec ≥2)
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const SCHOOL_ID = 'f91c2219-13ad-465c-979e-41d448612894';

const MVOGO_THERESE_ID   = 'db40b67f-e83f-4536-8d58-a516bcebbc55';
const EDZOA_SIMON_ID     = 'f09222b1-f37b-423c-8443-ab9edccbe751';
const EDZOA_SIMON_PROFID = 'cmqhxox9w001rwcg0lyiphsi8';

const SCIENCES_ID = 'cmqh4od8h003qwcy0uopweal9';
const PHYSIQUE_ID = 'cmqh4odr700eqwcy0hqtg8kyr';
const CHIMIE_ID   = 'cmqh4odro00euwcy0ysc24w03';

async function updateAssignmentAndSlots(
  assignmentId: string,
  newTeacherId: string,
  classId: string,
  subjectId: string,
  oldTeacherId: string,
) {
  const tt = await prisma.timetable.findFirst({ where: { classId, schoolId: SCHOOL_ID }, select: { id: true } });
  await prisma.teachingAssignment.update({ where: { id: assignmentId }, data: { teacherId: newTeacherId, source: 'MANUAL', createdAt: new Date() } });
  if (tt) {
    const r = await prisma.timetableSlot.updateMany({
      where: { timetableId: tt.id, teacherId: oldTeacherId, subjectId },
      data: { teacherId: newTeacherId },
    });
    return r.count;
  }
  return 0;
}

async function main() {
  console.log('\n🔧 Correction MVOGO Therese (Physique + Chimie)\n');

  // ── 1. Ajouter Sciences à EDZOA Simon ────────────────────────────────────
  const existing = await prisma.teacherSubject.findFirst({
    where: { teacherProfileId: EDZOA_SIMON_PROFID, subjectId: SCIENCES_ID },
  });
  if (!existing) {
    await prisma.teacherSubject.create({
      data: { teacherProfileId: EDZOA_SIMON_PROFID, subjectId: SCIENCES_ID },
    });
    console.log('   ✓ Sciences ajouté dans TeacherSubject d\'EDZOA Simon');
  } else {
    console.log('   (Sciences déjà dans TeacherSubject d\'EDZOA Simon)');
  }

  // ── 2. Transférer 2 Sciences de MVOGO Therese → EDZOA Simon ──────────────
  const sciencesAssignments = await prisma.teachingAssignment.findMany({
    where: { teacherId: MVOGO_THERESE_ID, subjectId: SCIENCES_ID, schoolId: SCHOOL_ID },
    select: { id: true, classId: true },
    take: 2,
  });

  if (sciencesAssignments.length < 2) {
    console.log(`   ⚠️  Seulement ${sciencesAssignments.length} Sciences dispo pour transfert`);
  }

  for (const a of sciencesAssignments) {
    const slots = await updateAssignmentAndSlots(a.id, EDZOA_SIMON_ID, a.classId, SCIENCES_ID, MVOGO_THERESE_ID);
    const cls = await prisma.class.findUnique({ where: { id: a.classId }, select: { name: true } });
    console.log(`   ✓ Sciences ${cls?.name} → EDZOA Simon (${slots} slots)`);
  }

  // ── 3. Donner 1 Physique à MVOGO Therese ─────────────────────────────────
  // Chercher un prof avec ≥2 Physique et < 15 total
  const physiqueAssignments = await prisma.teachingAssignment.findMany({
    where: { subjectId: PHYSIQUE_ID, schoolId: SCHOOL_ID, teacherId: { not: MVOGO_THERESE_ID } },
    select: { id: true, classId: true, teacherId: true },
  });

  const physiqueByTeacher = new Map<string, typeof physiqueAssignments>();
  for (const a of physiqueAssignments) {
    if (!physiqueByTeacher.has(a.teacherId)) physiqueByTeacher.set(a.teacherId, []);
    physiqueByTeacher.get(a.teacherId)!.push(a);
  }

  let physiqueFixed = false;
  for (const [tid, arr] of [...physiqueByTeacher.entries()].sort((a, b) => b[1].length - a[1].length)) {
    if (arr.length < 2) continue;
    const totalLoad = await prisma.teachingAssignment.count({ where: { teacherId: tid, schoolId: SCHOOL_ID } });
    if (totalLoad > 15) continue; // ne pas dépasser même si déjà à 15 (on enlève 1 donc ça va)

    const a = arr[arr.length - 1]!;
    const donor = await prisma.user.findUnique({ where: { id: tid }, select: { lastName: true, firstName: true } });
    const slots = await updateAssignmentAndSlots(a.id, MVOGO_THERESE_ID, a.classId, PHYSIQUE_ID, tid);
    const cls = await prisma.class.findUnique({ where: { id: a.classId }, select: { name: true } });
    console.log(`   ✓ Physique ${cls?.name} → MVOGO Therese (de ${donor?.lastName}, ${slots} slots)`);
    physiqueFixed = true;
    break;
  }
  if (!physiqueFixed) console.log('   ❌ Impossible de trouver donateur Physique');

  // ── 4. Donner 1 Chimie à MVOGO Therese ───────────────────────────────────
  const chimieAssignments = await prisma.teachingAssignment.findMany({
    where: { subjectId: CHIMIE_ID, schoolId: SCHOOL_ID, teacherId: { not: MVOGO_THERESE_ID } },
    select: { id: true, classId: true, teacherId: true },
  });

  const chimieByTeacher = new Map<string, typeof chimieAssignments>();
  for (const a of chimieAssignments) {
    if (!chimieByTeacher.has(a.teacherId)) chimieByTeacher.set(a.teacherId, []);
    chimieByTeacher.get(a.teacherId)!.push(a);
  }

  let chimieFixed = false;
  for (const [tid, arr] of [...chimieByTeacher.entries()].sort((a, b) => b[1].length - a[1].length)) {
    if (arr.length < 2) continue;
    const totalLoad = await prisma.teachingAssignment.count({ where: { teacherId: tid, schoolId: SCHOOL_ID } });
    if (totalLoad > 15) continue;

    const a = arr[arr.length - 1]!;
    const donor = await prisma.user.findUnique({ where: { id: tid }, select: { lastName: true, firstName: true } });
    const slots = await updateAssignmentAndSlots(a.id, MVOGO_THERESE_ID, a.classId, CHIMIE_ID, tid);
    const cls = await prisma.class.findUnique({ where: { id: a.classId }, select: { name: true } });
    console.log(`   ✓ Chimie ${cls?.name} → MVOGO Therese (de ${donor?.lastName}, ${slots} slots)`);
    chimieFixed = true;
    break;
  }
  if (!chimieFixed) console.log('   ❌ Impossible de trouver donateur Chimie');

  // ── Vérification finale ───────────────────────────────────────────────────
  const finalGaps = await prisma.$queryRaw<{ teacher: string; subject: string }[]>`
    SELECT u."lastName" || ' ' || u."firstName" as teacher, s.name as subject
    FROM "TeacherSubject" ts
    JOIN "TeacherProfile" tp ON tp.id = ts."teacherProfileId"
    JOIN "User" u ON u.id = tp."userId"
    JOIN "Subject" s ON s.id = ts."subjectId"
    WHERE u."schoolId" = ${SCHOOL_ID}
      AND NOT EXISTS (
        SELECT 1 FROM "TeachingAssignment" ta
        WHERE ta."teacherId" = u.id AND ta."subjectId" = ts."subjectId" AND ta."schoolId" = ${SCHOOL_ID}
      )
    ORDER BY u."lastName", s.name
  `;

  const mvogo = await prisma.teachingAssignment.count({ where: { teacherId: MVOGO_THERESE_ID, schoolId: SCHOOL_ID } });
  const edzoa = await prisma.teachingAssignment.count({ where: { teacherId: EDZOA_SIMON_ID, schoolId: SCHOOL_ID } });

  console.log(`\n📊 MVOGO Therese : ${mvogo} assignments | EDZOA Simon : ${edzoa} assignments`);

  if (finalGaps.length === 0) {
    console.log('\n🎯 TOUS les enseignants qualifiés enseignent toutes leurs matières !');
  } else {
    console.log(`\n⚠️  ${finalGaps.length} trou(s) restant(s) :`);
    for (const g of finalGaps) console.log(`   - ${g.teacher} → ${g.subject}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
