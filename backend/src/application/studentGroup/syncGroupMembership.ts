/**
 * Synchronisation StudentGroupMembership depuis les champs legacy StudentProfile.lv2SubjectId /
 * pebsFiliere — appelée juste après chaque écriture existante sur ces champs (jamais l'inverse :
 * le champ legacy reste la source de vérité lue par le code existant, cette table est tenue à
 * jour en aval pour tout nouveau code, ex. GenererSeancesGroupeUseCase).
 *
 * Best-effort volontaire : si le GroupSet "LV2"/"PROGRAMME" n'existe pas encore pour l'école (le
 * script de backfill n'a pas encore tourné) ou si la matière/valeur ne correspond à aucun Group
 * connu, on ne fait rien plutôt que de faire échouer l'action utilisateur réelle (affectation
 * LV2/PEBS) pour une table de synchronisation annexe.
 */
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { StudentGroupSetRepository } from '@domain/ports/repositories/StudentGroupSetRepository';
import type { StudentGroupRepository } from '@domain/ports/repositories/StudentGroupRepository';
import type { StudentGroupMembershipRepository } from '@domain/ports/repositories/StudentGroupMembershipRepository';
import type { PebsFiliere } from '@domain/types/enums';

export interface SyncRepositories {
  anneeRepository: AnneeAcademiqueRepository;
  groupSetRepository: StudentGroupSetRepository;
  groupRepository: StudentGroupRepository;
  membershipRepository: StudentGroupMembershipRepository;
}

async function resoudreAnneeCouranteId(anneeRepository: AnneeAcademiqueRepository, schoolId: string): Promise<string | null> {
  const annee = await anneeRepository.findCourante(schoolId);
  return annee?.id ?? null;
}

export async function synchroniserAppartenanceLV2(
  repos: SyncRepositories,
  params: { schoolId: string; studentProfileId: string; lv2SubjectId: string | null; academicYearId?: string }
): Promise<void> {
  const academicYearId = params.academicYearId ?? await resoudreAnneeCouranteId(repos.anneeRepository, params.schoolId);
  if (!academicYearId) return;

  const groupSet = await repos.groupSetRepository.findByCode(params.schoolId, 'LV2');
  if (!groupSet) return;

  if (params.lv2SubjectId === null) {
    await repos.membershipRepository.remove(params.studentProfileId, groupSet.id, academicYearId);
    return;
  }

  const groupes = await repos.groupRepository.findByGroupSet(groupSet.id);
  const groupe = groupes.find(g => g.subjectId === params.lv2SubjectId);
  if (!groupe) return;

  await repos.membershipRepository.upsert(params.studentProfileId, groupe.id, groupSet.id, academicYearId);
}

export async function synchroniserAppartenanceProgramme(
  repos: SyncRepositories,
  params: { schoolId: string; studentProfileId: string; pebsFiliere: PebsFiliere | null; academicYearId?: string }
): Promise<void> {
  const academicYearId = params.academicYearId ?? await resoudreAnneeCouranteId(repos.anneeRepository, params.schoolId);
  if (!academicYearId) return;

  const groupSet = await repos.groupSetRepository.findByCode(params.schoolId, 'PROGRAMME');
  if (!groupSet) return;

  if (params.pebsFiliere === null) {
    await repos.membershipRepository.remove(params.studentProfileId, groupSet.id, academicYearId);
    return;
  }

  const groupes = await repos.groupRepository.findByGroupSet(groupSet.id);
  const groupe = groupes.find(g => g.name === params.pebsFiliere);
  if (!groupe) return;

  await repos.membershipRepository.upsert(params.studentProfileId, groupe.id, groupSet.id, academicYearId);
}
