/**
 * Correction des "trous de qualification" :
 * Tout enseignant qualifié pour une matière (TeacherSubject) doit avoir
 * AU MOINS UN assignment dans cette matière.
 *
 * Stratégie : pour chaque (teacher, subject) manquant,
 * trouver un autre enseignant qualifié qui en a ≥ 2 et lui en retirer un.
 * Puis mettre à jour TeachingAssignment + TimetableSlot correspondant.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const SCHOOL_ID = 'f91c2219-13ad-465c-979e-41d448612894';

async function main() {
  console.log('\n🔍 Analyse des trous de qualification...\n');

  // Charger tous les enseignants du lycée
  const teachers = await prisma.user.findMany({
    where: { schoolId: SCHOOL_ID, role: 'TEACHER', isActive: true },
    select: { id: true, firstName: true, lastName: true },
  });
  const teacherIds = new Set(teachers.map(t => t.id));

  // Qualifications déclarées (TeacherSubject) pour les enseignants du lycée
  const qualRows = await prisma.teacherSubject.findMany({
    select: {
      subjectId: true,
      teacherProfile: { select: { userId: true } },
      subject: { select: { name: true } },
    },
  });
  // qualified: teacherId → Set<subjectId>
  const qualifiedSubjects = new Map<string, Set<string>>();
  const subjectNames = new Map<string, string>();
  for (const r of qualRows) {
    const uid = r.teacherProfile.userId;
    if (!teacherIds.has(uid)) continue;
    if (!qualifiedSubjects.has(uid)) qualifiedSubjects.set(uid, new Set());
    qualifiedSubjects.get(uid)!.add(r.subjectId);
    subjectNames.set(r.subjectId, r.subject.name);
  }

  // Assignments actuels : teacherId → Map<subjectId, classId[]>
  const assignments = await prisma.teachingAssignment.findMany({
    where: { schoolId: SCHOOL_ID },
    select: { id: true, teacherId: true, subjectId: true, classId: true },
  });

  const teacherSubjectClasses = new Map<string, Map<string, string[]>>();
  const assignmentByTCS = new Map<string, string>(); // key=teacherId|subjectId|classId → assignmentId
  for (const a of assignments) {
    if (!teacherSubjectClasses.has(a.teacherId))
      teacherSubjectClasses.set(a.teacherId, new Map());
    const m = teacherSubjectClasses.get(a.teacherId)!;
    if (!m.has(a.subjectId)) m.set(a.subjectId, []);
    m.get(a.subjectId)!.push(a.classId);
    assignmentByTCS.set(`${a.teacherId}|${a.subjectId}|${a.classId}`, a.id);
  }

  // Trouver les trous : (teacher qualifié, subject) avec 0 classes assignées
  const gaps: { teacherId: string; subjectId: string; teacherName: string; subjectName: string }[] = [];
  for (const [teacherId, subjects] of qualifiedSubjects) {
    for (const subjectId of subjects) {
      const count = teacherSubjectClasses.get(teacherId)?.get(subjectId)?.length ?? 0;
      if (count === 0) {
        const t = teachers.find(t => t.id === teacherId)!;
        gaps.push({
          teacherId,
          subjectId,
          teacherName: `${t.lastName} ${t.firstName}`,
          subjectName: subjectNames.get(subjectId) ?? subjectId,
        });
      }
    }
  }

  console.log(`   ${gaps.length} trous de qualification détectés :\n`);
  for (const g of gaps) console.log(`   - ${g.teacherName} → ${g.subjectName}`);

  if (gaps.length === 0) { console.log('\n✅ Aucun trou !'); return; }

  // Pour chaque trou, trouver un donateur qualifié (même subject, ≥ 2 classes)
  // et lui retirer une classe → la donner au prof qui manque
  let fixed = 0;
  let skipped = 0;

  // Charge totale actuelle par enseignant (pour ne pas dépasser 15)
  const totalLoad = new Map<string, number>();
  for (const t of teachers) {
    totalLoad.set(t.id, assignments.filter(a => a.teacherId === t.id).length);
  }

  // Timetables par classe
  const timetables = await prisma.timetable.findMany({
    where: { schoolId: SCHOOL_ID },
    select: { id: true, classId: true },
  });
  const ttByClass = new Map(timetables.map(t => [t.classId, t.id]));

  for (const gap of gaps) {
    // Vérifier que le bénéficiaire n'est pas déjà à 15
    const recipientLoad = totalLoad.get(gap.teacherId) ?? 0;
    if (recipientLoad >= 15) {
      console.log(`\n   ⚠️  ${gap.teacherName} déjà à ${recipientLoad} assignments — skipped`);
      skipped++;
      continue;
    }

    // Trouver tous les enseignants qualifiés pour ce subject avec ≥ 2 classes
    const donors: { teacherId: string; classId: string; load: number }[] = [];
    for (const [tid, smap] of teacherSubjectClasses) {
      if (tid === gap.teacherId) continue;
      const classes = smap.get(gap.subjectId) ?? [];
      if (classes.length >= 2) {
        for (const classId of classes) {
          donors.push({ teacherId: tid, classId, load: totalLoad.get(tid) ?? 0 });
        }
      }
    }

    if (donors.length === 0) {
      console.log(`\n   ❌ Pas de donateur pour ${gap.teacherName} → ${gap.subjectName}`);
      skipped++;
      continue;
    }

    // Choisir le donateur avec le plus d'assignments pour ce subject (pour lisser)
    const donorMap = new Map<string, number>();
    for (const d of donors) {
      donorMap.set(d.teacherId, (donorMap.get(d.teacherId) ?? 0) + 1);
    }
    // Prendre le donateur qui a le plus de classes dans ce subject
    const [bestDonorId] = [...donorMap.entries()].sort((a, b) => b[1] - a[1])[0]!;
    const donorClasses = teacherSubjectClasses.get(bestDonorId)?.get(gap.subjectId) ?? [];
    const classToMove = donorClasses[donorClasses.length - 1]!; // prendre le dernier

    const aId = assignmentByTCS.get(`${bestDonorId}|${gap.subjectId}|${classToMove}`);
    if (!aId) { console.log(`   ❌ Assignment ID introuvable`); skipped++; continue; }

    const donorName = teachers.find(t => t.id === bestDonorId)!;

    // 1. Mettre à jour TeachingAssignment
    await prisma.teachingAssignment.update({
      where: { id: aId },
      data: { teacherId: gap.teacherId, source: 'MANUAL', createdAt: new Date() },
    });

    // 2. Mettre à jour les TimetableSlots correspondants
    const ttId = ttByClass.get(classToMove);
    if (ttId) {
      const slotsUpdated = await prisma.timetableSlot.updateMany({
        where: { timetableId: ttId, teacherId: bestDonorId, subjectId: gap.subjectId },
      data: { teacherId: gap.teacherId },
      });
      console.log(`\n   ✓ ${gap.teacherName} ← ${gap.subjectName} (était ${donorName.lastName} ${donorName.firstName}, ${slotsUpdated.count} slots mis à jour)`);
    } else {
      console.log(`\n   ✓ ${gap.teacherName} ← ${gap.subjectName} (pas de timetable pour cette classe)`);
    }

    // Mettre à jour l'index en mémoire
    const donorClasses2 = teacherSubjectClasses.get(bestDonorId)?.get(gap.subjectId) ?? [];
    const idx = donorClasses2.indexOf(classToMove);
    if (idx !== -1) donorClasses2.splice(idx, 1);

    if (!teacherSubjectClasses.has(gap.teacherId))
      teacherSubjectClasses.set(gap.teacherId, new Map());
    const recipientMap = teacherSubjectClasses.get(gap.teacherId)!;
    if (!recipientMap.has(gap.subjectId)) recipientMap.set(gap.subjectId, []);
    recipientMap.get(gap.subjectId)!.push(classToMove);

    totalLoad.set(gap.teacherId, recipientLoad + 1);
    totalLoad.set(bestDonorId, (totalLoad.get(bestDonorId) ?? 1) - 1);
    assignmentByTCS.set(`${gap.teacherId}|${gap.subjectId}|${classToMove}`, aId);
    assignmentByTCS.delete(`${bestDonorId}|${gap.subjectId}|${classToMove}`);

    fixed++;
  }

  console.log(`\n\n✅ ${fixed} trous corrigés | ⚠️ ${skipped} impossibles`);

  // Vérification finale
  const remaining = await prisma.$queryRaw<{ teacher: string; subject: string }[]>`
    SELECT u."lastName" || ' ' || u."firstName" as teacher, s.name as subject
    FROM "TeacherSubject" ts
    JOIN "TeacherProfile" tp ON tp.id = ts."teacherProfileId"
    JOIN "User" u ON u.id = tp."userId"
    JOIN "Subject" s ON s.id = ts."subjectId"
    WHERE u."schoolId" = ${SCHOOL_ID}
      AND NOT EXISTS (
        SELECT 1 FROM "TeachingAssignment" ta
        WHERE ta."teacherId" = u.id
          AND ta."subjectId" = ts."subjectId"
          AND ta."schoolId" = ${SCHOOL_ID}
      )
    ORDER BY u."lastName", s.name
  `;
  if (remaining.length === 0) {
    console.log('\n🎯 Tous les enseignants qualifiés ont au moins 1 assignment par matière !');
  } else {
    console.log(`\n⚠️  ${remaining.length} trous restants :`);
    for (const r of remaining) console.log(`   - ${r.teacher} → ${r.subject}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
