/**
 * Correction des 8 trous restants :
 * - Profs à plafond (15) : swap d'une matière surreprésentée → libérer une place → matière manquante
 * - TSALA Luc / Algo : ajouter une classe supplémentaire si possible
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const SCHOOL_ID = 'f91c2219-13ad-465c-979e-41d448612894';

type Assignment = { id: string; teacherId: string; subjectId: string; classId: string };

async function main() {
  console.log('\n🔧 Correction des trous restants (profs à plafond)\n');

  const teachers = await prisma.user.findMany({
    where: { schoolId: SCHOOL_ID, role: 'TEACHER', isActive: true },
    select: { id: true, firstName: true, lastName: true },
  });
  const teacherMap = new Map(teachers.map(t => [t.id, `${t.lastName} ${t.firstName}`]));
  const teacherIds = new Set(teachers.map(t => t.id));

  // Qualifications
  const qualRows = await prisma.teacherSubject.findMany({
    select: { subjectId: true, teacherProfile: { select: { userId: true } } },
  });
  const qualFor = new Map<string, Set<string>>(); // subjectId → Set<teacherId>
  for (const r of qualRows) {
    const uid = r.teacherProfile.userId;
    if (!teacherIds.has(uid)) continue;
    if (!qualFor.has(r.subjectId)) qualFor.set(r.subjectId, new Set());
    qualFor.get(r.subjectId)!.add(uid);
  }

  // Assignments actuels
  let assignments: Assignment[] = await prisma.teachingAssignment.findMany({
    where: { schoolId: SCHOOL_ID },
    select: { id: true, teacherId: true, subjectId: true, classId: true },
  });

  const timetables = await prisma.timetable.findMany({
    where: { schoolId: SCHOOL_ID },
    select: { id: true, classId: true },
  });
  const ttByClass = new Map(timetables.map(t => [t.classId, t.id]));

  // Sujets avec nom
  const subjects = await prisma.subject.findMany({
    where: { schoolId: SCHOOL_ID },
    select: { id: true, name: true },
  });
  const subjectName = new Map(subjects.map(s => [s.id, s.name]));

  // Identifie les trous restants
  const getRemainingGaps = (asgns: Assignment[]) => {
    const teacherSubjectCount = new Map<string, Set<string>>();
    for (const a of asgns) {
      const k = `${a.teacherId}|${a.subjectId}`;
      if (!teacherSubjectCount.has(k)) teacherSubjectCount.set(k, new Set());
      teacherSubjectCount.get(k)!.add(a.classId);
    }
    const gaps: { teacherId: string; subjectId: string }[] = [];
    for (const [uid, subjIds] of qualFor.entries()) {
      // Reconstruct from qualFor: subjectId→teacherId
    }
    // Rebuild from qualRows
    const qualByTeacher = new Map<string, Set<string>>();
    for (const r of qualRows) {
      const uid = r.teacherProfile.userId;
      if (!teacherIds.has(uid)) continue;
      if (!qualByTeacher.has(uid)) qualByTeacher.set(uid, new Set());
      qualByTeacher.get(uid)!.add(r.subjectId);
    }
    for (const [tid, sids] of qualByTeacher) {
      for (const sid of sids) {
        const k = `${tid}|${sid}`;
        if (!teacherSubjectCount.has(k) || teacherSubjectCount.get(k)!.size === 0) {
          gaps.push({ teacherId: tid, subjectId: sid });
        }
      }
    }
    return gaps;
  };

  const gaps = getRemainingGaps(assignments);
  console.log(`   ${gaps.length} trous à corriger\n`);

  let fixed = 0;
  let skipped = 0;

  for (const gap of gaps) {
    const tName = teacherMap.get(gap.teacherId) ?? gap.teacherId;
    const sName = subjectName.get(gap.subjectId) ?? gap.subjectId;

    // Charge actuelle du bénéficiaire
    const recipientAssignments = assignments.filter(a => a.teacherId === gap.teacherId);
    const recipientLoad = recipientAssignments.length;

    if (recipientLoad < 15) {
      // Devrait déjà être corrigé — chercher donateur direct
      const qualTeachers = [...(qualFor.get(gap.subjectId) ?? [])].filter(tid => tid !== gap.teacherId);
      const donors = qualTeachers
        .map(tid => ({
          tid,
          classIds: assignments.filter(a => a.teacherId === tid && a.subjectId === gap.subjectId).map(a => a.classId),
        }))
        .filter(d => d.classIds.length >= 2)
        .sort((a, b) => b.classIds.length - a.classIds.length);

      if (donors.length === 0) {
        console.log(`   ❌ ${tName} → ${sName} : pas de donateur`);
        skipped++;
        continue;
      }

      const donor = donors[0]!;
      const classToMove = donor.classIds[donor.classIds.length - 1]!;
      const aToMove = assignments.find(a => a.teacherId === donor.tid && a.subjectId === gap.subjectId && a.classId === classToMove)!;

      await prisma.teachingAssignment.update({ where: { id: aToMove.id }, data: { teacherId: gap.teacherId, source: 'MANUAL', createdAt: new Date() } });
      const ttId = ttByClass.get(classToMove);
      let slotCount = 0;
      if (ttId) {
        const r = await prisma.timetableSlot.updateMany({
          where: { timetableId: ttId, teacherId: donor.tid, subjectId: gap.subjectId },
          data: { teacherId: gap.teacherId },
        });
        slotCount = r.count;
      }
      assignments = assignments.map(a => a.id === aToMove.id ? { ...a, teacherId: gap.teacherId } : a);
      console.log(`   ✓ ${tName} ← ${sName} (de ${teacherMap.get(donor.tid)}, ${slotCount} slots)`);
      fixed++;
      continue;
    }

    // Bénéficiaire à 15 : swap d'une matière surreprésentée
    // Trouver la matière de ce prof avec le plus de classes (> 1)
    const subjectCounts = new Map<string, Assignment[]>();
    for (const a of recipientAssignments) {
      if (!subjectCounts.has(a.subjectId)) subjectCounts.set(a.subjectId, []);
      subjectCounts.get(a.subjectId)!.push(a);
    }

    // Matières dont il a ≥ 2 classes ET pour lesquelles un autre qualifié peut reprendre
    let swapDone = false;
    const sortedSubjects = [...subjectCounts.entries()]
      .filter(([sid, arr]) => sid !== gap.subjectId && arr.length >= 2)
      .sort((a, b) => b[1].length - a[1].length);

    for (const [surplusSubjectId, surplusAssignments] of sortedSubjects) {
      // Trouver un repreneur qualifié pour surplusSubjectId, pas à 15
      const repreneurs = [...(qualFor.get(surplusSubjectId) ?? [])]
        .filter(tid => tid !== gap.teacherId)
        .map(tid => ({ tid, load: assignments.filter(a => a.teacherId === tid).length }))
        .filter(r => r.load < 15)
        .sort((a, b) => a.load - b.load);

      if (repreneurs.length === 0) continue;

      const repreneur = repreneurs[0]!;
      const aToSwap = surplusAssignments[surplusAssignments.length - 1]!; // retirer le dernier

      // Trouver une classe pour la matière manquante du bénéficiaire
      // (une classe où cette matière existe mais est assignée à quelqu'un d'autre avec ≥ 2)
      const donorsForMissing = [...(qualFor.get(gap.subjectId) ?? [])]
        .filter(tid => tid !== gap.teacherId)
        .flatMap(tid => assignments
          .filter(a => a.teacherId === tid && a.subjectId === gap.subjectId)
          .map(a => ({ tid, aId: a.id, classId: a.classId, count: assignments.filter(x => x.teacherId === tid && x.subjectId === gap.subjectId).length }))
        )
        .filter(d => d.count >= 2)
        .sort((a, b) => b.count - a.count);

      if (donorsForMissing.length === 0) continue;

      const donorForMissing = donorsForMissing[0]!;

      // Étape 1 : retirer un surplus du bénéficiaire → repreneur
      await prisma.teachingAssignment.update({ where: { id: aToSwap.id }, data: { teacherId: repreneur.tid, source: 'MANUAL', createdAt: new Date() } });
      const ttId1 = ttByClass.get(aToSwap.classId);
      if (ttId1) {
        await prisma.timetableSlot.updateMany({
          where: { timetableId: ttId1, teacherId: gap.teacherId, subjectId: surplusSubjectId },
          data: { teacherId: repreneur.tid },
        });
      }
      assignments = assignments.map(a => a.id === aToSwap.id ? { ...a, teacherId: repreneur.tid } : a);
      console.log(`   ↔  ${tName} cède ${subjectName.get(surplusSubjectId)} à ${teacherMap.get(repreneur.tid)}`);

      // Étape 2 : donner la matière manquante au bénéficiaire
      await prisma.teachingAssignment.update({ where: { id: donorForMissing.aId }, data: { teacherId: gap.teacherId, source: 'MANUAL', createdAt: new Date() } });
      const ttId2 = ttByClass.get(donorForMissing.classId);
      let slotCount = 0;
      if (ttId2) {
        const r = await prisma.timetableSlot.updateMany({
          where: { timetableId: ttId2, teacherId: donorForMissing.tid, subjectId: gap.subjectId },
          data: { teacherId: gap.teacherId },
        });
        slotCount = r.count;
      }
      assignments = assignments.map(a => a.id === donorForMissing.aId ? { ...a, teacherId: gap.teacherId } : a);
      console.log(`   ✓ ${tName} ← ${sName} (de ${teacherMap.get(donorForMissing.tid)}, ${slotCount} slots)`);

      fixed++;
      swapDone = true;
      break;
    }

    if (!swapDone) {
      console.log(`   ❌ ${tName} → ${sName} : impossible (plafond + pas d'échange viable)`);
      skipped++;
    }
  }

  console.log(`\n✅ ${fixed} trous corrigés | ❌ ${skipped} impossibles\n`);

  // Rapport final
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

  if (finalGaps.length === 0) {
    console.log('🎯 Tous les enseignants qualifiés enseignent toutes leurs matières !');
  } else {
    console.log(`⚠️  ${finalGaps.length} trou(s) restant(s) :`);
    for (const g of finalGaps) console.log(`   - ${g.teacher} → ${g.subject}`);
  }

  // Distribution finale
  const loads = await prisma.$queryRaw<{ name: string; nb: bigint }[]>`
    SELECT u."lastName" || ' ' || u."firstName" as name, COUNT(ta.id) as nb
    FROM "User" u LEFT JOIN "TeachingAssignment" ta ON ta."teacherId" = u.id AND ta."schoolId" = ${SCHOOL_ID}
    WHERE u."schoolId" = ${SCHOOL_ID} AND u.role = 'TEACHER' AND u."isActive" = true
    GROUP BY u.id, u."lastName", u."firstName"
    ORDER BY nb DESC LIMIT 5
  `;
  console.log('\n📊 Top 5 chargés après correction :');
  for (const l of loads) console.log(`   ${l.name} : ${l.nb}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
