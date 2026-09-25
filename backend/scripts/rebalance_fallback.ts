/**
 * Rééquilibrage des assignments fallback (matières sans prof qualifié)
 * Round-robin équitable sur tous les 45 enseignants.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const SCHOOL_ID = 'f91c2219-13ad-465c-979e-41d448612894';

async function main() {
  console.log('\n⚖️  Rééquilibrage des assignments fallback\n');

  // Toutes les matières sans aucun prof qualifié déclaré dans ce lycée
  const qualifiedSubjectIds = (await prisma.teacherSubject.findMany({
    include: { teacherProfile: { select: { userId: true } } },
  }))
    .filter(ts => {
      // On ne garde que les profs de Nkolanga
      return true; // on filtre plus bas
    })
    .map(ts => ts.subjectId);

  const nkolangaTeachers = await prisma.user.findMany({
    where: { schoolId: SCHOOL_ID, role: 'TEACHER', isActive: true },
    select: { id: true, lastName: true, firstName: true },
  });
  const teacherSet = new Set(nkolangaTeachers.map(t => t.id));

  // Matières VRAIMENT qualifiées (au moins un prof de Nkolanga déclaré)
  const qualifiedRows = await prisma.teacherSubject.findMany({
    include: { teacherProfile: { select: { userId: true } }, subject: { select: { id: true } } },
  });
  const qualifiedSubjectSet = new Set(
    qualifiedRows.filter(r => teacherSet.has(r.teacherProfile.userId)).map(r => r.subject.id)
  );

  // Tous les assignments fallback (matière sans prof qualifié)
  const fallbackAssignments = await prisma.teachingAssignment.findMany({
    where: { schoolId: SCHOOL_ID },
    select: { id: true, classId: true, subjectId: true, teacherId: true },
  });

  const fallbacks = fallbackAssignments.filter(a => !qualifiedSubjectSet.has(a.subjectId));
  console.log(`   ${fallbacks.length} assignments fallback identifiés`);

  // Charge actuelle par enseignant (sur les assignments qualifiés seulement)
  const teacherLoad = new Map<string, number>();
  for (const t of nkolangaTeachers) teacherLoad.set(t.id, 0);
  for (const a of fallbackAssignments) {
    if (qualifiedSubjectSet.has(a.subjectId)) {
      teacherLoad.set(a.teacherId, (teacherLoad.get(a.teacherId) ?? 0) + 1);
    }
  }

  // Redistribuer les fallbacks en round-robin basé sur la charge totale
  // Trier les enseignants par charge croissante
  const sortedTeachers = [...nkolangaTeachers].sort((a, b) =>
    (teacherLoad.get(a.id) ?? 0) - (teacherLoad.get(b.id) ?? 0)
  );

  // Grouper les fallbacks par subjectId pour round-robin par matière
  const fallbacksBySubject = new Map<string, typeof fallbacks>();
  for (const f of fallbacks) {
    if (!fallbacksBySubject.has(f.subjectId)) fallbacksBySubject.set(f.subjectId, []);
    fallbacksBySubject.get(f.subjectId)!.push(f);
  }

  const updates: Array<{ id: string; newTeacherId: string }> = [];
  let rrIdx = 0; // index global dans sortedTeachers, round-robin

  for (const [, subjectFallbacks] of fallbacksBySubject) {
    for (const fa of subjectFallbacks) {
      // Choisir le prochain enseignant dans le round-robin trié par charge
      const chosen = sortedTeachers[rrIdx % sortedTeachers.length]!;
      rrIdx++;
      // Mettre à jour la charge
      teacherLoad.set(chosen.id, (teacherLoad.get(chosen.id) ?? 0) + 1);
      if (fa.teacherId !== chosen.id) {
        updates.push({ id: fa.id, newTeacherId: chosen.id });
      }
    }
    // Re-trier après chaque matière pour garder l'équilibre
    sortedTeachers.sort((a, b) => (teacherLoad.get(a.id) ?? 0) - (teacherLoad.get(b.id) ?? 0));
    rrIdx = 0; // reset l'index après re-tri
  }

  console.log(`   ${updates.length} reassignations nécessaires`);

  // Appliquer les mises à jour
  for (const u of updates) {
    await prisma.teachingAssignment.update({
      where: { id: u.id },
      data: { teacherId: u.newTeacherId, source: 'MANUAL', createdAt: new Date() },
    });
  }

  // Vérification finale
  const finalLoads = new Map<string, number>();
  for (const t of nkolangaTeachers) finalLoads.set(t.id, 0);
  const allFinal = await prisma.teachingAssignment.findMany({ where: { schoolId: SCHOOL_ID }, select: { teacherId: true } });
  for (const a of allFinal) finalLoads.set(a.teacherId, (finalLoads.get(a.teacherId) ?? 0) + 1);

  const loads = [...finalLoads.values()];
  const min = Math.min(...loads);
  const max = Math.max(...loads);
  const avg = loads.reduce((s, n) => s + n, 0) / loads.length;

  // Top 5 chargés
  const ranked = [...finalLoads.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log('\n📊 Distribution finale :');
  console.log(`   min=${min}  max=${max}  avg=${avg.toFixed(1)}`);
  console.log('\n🔝 Top 5 enseignants les plus chargés :');
  for (const [tid, n] of ranked) {
    const t = nkolangaTeachers.find(x => x.id === tid);
    console.log(`   ${t?.lastName} ${t?.firstName} : ${n} assignments`);
  }
  console.log('\n✅ Rééquilibrage terminé\n');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
