import { describe, it, expect, mock } from 'bun:test';
import { AppliquerTransfertPebsUseCase } from '../../../../src/application/pebsExam/AppliquerTransfertPebsUseCase.ts';

function makeDeps(overrides: Record<string, any> = {}) {
  const pebsRepository: any = {
    trouverSession: mock(async () => overrides.session ?? { id: 's1', schoolId: 'school-A', status: 'CALCULATED', targetClassId: 'class-pebs' }),
    listerCandidatsAvecProfil: mock(
      async () =>
        overrides.candidats ?? [
          {
            studentProfileId: 'sp1',
            selectionResult: 'SELECTIONNE',
            studentProfile: { user: { id: 'u1', firstName: 'Jean', lastName: 'MBARGA' } },
          },
          {
            studentProfileId: 'sp2',
            selectionResult: 'NON_SELECTIONNE',
            studentProfile: { user: { id: 'u2', firstName: 'Paul', lastName: 'NANA' } },
          },
        ],
    ),
    trouverEcoleSubsystem: mock(async () => overrides.subsystem ?? { subsystem: 'FRANCOPHONE' }),
    trouverClasseCible: mock(async () => overrides.targetClass ?? { id: 'class-pebs', academicYearId: 'ay1', schoolId: 'school-A' }),
    trouverAdminEcole: mock(async () => overrides.admin ?? { id: 'admin-1' }),
    mettreAJourStatutSession: mock(async () => {}),
  };
  const enrollmentRepository: any = {
    changerClasseEleve: mock(async () => {}),
  };
  const affectationRepository: any = {
    mettreAJourPEBS: mock(async () => {}),
  };
  // InMemory-like stubs for membership sync (best-effort, no-op)
  const anneeRepository: any = {
    findCourante: mock(async () => ({ id: 'ay1' })),
  };
  const groupSetRepository: any = {
    findByCode: mock(async () => null), // no PROGRAMME group set → sync is no-op
  };
  const groupRepository: any = {
    findByGroupSet: mock(async () => []),
  };
  const membershipRepository: any = {
    upsert: mock(async () => {}),
    remove: mock(async () => {}),
  };
  const notifier = mock(async () => {});

  // allow overrides for specific repos
  if (overrides.anneeRepository) Object.assign(anneeRepository, overrides.anneeRepository);
  if (overrides.groupSetRepository) Object.assign(groupSetRepository, overrides.groupSetRepository);
  if (overrides.membershipRepository) Object.assign(membershipRepository, overrides.membershipRepository);
  if (overrides.groupRepository) Object.assign(groupRepository, overrides.groupRepository);
  if (overrides.enrollmentRepository) Object.assign(enrollmentRepository, overrides.enrollmentRepository);
  if (overrides.affectationRepository) Object.assign(affectationRepository, overrides.affectationRepository);
  if (overrides.pebsRepository) Object.assign(pebsRepository, overrides.pebsRepository);

  return { pebsRepository, enrollmentRepository, affectationRepository, anneeRepository, groupSetRepository, groupRepository, membershipRepository, notifier };
}

function createUC(deps: ReturnType<typeof makeDeps>) {
  return new AppliquerTransfertPebsUseCase(
    deps.pebsRepository as any,
    deps.anneeRepository as any,
    deps.enrollmentRepository as any,
    deps.affectationRepository as any,
    deps.groupSetRepository as any,
    deps.groupRepository as any,
    deps.membershipRepository as any,
    deps.notifier as any,
  );
}

