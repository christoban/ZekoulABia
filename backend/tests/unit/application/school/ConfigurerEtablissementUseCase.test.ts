import { describe, it, expect } from 'bun:test';
import { ConfigurerEtablissementUseCase, type OnboardingState } from '@application/school/ConfigurerEtablissementUseCase';
import { InMemorySchoolActivationRepository } from '../../../helpers/repositories/InMemorySchoolActivationRepository';
import type { SchoolActivationData } from '@domain/ports/repositories/SchoolActivationRepository';
import type { ActiverEtablissementResultat } from '@application/school/ActiverEtablissementUseCase';

class FakeActiverEtablissement {
  result: ActiverEtablissementResultat = { schoolId: 's1', message: 'ok', classCount: 5, subjectCount: 10, academicYear: '2026-2027' };
  calls: string[] = [];
  async execute(cmd: { schoolId: string }): Promise<ActiverEtablissementResultat> {
    this.calls.push(cmd.schoolId);
    return this.result;
  }
}

class FakeEleveOnboardingRepository {
  settings: Record<string, Record<string, unknown>> = {};
  async upsertSettings(schoolId: string, data: unknown) {
    this.settings[schoolId] = { ...(this.settings[schoolId] ?? {}), ...(data as Record<string, unknown>) };
    return this.settings[schoolId] as any;
  }
}

class FakeChangerGestionAdmin {
  calls: unknown[] = [];
  async execute(cmd: unknown) {
    this.calls.push(cmd);
    return { success: true, adminGereInscriptions: (cmd as { actif: boolean }).actif };
  }
}

function makeUseCase(repo: InMemorySchoolActivationRepository, activator: FakeActiverEtablissement) {
  return new ConfigurerEtablissementUseCase(
    repo as never,
    activator as never,
    new FakeEleveOnboardingRepository() as never,
    new FakeChangerGestionAdmin() as never,
  );
}

function makeSchool(overrides: Partial<SchoolActivationData> = {}): SchoolActivationData {
  return {
    id: overrides.id ?? 's1',
    name: overrides.name ?? 'Lycée Test',
    status: overrides.status ?? 'APPROVED',
    onboardingConfig: overrides.onboardingConfig ?? null,
    templateCode: overrides.templateCode ?? null,
    template: overrides.template ?? null,
    configurationForm: overrides.configurationForm ?? null,
    features: overrides.features ?? null,
  };
}

function baseState(overrides: Partial<OnboardingState> = {}): OnboardingState {
  return {
    schoolId: 's1',
    schoolName: 'Lycée Test',
    schoolType: 'GENERAL',
    subSystem: 'FRANCOPHONE',
    cycles: ['PREMIER_CYCLE', 'SECOND_CYCLE'],
    template: 'LYCEE_FR',
    series: ['A1', 'C', 'D'],
    academicYearStart: '2026-09-01',
    academicYearEnd: '2027-06-30',
    periodsCount: 3,
    sequencesPerPeriod: 3,
    adminUserId: 'admin-1',
    ...overrides,
  };
}

