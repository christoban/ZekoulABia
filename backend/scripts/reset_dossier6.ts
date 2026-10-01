/**
 * Nettoyage ciblé du jeu de données du Dossier VI.
 *
 * Supprime UNIQUEMENT l'établissement créé par seed_dossier6.ts (identifié par son
 * sous-domaine) et toutes les données qui lui sont rattachées.
 *
 * Contrainte réelle du schéma (vérifiée sur pg_constraint) : 46 clés étrangères sont
 * en RESTRICT vers School/User/Class/Subject/... — dont `Enrollment.schoolId`, qui
 * empêche `school.delete()` tant qu'elle existe. D'où la suppression en 3 temps :
 *   1. boucle « jusqu'à stabilisation » sur les tables scopées par schoolId
 *      (l'ordre des foreign keys n'a alors plus d'importance) ;
 *   2. les 2 tables joignables qui bloquent la suppression des profils ;
 *   3. les comptes, puis l'établissement.
 *
 * Usage :
 *   DATABASE_URL="postgresql://postgres:2005@localhost:5432/zekoulabia_test?schema=public" \
 *     bun scripts/reset_dossier6.ts
 */

import { PrismaClient } from '@prisma/client';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const SCHOOL_SUBDOMAIN = 'lycee-pilote-dossier6';

if (process.env.NODE_ENV === 'production') {
  console.error('⛔ Interdit en production.');
  process.exit(1);
}
if (!/_test/.test(DATABASE_URL)) {
  console.error(`⛔ Base refusée : « ${DATABASE_URL} » ne contient pas « _test ».`);
  process.exit(1);
}

const prisma = new PrismaClient();

// Tables du schéma portant une colonne `schoolId` et référencant School/User en RESTRICT.
const TABLES_SCOPEES = [
  'academicEvent', 'announcement', 'anonymatCode', 'aPEETransaction', 'assessmentParticipation',
  'assessmentScope', 'attendance', 'bookLoan', 'bulletinValidationSession', 'classCouncilSession',
  'classPromotion', 'classSubjectOverride', 'disciplineCouncilSession', 'disciplineRecord', 'enrollment',
  'exam', 'examRegistration', 'ficheOrientation', 'grade', 'harmonizedAssessmentSession',
  'inscriptionMinesec', 'invoice', 'minedubStatisticalReport', 'notification', 'offlineQueue',
  'paiementEtablissement', 'paiementMinesec', 'payment', 'reportCard', 'statisticalSubmission',
  'studentFollowUpAction', 'studentPromotion', 'subjectCoefficient', 'submission', 'task', 'timetable',
] as const;

async function main() {
  const school = await prisma.school.findUnique({ where: { subdomain: SCHOOL_SUBDOMAIN } });
  if (!school) {
    console.log('ℹ️  Aucun établissement de test présent — rien à supprimer.');
    return;
  }
  const id = school.id;
  let total = 0;

  // 1. Tables scopées par schoolId — on repasse jusqu'à ne plus rien supprimer, ce qui
  //    rend l'ordre des suppressions indifférent (les cascades débloquent les tours suivants).
  for (let tour = 1; tour <= 10; tour++) {
    let n = 0;
    for (const model of TABLES_SCOPEES) {
      const r = await (prisma[model] as { deleteMany(a: unknown): Promise<{ count: number }> })
        .deleteMany({ where: { schoolId: id } });
      n += r.count;
    }
    total += n;
    if (n === 0) { if (tour > 1) console.log(`   stabilisé après ${tour - 1} tour(s)`); break; }
    console.log(`   tour ${tour} : ${n} ligne(s) supprimée(s)`);
  }

  // 2. Tables joignables qui bloquent la suppression des profils (RESTRICT sur
  //    TeacherProfile / ParentProfile, et sans colonne schoolId).
  const ts = await prisma.teacherSubject.deleteMany({ where: { teacherProfile: { user: { schoolId: id } } } });
  const ps = await prisma.parentStudent.deleteMany({ where: { parentProfile: { user: { schoolId: id } } } });
  total += ts.count + ps.count;
  if (ts.count) console.log(`   ${ts.count} × teacherSubject`);
  if (ps.count) console.log(`   ${ps.count} × parentStudent`);

  // 3. Comptes puis établissement.
  const users = await prisma.user.deleteMany({ where: { schoolId: id } });
  total += users.count;
  await prisma.school.delete({ where: { id } });

  console.log(`\n🗑️  Supprimé « ${school.name} » (${id}) — ${total} lignes, dont ${users.count} comptes.`);
  console.log('    Relancer seed_dossier6.ts pour recréer le jeu de données.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());