describe('AppliquerTransfertPebsUseCase', () => {
  it('refuse si session d’une autre école (isolation)', async () => {
    const deps = makeDeps({ session: { id: 's1', schoolId: 'school-B', status: 'CALCULATED', targetClassId: 'c1' } });
    const uc = createUC(deps);
    await expect(uc.execute({ sessionId: 's1', schoolId: 'school-A', confirmed: true })).rejects.toThrow('Accès refusé');
  });

  it('refuse si session introuvable', async () => {
    const deps = makeDeps({ session: null });
    // override trouverSession explicitly
    deps.pebsRepository.trouverSession = mock(async () => null);
    const uc = createUC(deps);
    await expect(uc.execute({ sessionId: 's1', schoolId: 'school-A', confirmed: true })).rejects.toThrow('introuvable');
  });

  it('refuse si session déjà APPLIED', async () => {
    const deps = makeDeps({ session: { id: 's1', schoolId: 'school-A', status: 'APPLIED', targetClassId: 'c1' } });
    const uc = createUC(deps);
    await expect(uc.execute({ sessionId: 's1', schoolId: 'school-A', confirmed: true })).rejects.toThrow('déjà été appliqué');
  });

  it('refuse s’il n’y a aucun SELECTIONNE', async () => {
    const deps = makeDeps({
      candidats: [
        { studentProfileId: 'sp2', selectionResult: 'NON_SELECTIONNE', studentProfile: { user: { id: 'u2', firstName: 'Paul', lastName: 'NANA' } } },
      ],
    });
    const uc = createUC(deps);
    await expect(uc.execute({ sessionId: 's1', schoolId: 'school-A', confirmed: true })).rejects.toThrow('Aucun candidat sélectionné');
  });

  it('refuse si aucun candidat en base (liste vide)', async () => {
    const deps = makeDeps({ candidats: [] });
    const uc = createUC(deps);
    await expect(uc.execute({ sessionId: 's1', schoolId: 'school-A', confirmed: true })).rejects.toThrow('Aucun candidat sélectionné');
  });

  it('dry-run (confirmed:false) : ne transfère rien, ne change pas le statut', async () => {
    const deps = makeDeps();
    const uc = createUC(deps);
    const result = await uc.execute({ sessionId: 's1', schoolId: 'school-A', confirmed: false });
    expect(result.confirmed).toBe(false);
    expect(result.transferred).toBe(0);
    expect(result.selectionnes).toEqual([]);
    expect(result.nonSelectionnes).toEqual([]);
    expect(deps.enrollmentRepository.changerClasseEleve).not.toHaveBeenCalled();
    expect(deps.affectationRepository.mettreAJourPEBS).not.toHaveBeenCalled();
    expect(deps.pebsRepository.mettreAJourStatutSession).not.toHaveBeenCalled();
  });

  it('refuse si classe cible introuvable', async () => {
    const deps = makeDeps({ targetClass: null });
    deps.pebsRepository.trouverClasseCible = mock(async () => null);
    const uc = createUC(deps);
    await expect(uc.execute({ sessionId: 's1', schoolId: 'school-A', confirmed: true })).rejects.toThrow('Classe cible PEBS introuvable');
  });

  it('apply confirmé : change classe, met à jour PEBS, marque APPLIED, notifie', async () => {
    const deps = makeDeps();
    const uc = createUC(deps);
    const result = await uc.execute({ sessionId: 's1', schoolId: 'school-A', confirmed: true });
    expect(result.confirmed).toBe(true);
    expect(result.transferred).toBe(1);
    expect(deps.affectationRepository.mettreAJourPEBS).toHaveBeenCalledWith('sp1', 'FR_PEBS');
    expect(deps.enrollmentRepository.changerClasseEleve).toHaveBeenCalled();
    const call = deps.enrollmentRepository.changerClasseEleve.mock.calls[0][0];
    expect(call.studentId).toBe('sp1');
    expect(call.newClassId).toBe('class-pebs');
    expect(deps.pebsRepository.mettreAJourStatutSession).toHaveBeenCalledWith('s1', 'APPLIED');
    expect(deps.notifier).toHaveBeenCalled();
    expect(result.selectionnes).toHaveLength(1);
    expect(result.selectionnes[0].studentName).toBe('Jean MBARGA');
    expect(result.nonSelectionnes).toHaveLength(1);
  });

  it('apply ANGLOPHONE → EN_PEBS', async () => {
    const deps = makeDeps({ subsystem: { subsystem: 'ANGLOPHONE' } });
    const uc = createUC(deps);
    await uc.execute({ sessionId: 's1', schoolId: 'school-A', confirmed: true });
    expect(deps.affectationRepository.mettreAJourPEBS).toHaveBeenCalledWith('sp1', 'EN_PEBS');
  });

  it('apply : erreur sur un candidat continue les autres (best-effort)', async () => {
    const deps = makeDeps({
      candidats: [
        { studentProfileId: 'sp1', selectionResult: 'SELECTIONNE', studentProfile: { user: { id: 'u1', firstName: 'Jean', lastName: 'MBARGA' } } },
        { studentProfileId: 'sp2', selectionResult: 'SELECTIONNE', studentProfile: { user: { id: 'u2', firstName: 'Paul', lastName: 'NANA' } } },
      ],
    });
    // premier PEBS update throw
    let callCount = 0;
    deps.affectationRepository.mettreAJourPEBS = mock(async () => {
      callCount += 1;
      if (callCount === 1) throw new Error('DB error');
    });
    const uc = createUC(deps);
    const result = await uc.execute({ sessionId: 's1', schoolId: 'school-A', confirmed: true });
    expect(result.transferred).toBe(1);
    expect(result.selectionnes).toHaveLength(1);
    expect(result.selectionnes[0].studentName).toBe('Paul NANA');
    // quand même marqué APPLIED
    expect(deps.pebsRepository.mettreAJourStatutSession).toHaveBeenCalledWith('s1', 'APPLIED');
  });

  it('apply : filtre nonSelectionnes sans user', async () => {
    const deps = makeDeps({
      candidats: [
        { studentProfileId: 'sp1', selectionResult: 'SELECTIONNE', studentProfile: { user: { id: 'u1', firstName: 'Jean', lastName: 'MBARGA' } } },
        { studentProfileId: 'sp2', selectionResult: 'NON_SELECTIONNE', studentProfile: null },
        { studentProfileId: 'sp3', selectionResult: 'NON_SELECTIONNE', studentProfile: { user: null } },
      ],
    });
    const uc = createUC(deps);
    const result = await uc.execute({ sessionId: 's1', schoolId: 'school-A', confirmed: true });
    expect(result.nonSelectionnes).toHaveLength(0);
  });
});