describe('ConfigurerEtablissementUseCase', () => {
  it('schoolId manquant → erreur', async () => {
    const repo = new InMemorySchoolActivationRepository();
    const activator = new FakeActiverEtablissement();
    const uc = makeUseCase(repo, activator);
    await expect(uc.execute({ schoolId: '', adminUserId: '' })).rejects.toThrow('schoolId requis');
  });

  it('école introuvable → erreur', async () => {
    const repo = new InMemorySchoolActivationRepository();
    const activator = new FakeActiverEtablissement();
    const uc = makeUseCase(repo, activator);
    await expect(uc.execute(baseState({ schoolId: 'nonexistent' }))).rejects.toThrow('École introuvable');
  });

  it('école déjà ACTIVE → erreur', async () => {
    const repo = new InMemorySchoolActivationRepository();
    repo.schools.set('s1', makeSchool({ status: 'ACTIVE' }));
    const activator = new FakeActiverEtablissement();
    const uc = makeUseCase(repo, activator);
    await expect(uc.execute(baseState())).rejects.toThrow('déjà configuré et actif');
  });

  it('école non approuvée (DRAFT) → erreur', async () => {
    const repo = new InMemorySchoolActivationRepository();
    repo.schools.set('s1', makeSchool({ status: 'DRAFT' }));
    const activator = new FakeActiverEtablissement();
    const uc = makeUseCase(repo, activator);
    await expect(uc.execute(baseState())).rejects.toThrow('doit être approuvé');
  });

  it('happy path FRANCOPHONE → délègue à ActiverEtablissementUseCase', async () => {
    const repo = new InMemorySchoolActivationRepository();
    repo.schools.set('s1', makeSchool({ status: 'APPROVED' }));
    const activator = new FakeActiverEtablissement();
    const uc = makeUseCase(repo, activator);
    const result = await uc.execute(baseState());
    expect(activator.calls).toEqual(['s1']);
    expect(result.schoolId).toBe('s1');
    expect(result.classCount).toBe(5);
    expect(result.subjectCount).toBe(10);
  });

  it('merge avec config existante (préserve Phase 1)', async () => {
    const repo = new InMemorySchoolActivationRepository();
    repo.schools.set('s1', makeSchool({ status: 'APPROVED', onboardingConfig: { existingKey: 'preserved' } }));
    const activator = new FakeActiverEtablissement();
    const uc = makeUseCase(repo, activator);
    await uc.execute(baseState());
    const updated = repo.schools.get('s1');
    expect((updated?.onboardingConfig as Record<string, unknown>)?.existingKey).toBe('preserved');
  });

  it('persiste les paramètres d\'admission Phase 2', async () => {
    const repo = new InMemorySchoolActivationRepository();
    repo.schools.set('s1', makeSchool({ status: 'APPROVED' }));
    const activator = new FakeActiverEtablissement();
    const onboardingRepo = new FakeEleveOnboardingRepository();
    const changerGestion = new FakeChangerGestionAdmin();
    const uc = new ConfigurerEtablissementUseCase(
      repo as never,
      activator as never,
      onboardingRepo as never,
      changerGestion as never,
    );
    await uc.execute(baseState({
      adminGereInscriptions: true,
      directAdmissionWithoutExam: true,
      capacityBufferPercent: 10,
      selfServiceEnabled: true,
      defaultRecipient: 'PARENT',
    }));
    expect(changerGestion.calls).toEqual([{ schoolId: 's1', adminUserId: 'admin-1', actif: true }]);
    expect(onboardingRepo.settings['s1']).toEqual({
      directAdmissionWithoutExam: true,
      capacityBufferPercent: 10,
      selfServiceEnabled: true,
      defaultRecipient: 'PARENT',
    });
  });
});

describe('ConfigurerEtablissementUseCase.mapStateToConfig', () => {
  it('FRANCOPHONE avec cycles PREMIER_CYCLE + SECOND_CYCLE', () => {
    const config = ConfigurerEtablissementUseCase.mapStateToConfig(baseState());
    expect(config.niveaux1erCycle).toEqual(['6e', '5e', '4e', '3e']);
    expect(config.niveaux2eCycle).toEqual(['2nde', '1ère', 'Tle']);
    expect(config.filieres).toEqual(['A', 'C', 'D']);
  });

  it('ANGLOPHONE avec streams', () => {
    const config = ConfigurerEtablissementUseCase.mapStateToConfig(baseState({
      subSystem: 'ANGLOPHONE',
      anglophoneStreams: ['SCIENCES', 'ARTS'],
      anglophoneCombinations: ['S1', 'A1'],
    }));
    expect(config.niveauxSixth).toEqual(['LowerSixth', 'UpperSixth']);
    expect(config.anglophoneStreams).toEqual(['S1', 'A1']);
  });

  it('PRIMAIRE cycle → niveaux primaire FR par défaut', () => {
    const config = ConfigurerEtablissementUseCase.mapStateToConfig(baseState({
      cycles: ['PRIMAIRE'],
    }));
    expect(config.niveauxPrimaire).toEqual(['SIL', 'CP', 'CE1', 'CE2', 'CM1', 'CM2']);
  });

  it('PRIMAIRE anglophone → niveaux EN', () => {
    const config = ConfigurerEtablissementUseCase.mapStateToConfig(baseState({
      cycles: ['PRIMAIRE'],
      subSystem: 'ANGLOPHONE',
    }));
    expect(config.niveauxPrimaire).toEqual(['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6']);
  });

  it('TECHNIQUE avec filières', () => {
    const config = ConfigurerEtablissementUseCase.mapStateToConfig(baseState({
      cycles: ['TECHNIQUE'],
      technicalFilieres: ['INFORMATIQUE', 'MECANIQUE'],
    }));
    expect(config.filieresTechniques).toEqual(['INFORMATIQUE', 'MECANIQUE']);
  });

  it('A4 série avec LV2 languages', () => {
    const config = ConfigurerEtablissementUseCase.mapStateToConfig(baseState({
      series: ['A4'],
      lv2Languages: ['Anglais', 'Espagnol'],
    }));
    expect(config.a4Languages).toEqual(['Anglais', 'Espagnol']);
  });
});
