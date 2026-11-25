import { describe, it, expect, beforeEach } from 'bun:test';
import { AffecterLV2EleveUseCase } from '../../../../src/application/student/AffecterLV2EleveUseCase.ts';
import { AffecterPEBSEleveUseCase } from '../../../../src/application/student/AffecterPEBSEleveUseCase.ts';
import type { StudentAffectationRepository, StudentProfileRef, SubjectRef } from '../../../../src/domain/ports/repositories/StudentAffectationRepository.ts';
import { InMemoryAnneeAcademiqueRepository } from '../../../helpers/repositories/InMemoryAnneeAcademiqueRepository.ts';
import { InMemoryStudentGroupSetRepository } from '../../../helpers/repositories/InMemoryStudentGroupSetRepository.ts';
import { InMemoryStudentGroupRepository } from '../../../helpers/repositories/InMemoryStudentGroupRepository.ts';
import { InMemoryStudentGroupMembershipRepository } from '../../../helpers/repositories/InMemoryStudentGroupMembershipRepository.ts';
import type { PebsFiliere } from '../../../../src/domain/types/enums.ts';

const SCHOOL_ID = 'school-1';
const STUDENT_USER_ID = 'user-eleve-1';
const PROFILE_ID = 'profile-1';
const YEAR_ID = 'year-1';
const LV2_SUBJECT_ID = 'subject-allemand';
const GROUP_SET_LV2 = 'gs-lv2';
const GROUP_LV2 = 'g-allemand';

function makeAffectationRepo(overrides?: { profile?: StudentProfileRef | null; subject?: SubjectRef | null }) {
  const hasProfile = overrides && 'profile' in overrides;
  const profile = overrides?.profile ?? { id: PROFILE_ID, userId: STUDENT_USER_ID };
  const subject = overrides?.subject ?? { id: LV2_SUBJECT_ID, name: 'Allemand' };
  let lv2Value: string | null | undefined;
  let pebsValue: PebsFiliere | null | undefined;

  return {
    async trouverProfilParUserId(userId: string, schoolId: string) {
      if (userId !== STUDENT_USER_ID || schoolId !== SCHOOL_ID) return null;
      return hasProfile ? overrides!.profile : profile;
    },
    async trouverProfilParId() { return profile; },
    async trouverProfilParUserIdAvecClasse() { return { id: PROFILE_ID, classId: 'classe-1' }; },
    async listerProfilsParUserIds() { return [profile]; },
    async trouverMatiere(matiereId: string, schoolId: string) {
      if (matiereId === LV2_SUBJECT_ID && schoolId === SCHOOL_ID) return subject;
      return null;
    },
    async listerMatieresParIds() { return []; },
    async listerMatieresParNoms() { return []; },
    async listerNomsMatieresALevelOfficielles() { return []; },
    async trouverCombinaisonAnglophone() { return null; },
    async mettreAJourLV2(_profileId: string, value: string | null) { lv2Value = value; },
    async mettreAJourLV2EnMasse() { return 0; },
    async mettreAJourPEBS(_profileId: string, value: PebsFiliere | null) { pebsValue = value; },
    async mettreAJourPEBSEnMasse() { return 0; },
    async remplacerMatieresALevel() {},
    async listerElevesParMatiereALevel() { return []; },
    async listerMatieresDuProfile() { return []; },
    async trouverClasseNiveau() { return null; },
    _getLv2Value: () => lv2Value,
    _getPebsValue: () => pebsValue,
  } as unknown as StudentAffectationRepository & { _getLv2Value: () => string | null | undefined; _getPebsValue: () => PebsFiliere | null | undefined };
}

function setupSyncDeps() {
  const anneeRepo = new InMemoryAnneeAcademiqueRepository();
  anneeRepo.ajouterAnnee({ id: YEAR_ID, schoolId: SCHOOL_ID, name: '2025-2026', status: 'ACTIVE', isCurrent: true, startDate: new Date('2025-09-01'), endDate: new Date('2026-06-30') });
  const groupSetRepo = new InMemoryStudentGroupSetRepository();
  const groupRepo = new InMemoryStudentGroupRepository();
  const membershipRepo = new InMemoryStudentGroupMembershipRepository();
  return { anneeRepo, groupSetRepo, groupRepo, membershipRepo };
}

