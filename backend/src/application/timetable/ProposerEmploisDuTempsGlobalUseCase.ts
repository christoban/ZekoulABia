import type { CreneauOccupe } from '@domain/ports/services/SchedulingSolverPort';
import type { TimetableGenerationRunRepository } from '@domain/ports/repositories/TimetableGenerationRunRepository';
import type { GenererSqueletteEmploiDuTempsUseCase } from '@application/timetable/GenererSqueletteEmploiDuTempsUseCase';
import type { ProposerEmploiDuTempsUseCase } from '@application/timetable/ProposerEmploiDuTempsUseCase';
import type { TargetClass, TimetableGenerationTargetProvider } from '@domain/ports/services/TimetableGenerationTargetProvider';

type RunResult = { classId: string; className: string; timetableId?: string; status: string; seances?: unknown[]; seancesGroupes?: unknown[]; heuresNonPlacees?: unknown[]; occupation?: CreneauOccupe[]; warnings: string[]; diagnostic?: { relaxedPedagogicalRules?: boolean; relaxedProblems?: string[]; problems?: string[]; stack?: string }; durationMs: number };

export class ProposerEmploisDuTempsGlobalUseCase {
  constructor(
    private readonly targetsProvider: TimetableGenerationTargetProvider,
    private readonly runs: TimetableGenerationRunRepository,
    private readonly proposer: ProposerEmploiDuTempsUseCase,
    private readonly squelette: GenererSqueletteEmploiDuTempsUseCase,
  ) {}

  async lancer(schoolId: string, academicYearId: string, requestedById: string, classIds?: string[]): Promise<{ runId: string; status: string }> {
    await this.runs.failStale(schoolId, new Date(Date.now() - 5 * 60 * 1000));
    const active = await this.runs.findActive(schoolId, academicYearId);
    if (active) throw new Error('Génération globale déjà en cours pour cette année scolaire');
    const targets = await this.targetsProvider.listTargets(schoolId, academicYearId, classIds);
    if (targets.length === 0) throw new Error('Aucune classe active pour cette année scolaire');
    const preflight = await this.targetsProvider.buildPreflight(schoolId, academicYearId, targets);
    const run = await this.runs.create({ schoolId, academicYearId, requestedById, budgetSeconds: Math.max(300, targets.length * 150), progress: { targets, current: 0, total: targets.length }, preflightReport: preflight });
    await this.runs.appendResult(run.id, schoolId, { type: 'PREFLIGHT', report: preflight }, 'PENDING', { targets, current: 0, total: targets.length });
    return { runId: run.id, status: 'PENDING' };
  }

