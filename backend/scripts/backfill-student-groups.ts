/**
 * Script one-shot — Backfill StudentGroupSet/StudentGroup/StudentGroupMembership depuis les
 * champs legacy StudentProfile.lv2SubjectId / pebsFiliere.
 *
 * Contexte : chantier "Modélisation Classe/Groupe/Salle/Séance" — LV2 et PEBS restent lus/écrits
 * via leurs champs historiques par le code existant, mais StudentGroupMembership devient la
 * source de vérité pour tout nouveau code (GenererSeancesGroupeUseCase, ResoudreParticipantsSeanceUseCase).
 * Les use cases qui écrivent lv2SubjectId/pebsFiliere synchronisent déjà cette table pour toute
 * NOUVELLE écriture — ce script rattrape les données déjà présentes en base.
 *
 * Usage : bun scripts/backfill-student-groups.ts
 *
 * Idempotent : peut être relancé sans effet de bord (find-or-create sur les GroupSet/Group par
 * code/nom, upsert sur les memberships par élève/GroupSet/année).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function ensureGroupSet(schoolId: string, code: string, name: string) {
  const existing = await prisma.studentGroupSet.findFirst({ where: { schoolId, code } });
  if (existing) return existing;
  return prisma.studentGroupSet.create({ data: { id: crypto.randomUUID(), schoolId, code, name } });
}

async function ensureGroup(groupSetId: string, name: string, subjectId?: string) {
  const existing = await prisma.studentGroup.findFirst({ where: { groupSetId, name } });
  if (existing) return existing;
  return prisma.studentGroup.create({ data: { id: crypto.randomUUID(), groupSetId, name, subjectId } });
}

async function upsertMembership(studentProfileId: string, groupId: string, groupSetId: string, academicYearId: string) {
  await prisma.studentGroupMembership.upsert({
    where: { studentProfileId_groupSetId_academicYearId: { studentProfileId, groupSetId, academicYearId } },
    create: { id: crypto.randomUUID(), studentProfileId, groupId, groupSetId, academicYearId },
    update: { groupId },
  });
}

async function backfillEcole(schoolId: string, schoolName: string): Promise<{ lv2: number; pebs: number }> {
  const anneeCourante = await prisma.academicYear.findFirst({
    where: { schoolId, isCurrent: true }, select: { id: true },
  });
  if (!anneeCourante) {
    console.warn(`⚠️  École "${schoolName}" : aucune année académique courante — LV2/PEBS non migrés pour cette école.`);
    return { lv2: 0, pebs: 0 };
  }

  // --- LV2 : un StudentGroup par matière isLV2=true, lié à cette matière ---
  let lv2Memberships = 0;
  const lv2Subjects = await prisma.subject.findMany({
    where: { schoolId, isLV2: true }, select: { id: true, name: true },
  });
  if (lv2Subjects.length > 0) {
    const lv2GroupSet = await ensureGroupSet(schoolId, 'LV2', 'LV2');
    const subjectToGroupId = new Map<string, string>();
    for (const subject of lv2Subjects) {
      const group = await ensureGroup(lv2GroupSet.id, subject.name, subject.id);
      subjectToGroupId.set(subject.id, group.id);
    }

    const studentsAvecLV2 = await prisma.studentProfile.findMany({
      where: { user: { schoolId }, lv2SubjectId: { not: null } },
      select: { id: true, lv2SubjectId: true },
    });
    for (const s of studentsAvecLV2) {
      const groupId = subjectToGroupId.get(s.lv2SubjectId!);
      if (!groupId) continue; // matière LV2 supprimée entre-temps — rien de sûr à faire
      await upsertMembership(s.id, groupId, lv2GroupSet.id, anneeCourante.id);
      lv2Memberships++;
    }
  }

  // --- PEBS : GroupSet "PROGRAMME", Groups "FR_PEBS"/"EN_PEBS" (mêmes valeurs que pebsFiliere) ---
  let pebsMemberships = 0;
  const studentsAvecPebs = await prisma.studentProfile.findMany({
    where: { user: { schoolId }, pebsFiliere: { not: null } },
    select: { id: true, pebsFiliere: true },
  });
  if (studentsAvecPebs.length > 0) {
    const programmeGroupSet = await ensureGroupSet(schoolId, 'PROGRAMME', 'Programme');
    const frPebsGroup = await ensureGroup(programmeGroupSet.id, 'FR_PEBS');
    const enPebsGroup = await ensureGroup(programmeGroupSet.id, 'EN_PEBS');
    const filiereToGroupId = new Map([['FR_PEBS', frPebsGroup.id], ['EN_PEBS', enPebsGroup.id]]);

    for (const s of studentsAvecPebs) {
      const groupId = filiereToGroupId.get(s.pebsFiliere!);
      if (!groupId) continue;
      await upsertMembership(s.id, groupId, programmeGroupSet.id, anneeCourante.id);
      pebsMemberships++;
    }
  }

  return { lv2: lv2Memberships, pebs: pebsMemberships };
}

async function main() {
  console.log('🚀 Backfill StudentGroupSet/StudentGroup/StudentGroupMembership (LV2 + PEBS)…\n');

  const schools = await prisma.school.findMany({ select: { id: true, name: true } });
  let totalLv2 = 0;
  let totalPebs = 0;

  for (const school of schools) {
    const resultat = await backfillEcole(school.id, school.name);
    totalLv2 += resultat.lv2;
    totalPebs += resultat.pebs;
    if (resultat.lv2 > 0 || resultat.pebs > 0) {
      console.log(`✅ École "${school.name}" : ${resultat.lv2} appartenance(s) LV2, ${resultat.pebs} appartenance(s) Programme (PEBS).`);
    }
  }

  console.log('\n──────────── Résumé ────────────');
  console.log(`  Établissements traités                       : ${schools.length}`);
  console.log(`  Appartenances LV2 créées/mises à jour        : ${totalLv2}`);
  console.log(`  Appartenances Programme créées/mises à jour  : ${totalPebs}`);
  console.log('\n✅ Backfill terminé.');
}

main()
  .catch((e) => {
    console.error('❌ Erreur pendant le backfill :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