describe('AffecterLV2EleveUseCase (V2.8)', () => {
  let syncDeps: ReturnType<typeof setupSyncDeps>;

  beforeEach(() => {
    syncDeps = setupSyncDeps();
  });

  it('lève une erreur si élève introuvable', async () => {
    const repo = makeAffectationRepo({ profile: null });
    const uc = new AffecterLV2EleveUseCase(repo, syncDeps.anneeRepo, syncDeps.groupSetRepo, syncDeps.groupRepo, syncDeps.membershipRepo);

    await expect(
      uc.execute({ studentUserId: 'unknown', schoolId: SCHOOL_ID, lv2SubjectId: LV2_SUBJECT_ID })
    ).rejects.toThrow('Élève introuvable dans cet établissement');
  });

  it('lève une erreur si matière LV2 introuvable', async () => {
    const repo = makeAffectationRepo();
    const uc = new AffecterLV2EleveUseCase(repo, syncDeps.anneeRepo, syncDeps.groupSetRepo, syncDeps.groupRepo, syncDeps.membershipRepo);

    await expect(
      uc.execute({ studentUserId: STUDENT_USER_ID, schoolId: SCHOOL_ID, lv2SubjectId: 'matiere-inconnue' })
    ).rejects.toThrow('Matière LV2 introuvable dans cet établissement');
  });

  it('affecte LV2 avec matière valide et synchronise le membership', async () => {
    const repo = makeAffectationRepo();
    syncDeps.groupSetRepo.ajouter({ id: GROUP_SET_LV2, schoolId: SCHOOL_ID, code: 'LV2', name: 'LV2' });
    syncDeps.groupRepo.ajouter({ id: GROUP_LV2, groupSetId: GROUP_SET_LV2, name: 'Allemand', subjectId: LV2_SUBJECT_ID });

    const uc = new AffecterLV2EleveUseCase(repo, syncDeps.anneeRepo, syncDeps.groupSetRepo, syncDeps.groupRepo, syncDeps.membershipRepo);
    await uc.execute({ studentUserId: STUDENT_USER_ID, schoolId: SCHOOL_ID, lv2SubjectId: LV2_SUBJECT_ID });

    const membership = await syncDeps.membershipRepo.findByStudentAndGroupSet(PROFILE_ID, GROUP_SET_LV2, YEAR_ID);
    expect(membership).not.toBeNull();
    expect(membership?.groupId).toBe(GROUP_LV2);
  });

  it('retire le membership LV2 quand lv2SubjectId est null', async () => {
    const repo = makeAffectationRepo();
    syncDeps.groupSetRepo.ajouter({ id: GROUP_SET_LV2, schoolId: SCHOOL_ID, code: 'LV2', name: 'LV2' });
    syncDeps.groupRepo.ajouter({ id: GROUP_LV2, groupSetId: GROUP_SET_LV2, name: 'Allemand', subjectId: LV2_SUBJECT_ID });
    syncDeps.membershipRepo.ajouterMembre(PROFILE_ID, GROUP_LV2, GROUP_SET_LV2, YEAR_ID, 'classe-1');

    const uc = new AffecterLV2EleveUseCase(repo, syncDeps.anneeRepo, syncDeps.groupSetRepo, syncDeps.groupRepo, syncDeps.membershipRepo);
    await uc.execute({ studentUserId: STUDENT_USER_ID, schoolId: SCHOOL_ID, lv2SubjectId: null });

    const membership = await syncDeps.membershipRepo.findByStudentAndGroupSet(PROFILE_ID, GROUP_SET_LV2, YEAR_ID);
    expect(membership).toBeNull();
  });
});

describe('AffecterPEBSEleveUseCase (V2.8)', () => {
  let syncDeps: ReturnType<typeof setupSyncDeps>;

  beforeEach(() => {
    syncDeps = setupSyncDeps();
  });

  it('lève une erreur si élève introuvable', async () => {
    const repo = makeAffectationRepo({ profile: null });
    const uc = new AffecterPEBSEleveUseCase(repo, syncDeps.anneeRepo, syncDeps.groupSetRepo, syncDeps.groupRepo, syncDeps.membershipRepo);

    await expect(
      uc.execute({ studentUserId: 'unknown', schoolId: SCHOOL_ID, pebsFiliere: 'FR_PEBS' })
    ).rejects.toThrow('Élève introuvable dans cet établissement');
  });

  it('lève une erreur si pebsFiliere invalide', async () => {
    const repo = makeAffectationRepo();
    const uc = new AffecterPEBSEleveUseCase(repo, syncDeps.anneeRepo, syncDeps.groupSetRepo, syncDeps.groupRepo, syncDeps.membershipRepo);

    await expect(
      uc.execute({ studentUserId: STUDENT_USER_ID, schoolId: SCHOOL_ID, pebsFiliere: 'INVALID' as PebsFiliere })
    ).rejects.toThrow('Valeur pebsFiliere invalide');
  });

  it('affecte PEBS FR_PEBS et synchronise le membership', async () => {
    const repo = makeAffectationRepo();
    const gsId = 'gs-prog';
    const gId = 'g-fr-pebs';
    syncDeps.groupSetRepo.ajouter({ id: gsId, schoolId: SCHOOL_ID, code: 'PROGRAMME', name: 'Programme' });
    syncDeps.groupRepo.ajouter({ id: gId, groupSetId: gsId, name: 'FR_PEBS' });

    const uc = new AffecterPEBSEleveUseCase(repo, syncDeps.anneeRepo, syncDeps.groupSetRepo, syncDeps.groupRepo, syncDeps.membershipRepo);
    await uc.execute({ studentUserId: STUDENT_USER_ID, schoolId: SCHOOL_ID, pebsFiliere: 'FR_PEBS' });

    const membership = await syncDeps.membershipRepo.findByStudentAndGroupSet(PROFILE_ID, gsId, YEAR_ID);
    expect(membership).not.toBeNull();
    expect(membership?.groupId).toBe(gId);
  });

  it('affecte PEBS null et retire le membership', async () => {
    const repo = makeAffectationRepo();
    const gsId = 'gs-prog';
    const gId = 'g-fr-pebs';
    syncDeps.groupSetRepo.ajouter({ id: gsId, schoolId: SCHOOL_ID, code: 'PROGRAMME', name: 'Programme' });
    syncDeps.groupRepo.ajouter({ id: gId, groupSetId: gsId, name: 'FR_PEBS' });
    syncDeps.membershipRepo.ajouterMembre(PROFILE_ID, gId, gsId, YEAR_ID, 'classe-1');

    const uc = new AffecterPEBSEleveUseCase(repo, syncDeps.anneeRepo, syncDeps.groupSetRepo, syncDeps.groupRepo, syncDeps.membershipRepo);
    await uc.execute({ studentUserId: STUDENT_USER_ID, schoolId: SCHOOL_ID, pebsFiliere: null });

    const membership = await syncDeps.membershipRepo.findByStudentAndGroupSet(PROFILE_ID, gsId, YEAR_ID);
    expect(membership).toBeNull();
  });
});