  async processClass(runId: string, classId: string, schoolId: string): Promise<{ classId: string; status: string; durationMs: number }> {
    const run = await this.runs.findById(runId, schoolId);
    if (!run) throw new Error('Run de génération introuvable');
    const progress = run.progress as { targets?: TargetClass[]; current?: number } | null;
    const target = progress?.targets?.find(item => item.classId === classId);
    if (!target) throw new Error(`Classe ${classId} absente du run`);
    if (run.status === 'CANCELLED') return { classId, status: 'CANCELLED', durationMs: 0 };
    const started = Date.now();
    if (Date.now() - run.createdAt.getTime() > run.budgetSeconds * 1000) {
      const result: RunResult = { classId, className: target.className, status: 'NON_TRAITE', warnings: ['Budget global épuisé avant le traitement de cette classe.'], durationMs: 0 };
      await this.append(run.id, run.schoolId, result, progress, target.className);
      return { classId, status: result.status, durationMs: 0 };
    }
    if (target.status === 'SUBMITTED' || target.status === 'PUBLISHED') {
      const result: RunResult = { classId, className: target.className, status: 'IGNORE_EDT_VERROUILLE', warnings: ['EDT verrouillé : proposition globale ignorée.'], durationMs: 0 };
      await this.append(run.id, run.schoolId, result, progress, target.className);
      return { classId, status: result.status, durationMs: 0 };
    }
    let timetableId = target.timetableId;
    if (!timetableId) {
      const created = await this.squelette.execute({ schoolId: run.schoolId, classId });
      timetableId = created.timetableId;
    }
    const accumulated = this.accumulatedOccupation(run);
    const base = {
      timetableId,
      schoolId: run.schoolId,
      ignoreTimetableIds: progress?.targets?.map(item => item.timetableId).filter((id): id is string => Boolean(id)) ?? [timetableId],
      occupationSupplementaire: accumulated,
      reglesPedagogiquesDures: true,
      respecterContraintesTempsLibres: true,
      maxDeterministicTime: 3,
      contraintes: { reglesPedagogiques: true, maxTempsLibresParJour: 2, interdireTempsLibresConsecutifs: true },
    } as const;
     let proposition;
     let relaxedPedagogicalRules = false;
     let relaxedProblems: string[] = [];
     try {
       proposition = await this.proposer.execute(base);
       if (proposition.statut === 'INFAISABLE') {
         relaxedPedagogicalRules = true;
         relaxedProblems = proposition.problemes ?? (proposition.raisonInfaisabilite ? [proposition.raisonInfaisabilite] : []);
         proposition = await this.proposer.execute({ ...base, reglesPedagogiquesDures: false, respecterContraintesTempsLibres: false, placementPartiel: true, maxDeterministicTime: 3, contraintes: { reglesPedagogiques: false } });
       }
     } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur solveur inconnue';
      console.error('[TimetableGenerationRun] class failure', { runId, classId, error });
      const result: RunResult = { classId, className: target.className, status: 'ECHEC_TECHNIQUE', warnings: [message], diagnostic: { stack: error instanceof Error ? error.stack : undefined }, durationMs: Date.now() - started };
      await this.append(run.id, run.schoolId, result, progress, target.className);
      return { classId, status: result.status, durationMs: result.durationMs };
    }
     const status = proposition.statut === 'PARTIEL' ? 'PARTIEL' : proposition.statut === 'INFAISABLE' ? 'ECHEC' : relaxedPedagogicalRules ? 'DEGRADE' : proposition.statut === 'FEASIBLE' ? 'SUCCESS_WITH_WARNINGS' : proposition.avertissements?.length ? 'SUCCESS_WITH_WARNINGS' : 'success';
     const warnings = [
       ...(proposition.avertissements ?? []),
       ...(!relaxedPedagogicalRules && proposition.statut === 'FEASIBLE' ? ['Solution réalisable mais non optimale : certaines préférences de placement n’ont pas pu être optimisées.'] : []),
     ];
     const relaxedDetails = relaxedProblems.length > 0 ? relaxedProblems : ['Règles pédagogiques de placement relâchées pour conserver une proposition complète.'];
     const occupation = [...proposition.seances, ...(proposition.seancesGroupes ?? [])].map(seance => ({ classId, teacherId: seance.teacherId, roomId: seance.roomId, dayOfWeek: seance.dayOfWeek, startTime: seance.startTime, endTime: seance.endTime }));
     const result: RunResult = { classId, className: target.className, timetableId, status, seances: proposition.seances, seancesGroupes: proposition.seancesGroupes, heuresNonPlacees: proposition.heuresNonPlacees, occupation, warnings, diagnostic: { ...(relaxedPedagogicalRules ? { relaxedPedagogicalRules, relaxedProblems: relaxedDetails } : {}), ...(proposition.problemes?.length ? { problems: proposition.problemes } : {}) }, durationMs: Date.now() - started };
    await this.append(run.id, run.schoolId, result, progress, target.className);
    return { classId, status, durationMs: result.durationMs };
  }

  private async append(runId: string, schoolId: string, result: RunResult, progress: { targets?: TargetClass[]; current?: number } | null, className: string): Promise<void> {
    const current = (progress?.current ?? 0) + 1;
    const total = progress?.targets?.length ?? current;
    const status = ['ECHEC', 'ECHEC_TECHNIQUE', 'PARTIEL', 'NON_TRAITE'].includes(result.status) ? 'PARTIAL' : 'RUNNING';
    await this.runs.appendResult(runId, schoolId, result, status, { targets: progress?.targets ?? [], current, total, className });
  }

  private accumulatedOccupation(run: { results: unknown[] }): CreneauOccupe[] {
    return run.results.flatMap(result => {
      const item = result as RunResult;
      return item.occupation ?? [];
    });
  }
}
