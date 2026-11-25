import { describe, it, expect, beforeEach } from 'bun:test';
import { ProposerEmploisDuTempsGlobalUseCase } from '../../../../src/application/timetable/ProposerEmploisDuTempsGlobalUseCase.ts';
import { InMemoryTimetableGenerationRunRepository } from '../../../helpers/repositories/InMemoryTimetableGenerationRunRepository.ts';
import type { ProposerEmploiDuTempsUseCase } from '../../../../src/application/timetable/ProposerEmploiDuTempsUseCase.ts';
import type { GenererSqueletteEmploiDuTempsUseCase } from '../../../../src/application/timetable/GenererSqueletteEmploiDuTempsUseCase.ts';
import type { TargetClass, TimetableGenerationTargetProvider } from '../../../../src/domain/ports/services/TimetableGenerationTargetProvider.ts';

describe('ProposerEmploisDuTempsGlobalUseCase', () => {
  let runs: InMemoryTimetableGenerationRunRepository;
  let proposerCalls: unknown[];
  let proposer: ProposerEmploiDuTempsUseCase;
  let squelette: GenererSqueletteEmploiDuTempsUseCase;
  let targetsProvider: TimetableGenerationTargetProvider;
  let useCase: ProposerEmploisDuTempsGlobalUseCase;

  beforeEach(() => {
    runs = new InMemoryTimetableGenerationRunRepository();
    proposerCalls = [];
    proposer = {
      async execute(commande) {
        proposerCalls.push(commande);
        return {
          statut: 'OPTIMAL',
           seances: [{ subjectId: 's1', teacherId: 't1', roomId: 'r1', dayOfWeek: 1, startTime: '08:00', endTime: '09:00' }],
           seancesGroupes: [{ subjectId: 'arabe', teacherId: 'karim-abaa', roomId: 'r2', dayOfWeek: 0, startTime: '14:15', endTime: '15:15', groupId: 'groupe-arabe', groupName: 'Arabe', participantsCount: 5, isLV2Slot: true }],
           scoreObjectif: 0,
          dureeResolutionMs: 100,
        };
      },
    } as unknown as ProposerEmploiDuTempsUseCase;
    squelette = { async execute() { return { timetableId: 'tt-new' }; } } as unknown as GenererSqueletteEmploiDuTempsUseCase;
    targetsProvider = {
      async listTargets() {
        return [
          { classId: 'c1', className: '1e A', requiredHours: 12, timetableId: 'tt1', status: 'DRAFT' },
          { classId: 'c2', className: '2e A', requiredHours: 10, timetableId: 'tt2', status: 'DRAFT' },
        ];
      },
      async buildPreflight() { return { capacity: 30 }; },
    };
    useCase = new ProposerEmploisDuTempsGlobalUseCase(targetsProvider, runs, proposer, squelette);
  });

  it('lance un run trié par nom de classe avec pré-flight', async () => {
    const { runId, status } = await useCase.lancer('school-1', 'year-1', 'user-1');
    expect(status).toBe('PENDING');
    const run = await runs.findById(runId, 'school-1');
    expect(run).not.toBeNull();
    const progress = run!.progress as { targets: TargetClass[]; current: number; total: number };
    expect(progress.targets.map(t => t.classId)).toEqual(['c1', 'c2']);
    expect(progress.total).toBe(2);
    expect(run!.results[0]).toEqual({ type: 'PREFLIGHT', report: { capacity: 30 } });
  });

  it('propose chaque classe et accumule l occupation', async () => {
    const { runId } = await useCase.lancer('school-1', 'year-1', 'user-1');
    await useCase.processClass(runId, 'c1', 'school-1');
    const runAfterFirst = await runs.findById(runId, 'school-1');
    expect(runAfterFirst!.status).toBe('RUNNING');
     const firstClassResult = runAfterFirst!.results[1] as { timetableId: string; status: string; occupation: unknown[] };
     expect(firstClassResult.timetableId).toBe('tt1');
     expect(firstClassResult.status).toBe('success');
     expect(firstClassResult.occupation).toHaveLength(2);

     await useCase.processClass(runId, 'c2', 'school-1');
     const secondCall = proposerCalls[1] as { occupationSupplementaire: Array<{ classId: string; teacherId: string; roomId: string; dayOfWeek: number; startTime: string; endTime: string }> };
     expect(secondCall.occupationSupplementaire).toHaveLength(2);
     expect(secondCall.occupationSupplementaire).toContainEqual({ classId: 'c1', teacherId: 'karim-abaa', roomId: 'r2', dayOfWeek: 0, startTime: '14:15', endTime: '15:15' });
  });

  it('distingue une règle pédagogique relâchée et conserve son diagnostic', async () => {
    let appels = 0;
    proposer = {
      async execute() {
        appels += 1;
        if (appels === 1) return { statut: 'INFAISABLE', seances: [], problemes: ['Arabe : occurrences quotidiennes impossibles avec la grille.'], scoreObjectif: 0, dureeResolutionMs: 10 };
        return { statut: 'FEASIBLE', seances: [{ subjectId: 'arabe', teacherId: 'karim-abaa', roomId: 'r1', dayOfWeek: 0, startTime: '08:00', endTime: '09:00' }], scoreObjectif: 1, dureeResolutionMs: 10 };
      },
    } as unknown as ProposerEmploiDuTempsUseCase;
    useCase = new ProposerEmploisDuTempsGlobalUseCase(targetsProvider, runs, proposer, squelette);
    const { runId } = await useCase.lancer('school-1', 'year-1', 'user-1');
    await useCase.processClass(runId, 'c1', 'school-1');
    const result = (await runs.findById(runId, 'school-1'))!.results[1] as { status: string; diagnostic?: { relaxedPedagogicalRules?: boolean; relaxedProblems?: string[] } };
    expect(result.status).toBe('DEGRADE');
    expect(result.diagnostic?.relaxedPedagogicalRules).toBe(true);
    expect(result.diagnostic?.relaxedProblems).toContain('Arabe : occurrences quotidiennes impossibles avec la grille.');
  });

  it('inclut le timetableId du squelette créé dans le résultat', async () => {
    targetsProvider = {
      async listTargets() { return [{ classId: 'c1', className: '1e A', requiredHours: 12, status: 'DRAFT' }]; },
      async buildPreflight() { return { capacity: 30 }; },
    };
    useCase = new ProposerEmploisDuTempsGlobalUseCase(targetsProvider, runs, proposer, squelette);
    const { runId } = await useCase.lancer('school-1', 'year-1', 'user-1');
    await useCase.processClass(runId, 'c1', 'school-1');
    const run = await runs.findById(runId, 'school-1');
    expect((run!.results[1] as { timetableId: string }).timetableId).toBe('tt-new');
  });

  it('bloque un second run actif', async () => {
    await useCase.lancer('school-1', 'year-1', 'user-1');
    await expect(useCase.lancer('school-1', 'year-1', 'user-1')).rejects.toThrow('Génération globale déjà en cours');
  });

  it('marque NON_TRAITE après épuisement du budget', async () => {
    const { runId } = await useCase.lancer('school-1', 'year-1', 'user-1');
    runs.setCreatedAt(runId, new Date(Date.now() - 1_000_000));
    const resultat = await useCase.processClass(runId, 'c1', 'school-1');
    expect(resultat.status).toBe('NON_TRAITE');
    expect(proposerCalls).toHaveLength(0);
    const run = await runs.findById(runId, 'school-1');
    expect(run?.status).toBe('PARTIAL');
  });

  it('libère un run périmé et permet un nouveau lancement', async () => {
    const { runId } = await useCase.lancer('school-1', 'year-1', 'user-1');
    await runs.markRunning(runId, 'school-1');
    runs.setCreatedAt(runId, new Date(Date.now() - 1_000_000));
    runs.setHeartbeatAt(runId, new Date(Date.now() - 1_000_000));
    expect(await runs.failStale('school-1', new Date(Date.now() - 5 * 60 * 1000))).toBe(1);
    await expect(useCase.lancer('school-1', 'year-1', 'user-1')).resolves.toMatchObject({ status: 'PENDING' });
  });

  it('ignore les EDT verrouillés', async () => {
    targetsProvider = {
      async listTargets() { return [{ classId: 'c1', className: '1e A', requiredHours: 12, timetableId: 'tt1', status: 'SUBMITTED' }]; },
      async buildPreflight() { return { capacity: 30 }; },
    };
    useCase = new ProposerEmploisDuTempsGlobalUseCase(targetsProvider, runs, proposer, squelette);
    const { runId } = await useCase.lancer('school-1', 'year-1', 'user-1');
    const result = await useCase.processClass(runId, 'c1', 'school-1');
    expect(result.status).toBe('IGNORE_EDT_VERROUILLE');
    expect(proposerCalls).toHaveLength(0);
  });
});
