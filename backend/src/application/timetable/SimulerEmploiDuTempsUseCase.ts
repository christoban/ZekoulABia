import type { TimetableRepository } from '@domain/ports/repositories/TimetableRepository';
import type { SchedulingSolverPort, PropositionEmploiDuTemps, SeanceProposee } from '@domain/ports/services/SchedulingSolverPort';
import type { ProposerEmploiDuTempsUseCase, ContexteEmploiDuTemps } from './ProposerEmploiDuTempsUseCase';
import { CreneauHoraire } from '@domain/entities/CreneauHoraire';

/** Simulations « what if » — aucune n'écrit jamais en base. */
export interface SimulationEmploiDuTemps {
  indisponibilitesSupplementaires?: { teacherId: string; dayOfWeek: number; startTime: string; endTime: string }[];
  sallesHorsService?: string[];
  retraitHeures?: { subjectId: string; heures: number }[];
}

export interface SimulerEmploiDuTempsCommande {
  timetableId: string;
  schoolId: string;
  simulations: SimulationEmploiDuTemps;
}

export interface ResultatSimulation {
  propositionSimulee: PropositionEmploiDuTemps;
  differences: {
    seancesDeplacees: number;
    scoreBase: number;
    scoreSimule: number;
    avertissements: string[];
  };
}

export class SimulerEmploiDuTempsUseCase {
  constructor(
    private readonly proposer: ProposerEmploiDuTempsUseCase,
    private readonly solver: SchedulingSolverPort,
    private readonly timetableRepository: TimetableRepository,
  ) {}

  async execute(commande: SimulerEmploiDuTempsCommande): Promise<ResultatSimulation> {
    await this.verifierIsolationTenant(commande.schoolId, commande.simulations);

    const contexte = await this.proposer.chargerContexte(commande);

    // Base recalculée dans le même appel (pas de cache) — référence de comparaison.
    const contexteSimule = appliquerSimulations(contexte, commande.simulations);
    const base = await this.avecSeancesGroupes(contexte, await this.solver.proposer(contexte));
    const propositionSimulee = await this.avecSeancesGroupes(contexteSimule, await this.solver.proposer(contexteSimule));

    return {
      propositionSimulee,
      differences: {
        seancesDeplacees: compterSeancesDeplacees([...base.seances, ...(base.seancesGroupes ?? [])], [...propositionSimulee.seances, ...(propositionSimulee.seancesGroupes ?? [])]),
        scoreBase: base.scoreObjectif,
        scoreSimule: propositionSimulee.scoreObjectif,
        avertissements: [],
      },
    };
  }

  private async avecSeancesGroupes(contexte: ContexteEmploiDuTemps, proposition: PropositionEmploiDuTemps): Promise<PropositionEmploiDuTemps> {
    if (proposition.statut === 'INFAISABLE') return proposition;
    return { ...proposition, seancesGroupes: await this.proposer.calculerSeancesGroupes(contexte, proposition.seances) };
  }

  /** Isolation multi-tenant : tout id référencé doit appartenir à l'école du token (sinon 404). */
  private async verifierIsolationTenant(schoolId: string, s: SimulationEmploiDuTemps): Promise<void> {
    const teacherIds = s.indisponibilitesSupplementaires?.map(i => i.teacherId) ?? [];
    const roomIds = s.sallesHorsService ?? [];
    const subjectIds = s.retraitHeures?.map(r => r.subjectId) ?? [];

    if (teacherIds.length > 0) {
      const compteur = await this.timetableRepository.compterEnseignants(teacherIds, schoolId);
      if (compteur !== new Set(teacherIds).size) throw new Error('Enseignant introuvable dans votre établissement');
    }
    if (roomIds.length > 0) {
      const compteur = await this.timetableRepository.compterSalles(roomIds, schoolId);
      if (compteur !== new Set(roomIds).size) throw new Error('Salle introuvable dans votre établissement');
    }
    if (subjectIds.length > 0) {
      const compteur = await this.timetableRepository.compterMatieres(subjectIds, schoolId);
      if (compteur !== new Set(subjectIds).size) throw new Error('Matière introuvable dans votre établissement');
    }
  }
}

/** Applique les simulations au contexte — fonction pure, aucune écriture. */
function appliquerSimulations(contexte: ContexteEmploiDuTemps, s: SimulationEmploiDuTemps): ContexteEmploiDuTemps {
  let exigences = contexte.exigences;
  let salles = contexte.sallesDisponibles;
  let indisponibilites = [...contexte.indisponibilitesEnseignants];

  if (s.indisponibilitesSupplementaires?.length) {
    indisponibilites.push(...s.indisponibilitesSupplementaires.map(i => ({ ...i })));
  }
  if (s.sallesHorsService?.length) {
    const horsService = new Set(s.sallesHorsService);
    salles = salles.filter(salle => !horsService.has(salle.roomId));
  }
  if (s.retraitHeures?.length) {
    const dureeCase = dureeCaseMinutes(contexte.grille);
    const retraits = new Map(s.retraitHeures.map(r => [r.subjectId, Math.max(0, Math.floor(r.heures * 60 / dureeCase))]));
    const compteurs = new Map<string, number>();
    exigences = exigences.filter(e => {
      const aRetirer = retraits.get(e.subjectId) ?? 0;
      const dejaRetire = compteurs.get(e.subjectId) ?? 0;
      if (dejaRetire < aRetirer) {
        compteurs.set(e.subjectId, dejaRetire + 1);
        return false;
      }
      return true;
    });
  }

  return { ...contexte, exigences, sallesDisponibles: salles, indisponibilitesEnseignants: indisponibilites };
}

/** Nombre de séances dont le placement diffère entre base et simulation. */
function compterSeancesDeplacees(base: SeanceProposee[], simule: SeanceProposee[]): number {
  const cle = (s: SeanceProposee) => `${s.subjectId}|${s.teacherId}|${s.dayOfWeek}|${s.startTime}|${s.endTime}|${s.roomId}`;
  const cleSimule = new Set(simule.map(cle));
  return base.filter(s => !cleSimule.has(cle(s))).length;
}

function dureeCaseMinutes(grille: ContexteEmploiDuTemps['grille']): number {
  if (grille.length === 0) return 60;
  const d = CreneauHoraire.heureEnMinutes(grille[0]!.endTime) - CreneauHoraire.heureEnMinutes(grille[0]!.startTime);
  return d > 0 ? d : 60;
}
