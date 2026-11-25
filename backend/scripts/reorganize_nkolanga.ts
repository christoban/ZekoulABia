/**
 * Réorganisation complète du Lycée de Nkolanga
 * 1. Reconstruire TeachingAssignments par spécialité (TeacherSubject)
 * 2. Désigner les Professeurs Principaux (un par classe)
 *
 * Usage : bun run prisma/reorganize_nkolanga.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SCHOOL_ID = 'f91c2219-13ad-465c-979e-41d448612894';

const CYCLE1_ORDER = ['6e', '5e', '4e', '3e'];

function effectiveSerieCode(cls: { level: string | null; serie: string | null; filiere?: string | null }): string | null {
  if (cls.serie) return cls.serie;
  if (cls.filiere) return cls.filiere;
  if (cls.level && CYCLE1_ORDER.includes(cls.level)) return 'FR_GENERAL';
  return null;
}

function leastLoaded(teacherLoad: Map<string, number>): string {
  let minLoad = Infinity;
  let chosen = '';
  for (const [tid, load] of teacherLoad) {
    if (load < minLoad) { minLoad = load; chosen = tid; }
  }
  return chosen;
}

async function main() {
  console.log('\n🏫 Réorganisation du Lycée de Nkolanga\n');

  // ─── 1. Charger les données de base ──────────────────────────────────────
  const teachers = await prisma.user.findMany({
    where: { schoolId: SCHOOL_ID, role: 'TEACHER', isActive: true },
    select: { id: true, firstName: true, lastName: true },
  });

  const allClasses = await prisma.class.findMany({
    where: { schoolId: SCHOOL_ID },
    select: { id: true, name: true, level: true, serie: true, filiere: true, academicYearId: true } as const,
  });
  const academicYearByClass = new Map(allClasses.map((c) => [c.id, c.academicYearId]));

  const coeffs = await prisma.subjectCoefficient.findMany({
    where: { schoolId: SCHOOL_ID },
    select: { classLevel: true, serieCode: true, subjectId: true },
  });

  const classOverrides = await prisma.classSubjectOverride.findMany({
    where: { schoolId: SCHOOL_ID },
    select: { classId: true, subjectId: true },
  });

  const teacherSubjectRows = await prisma.teacherSubject.findMany({
    include: {
      teacherProfile: { select: { userId: true } },
      subject: { select: { id: true, name: true } },
    },
  });

  const teacherSet = new Set(teachers.map((t) => t.id));
  console.log(`   ${teachers.length} enseignants | ${allClasses.length} classes`);
  console.log(`   ${coeffs.length} coefficients | ${classOverrides.length} overrides`);
  console.log(`   ${teacherSubjectRows.length} TeacherSubject déclarés`);

  // ─── 2. subjectId → [userId] qualifiés ───────────────────────────────────
  const qualifiedForSubject = new Map<string, string[]>();
  for (const ts of teacherSubjectRows) {
    const userId = ts.teacherProfile.userId;
    if (!teacherSet.has(userId)) continue;
    if (!qualifiedForSubject.has(ts.subject.id)) {
      qualifiedForSubject.set(ts.subject.id, []);
    }
    qualifiedForSubject.get(ts.subject.id)!.push(userId);
  }
  console.log(`\n   ${qualifiedForSubject.size} matières avec enseignant qualifié déclaré`);

  // ─── 3. Générer les paires (classId, subjectId) ───────────────────────────
  const levelSerieSubjects = new Map<string, Set<string>>();
  for (const c of coeffs) {
    const key = `${c.classLevel}||${c.serieCode ?? '__NULL__'}`;
    if (!levelSerieSubjects.has(key)) levelSerieSubjects.set(key, new Set());
    levelSerieSubjects.get(key)!.add(c.subjectId);
  }

  const overrideByClass = new Map<string, Set<string>>();
  for (const o of classOverrides) {
    if (!overrideByClass.has(o.classId)) overrideByClass.set(o.classId, new Set());
    overrideByClass.get(o.classId)!.add(o.subjectId);
  }

  const pairsBySubject = new Map<string, Array<{ classId: string; subjectId: string }>>();

  for (const cls of allClasses) {
    if (!cls.level) continue;
    const serie = effectiveSerieCode(cls);
    const key = `${cls.level}||${serie ?? '__NULL__'}`;
    const subjectIds = levelSerieSubjects.get(key) ?? new Set<string>();
    const overrides = overrideByClass.get(cls.id) ?? new Set<string>();

    for (const sid of subjectIds) {
      if (overrides.has(sid)) continue;
      if (!pairsBySubject.has(sid)) pairsBySubject.set(sid, []);
      pairsBySubject.get(sid)!.push({ classId: cls.id, subjectId: sid });
    }
    for (const sid of overrides) {
      if (!pairsBySubject.has(sid)) pairsBySubject.set(sid, []);
      pairsBySubject.get(sid)!.push({ classId: cls.id, subjectId: sid });
    }
  }

  const totalPairs = [...pairsBySubject.values()].reduce((s, arr) => s + arr.length, 0);
  console.log(`   ${totalPairs} paires (classe × matière) à assigner\n`);

  // ─── 4. Assigner intelligemment ───────────────────────────────────────────
  const teacherLoad = new Map<string, number>();
  for (const t of teachers) teacherLoad.set(t.id, 0);

  const toCreate: Array<{ classId: string; subjectId: string; teacherId: string; schoolId: string; academicYearId: string }> = [];
  let qualifHits = 0;
  let fallbackHits = 0;

  const MAX_LOAD = 15; // plafond raisonnable par enseignant

  // Sélectionner le prof qualifié le moins chargé, sous le plafond
  function bestQualified(qualified: string[]): string | null {
    const underCap = qualified.filter(tid => (teacherLoad.get(tid) ?? 0) < MAX_LOAD);
    if (underCap.length === 0) return null; // tous au plafond → fallback
    let best = underCap[0]!;
    let bestLoad = teacherLoad.get(best) ?? 0;
    for (const tid of underCap) {
      const l = teacherLoad.get(tid) ?? 0;
      if (l < bestLoad) { bestLoad = l; best = tid; }
    }
    return best;
  }

  for (const [subjectId, subjectPairs] of pairsBySubject) {
    const qualified = qualifiedForSubject.get(subjectId) ?? [];

    for (const pair of subjectPairs) {
      let chosenTeacher: string;
      const q = qualified.length > 0 ? bestQualified(qualified) : null;

      if (q !== null) {
        chosenTeacher = q;
        qualifHits++;
      } else {
        chosenTeacher = leastLoaded(teacherLoad);
        fallbackHits++;
      }

      toCreate.push({
        classId: pair.classId,
        subjectId,
        teacherId: chosenTeacher,
        schoolId: SCHOOL_ID,
        academicYearId: academicYearByClass.get(pair.classId)!,
      });
      teacherLoad.set(chosenTeacher, (teacherLoad.get(chosenTeacher) ?? 0) + 1);
    }
  }

  console.log(`   ✅ ${qualifHits} assignments par qualif | ⚠️  ${fallbackHits} fallback`);

  // ─── 5. Sauvegarder ───────────────────────────────────────────────────────
  console.log('\n💾 Suppression anciens assignments...');
  await prisma.teachingAssignment.deleteMany({ where: { schoolId: SCHOOL_ID } });
  console.log(`💾 Création de ${toCreate.length} nouveaux assignments...`);
  await prisma.teachingAssignment.createMany({ data: toCreate.map((assignment) => ({ ...assignment, source: 'MANUAL' as const, createdAt: new Date() })), skipDuplicates: true });
  console.log(`   ✓ Fait`);

  // ─── 6. Distribution ──────────────────────────────────────────────────────
  const loads = [...teacherLoad.values()].filter((n) => n > 0);
  const min = Math.min(...loads);
  const max = Math.max(...loads);
  const avg = loads.reduce((s, n) => s + n, 0) / loads.length;
  console.log(`\n📊 Assignments/prof : min=${min} max=${max} avg=${avg.toFixed(1)}`);

  // ─── 7. Professeurs Principaux ────────────────────────────────────────────
  console.log('\n🏅 Désignation des Professeurs Principaux...');
  await prisma.class.updateMany({ where: { schoolId: SCHOOL_ID }, data: { professorPrincipalId: null } });

  const ppAssignments = await prisma.teachingAssignment.findMany({
    where: { schoolId: SCHOOL_ID },
    select: { classId: true, teacherId: true },
  });

  const classTeacherCount = new Map<string, Map<string, number>>();
  for (const a of ppAssignments) {
    if (!classTeacherCount.has(a.classId)) classTeacherCount.set(a.classId, new Map());
    const m = classTeacherCount.get(a.classId)!;
    m.set(a.teacherId, (m.get(a.teacherId) ?? 0) + 1);
  }

  const usedPP = new Set<string>();
  let ppCount = 0;
  const classesWithoutPP: string[] = [];

  const sortedClasses = [...allClasses].sort((a, b) => a.name.localeCompare(b.name));

  for (const cls of sortedClasses) {
    const counts = classTeacherCount.get(cls.id);
    if (!counts || counts.size === 0) { classesWithoutPP.push(cls.name); continue; }

    const ranked = [...counts.entries()]
      .filter(([tid]) => !usedPP.has(tid))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

    if (ranked.length === 0) { classesWithoutPP.push(cls.name); continue; }

    const ppId = ranked[0]![0];
    await prisma.class.update({ where: { id: cls.id }, data: { professorPrincipalId: ppId } });
    usedPP.add(ppId);
    ppCount++;
  }

  console.log(`   ✓ ${ppCount} PP désignés`);
  if (classesWithoutPP.length > 0) {
    console.log(`   ⚠️  Sans PP : ${classesWithoutPP.join(', ')}`);
  }

  // ─── 8. Rapport final ─────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════╗');
  console.log('║  ✅ RÉORGANISATION TERMINÉE       ║');
  console.log(`║  ${String(toCreate.length).padEnd(5)} assignments créés         ║`);
  console.log(`║  ${String(qualifHits).padEnd(5)} par spécialité (${Math.round(qualifHits / toCreate.length * 100)}%)   ║`);
  console.log(`║  ${String(ppCount).padEnd(5)} Professeurs Principaux    ║`);
  console.log('╚══════════════════════════════════╝\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
