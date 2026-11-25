/**
 * Patch des 23 assignments sans créneau dans les EDT.
 * Pour chaque assignment manquant :
 *   1. Trouver dans le timetable de la classe un slot où la matière apparaît en excès
 *      (> 1 occurrence) ET où l'enseignant est libre (pas dans une autre classe à ce moment).
 *   2. Remplacer ce slot (teacherId + subjectId) par l'assignment manquant.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SCHOOL_ID = 'f91c2219-13ad-465c-979e-41d448612894';

async function main() {
  console.log('\n🔧 Patch des assignments sans créneau\n');

  // 1. Trouver tous les assignments sans slot correspondant
  const allAssignments = await prisma.teachingAssignment.findMany({
    where: { schoolId: SCHOOL_ID },
    select: { id: true, classId: true, subjectId: true, teacherId: true },
  });

  const allSlots = await prisma.timetableSlot.findMany({
    where: { timetable: { schoolId: SCHOOL_ID } },
    select: {
      id: true, timetableId: true, teacherId: true, subjectId: true,
      dayOfWeek: true, startTime: true,
      timetable: { select: { classId: true } },
    },
  });

  // Index des slots par (classId, teacherId, subjectId) pour détection rapide
  type SlotInfo = typeof allSlots[0];
  const slotsByClassTeacherSubject = new Map<string, SlotInfo[]>();
  for (const slot of allSlots) {
    const k = `${slot.timetable.classId}|${slot.teacherId}|${slot.subjectId}`;
    if (!slotsByClassTeacherSubject.has(k)) slotsByClassTeacherSubject.set(k, []);
    slotsByClassTeacherSubject.get(k)!.push(slot);
  }

  // Trouver les assignments manquants
  const missing = allAssignments.filter(a => {
    const k = `${a.classId}|${a.teacherId}|${a.subjectId}`;
    return !slotsByClassTeacherSubject.has(k);
  });

  console.log(`   ${missing.length} assignments sans créneau détectés\n`);

  // Index slots par timetableId
  const slotsByTimetable = new Map<string, SlotInfo[]>();
  for (const slot of allSlots) {
    if (!slotsByTimetable.has(slot.timetableId)) slotsByTimetable.set(slot.timetableId, []);
    slotsByTimetable.get(slot.timetableId)!.push(slot);
  }

  // Index timetableId par classId
  const timetables = await prisma.timetable.findMany({
    where: { schoolId: SCHOOL_ID },
    select: { id: true, classId: true },
  });
  const timetableByClass = new Map(timetables.map(t => [t.classId, t.id]));

  // Pour chaque créneau, index des autres classes où cet enseignant est occupé à ce moment
  // teacherId|dayOfWeek|startTime → Set<classId>
  const teacherBusyAt = new Map<string, Set<string>>();
  for (const slot of allSlots) {
    if (!slot.teacherId) continue;
    const k = `${slot.teacherId}|${slot.dayOfWeek}|${slot.startTime}`;
    if (!teacherBusyAt.has(k)) teacherBusyAt.set(k, new Set());
    teacherBusyAt.get(k)!.add(slot.timetable.classId);
  }

  let patched = 0;
  let failed = 0;

  for (const ma of missing) {
    const ttId = timetableByClass.get(ma.classId);
    if (!ttId) { console.log(`   ⚠️  Pas de timetable pour classe ${ma.classId}`); failed++; continue; }

    const classSlots = slotsByTimetable.get(ttId) ?? [];

    // Compter les occurrences de chaque (teacherId, subjectId) dans ce timetable
    const occurrences = new Map<string, number>();
    for (const slot of classSlots) {
      const k = `${slot.teacherId}|${slot.subjectId}`;
      occurrences.set(k, (occurrences.get(k) ?? 0) + 1);
    }

    // Chercher un slot à remplacer :
    // - la paire (teacherId, subjectId) du slot apparaît >= 2 fois dans la classe (excess)
    // - l'enseignant manquant est libre à ce moment (pas dans une autre classe)
    let candidate: SlotInfo | null = null;

    for (const slot of classSlots) {
      const pairKey = `${slot.teacherId}|${slot.subjectId}`;
      const count = occurrences.get(pairKey) ?? 0;
      if (count < 2) continue; // pas en excès

      // L'enseignant manquant est-il libre à ce créneau ?
      const busyKey = `${ma.teacherId}|${slot.dayOfWeek}|${slot.startTime}`;
      const busyClasses = teacherBusyAt.get(busyKey) ?? new Set();
      // Libre si pas dans une autre classe (ou seulement dans cette classe elle-même)
      const isFreed = [...busyClasses].every(cid => cid === ma.classId);

      if (isFreed) {
        candidate = slot;
        occurrences.set(pairKey, count - 1); // on "prend" une occurrence
        break;
      }
    }

    if (!candidate) {
      // Fallback : prendre n'importe quel slot en excès même si l'enseignant est occupé ailleurs
      // (on accepte 1 conflit plutôt que 0 cours)
      for (const slot of classSlots) {
        const pairKey = `${slot.teacherId}|${slot.subjectId}`;
        const count = occurrences.get(pairKey) ?? 0;
        if (count < 2) continue;
        candidate = slot;
        occurrences.set(pairKey, count - 1);
        console.log(`   ⚠️  Conflit accepté : ${ma.teacherId} occupe déjà jour${slot.dayOfWeek} ${slot.startTime}`);
        break;
      }
    }

    if (!candidate) {
      // Dernier recours : remplacer n'importe quel slot (même sans excès)
      const busyKey0 = `${ma.teacherId}|${classSlots[0]?.dayOfWeek}|${classSlots[0]?.startTime}`;
      candidate = classSlots[0] ?? null;
      console.log(`   ❌ Aucun slot en excès pour ${ma.teacherId} dans classe ${ma.classId} — remplacement forcé`);
    }

    if (!candidate) { console.log(`   ❌ Impossible de patcher ${ma.id}`); failed++; continue; }

    // Remplacer le slot
    await prisma.timetableSlot.update({
      where: { id: candidate.id },
      data: { teacherId: ma.teacherId, subjectId: ma.subjectId },
    });

    // Mettre à jour l'index teacherBusyAt (ancien enseignant libéré, nouveau occupé)
    const oldBusy = `${candidate.teacherId}|${candidate.dayOfWeek}|${candidate.startTime}`;
    teacherBusyAt.get(oldBusy)?.delete(ma.classId);
    const newBusy = `${ma.teacherId}|${candidate.dayOfWeek}|${candidate.startTime}`;
    if (!teacherBusyAt.has(newBusy)) teacherBusyAt.set(newBusy, new Set());
    teacherBusyAt.get(newBusy)!.add(ma.classId);

    // Mettre à jour slotsByTimetable en mémoire
    candidate.teacherId = ma.teacherId;
    candidate.subjectId = ma.subjectId;

    patched++;
    console.log(`   ✓ Patché: ${ma.teacherId} ← classe ${ma.classId} subj ${ma.subjectId}`);
  }

  console.log(`\n✅ ${patched} patchés | ❌ ${failed} échecs`);

  // Vérification finale
  const remaining = await prisma.$queryRaw<{ cnt: bigint }[]>`
    SELECT COUNT(*) as cnt
    FROM "TeachingAssignment" ta
    WHERE ta."schoolId" = ${SCHOOL_ID}
      AND NOT EXISTS (
        SELECT 1 FROM "TimetableSlot" ts
        JOIN "Timetable" t ON t.id = ts."timetableId"
        WHERE t."classId" = ta."classId"
          AND t."schoolId" = ${SCHOOL_ID}
          AND ts."teacherId" = ta."teacherId"
          AND ts."subjectId" = ta."subjectId"
      )
  `;
  console.log(`\n📊 Assignments encore sans créneau : ${remaining[0]?.cnt ?? '?'}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
