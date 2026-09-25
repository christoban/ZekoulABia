import type { CreneauALoter, TimetableRepository } from '@domain/ports/repositories/TimetableRepository';
import type { SeanceGroupeProposee, SeanceProposee } from '@domain/ports/services/SchedulingSolverPort';
import { validerReglesPedagogiquesProposition } from '@domain/rules/ReglesPedagogiquesEmploiDuTemps';
import type { ProposerEmploiDuTempsUseCase } from './ProposerEmploiDuTempsUseCase';

export interface AppliquerLotEmploiDuTempsCommande {
  schoolId: string;
  propositions: Array<{
    timetableId: string;
    seances: SeanceProposee[];
    seancesGroupes?: SeanceGroupeProposee[];
  }>;
}

export interface AppliquerLotEmploiDuTempsResultat {
  creneauxCrees: number;
}

export class AppliquerLotEmploiDuTempsUseCase {
  constructor(
    private readonly timetableRepository: TimetableRepository,
    private readonly proposer: Pick<ProposerEmploiDuTempsUseCase, 'chargerContexte'> & Pick<ProposerEmploiDuTempsUseCase, 'calculerSeancesGroupes'>,
  ) {}

  async execute(commande: AppliquerLotEmploiDuTempsCommande): Promise<AppliquerLotEmploiDuTempsResultat> {
    if (commande.propositions.length === 0) throw new Error('Lot vide : aucune proposition à appliquer');
    const lots: Array<{ timetableId: string; creneaux: CreneauALoter[] }> = [];
    for (const proposition of commande.propositions) {
      if (proposition.seances.length === 0 && (proposition.seancesGroupes?.length ?? 0) === 0) throw new Error(`Proposition vide : ${proposition.timetableId}`);
      const contexte = await this.proposer.chargerContexte({
        timetableId: proposition.timetableId,
        schoolId: commande.schoolId,
      });
      const seances = [...proposition.seances, ...(proposition.seancesGroupes ?? [])];
      try {
        validerReglesPedagogiquesProposition(proposition.seances, contexte.exigences, contexte.grille);
      } catch {
        throw new Error(`Règle pédagogique bloquante pour ${proposition.timetableId}`);
      }
      const groupesAttendusCalcules = contexte.groupesLV2?.length
        ? await this.proposer.calculerSeancesGroupes(contexte, proposition.seances)
        : [];
      const groupesRecus = [...(proposition.seancesGroupes ?? [])].sort((a, b) => a.groupId.localeCompare(b.groupId));
      const groupesAttendus = [...groupesAttendusCalcules].sort((a, b) => a.groupId.localeCompare(b.groupId));
      if (JSON.stringify(groupesRecus) !== JSON.stringify(groupesAttendus)) throw new Error(`Proposition LV2 invalide ou obsolète : ${proposition.timetableId}`);
      const casesOccupees = new Set(seances.map(seance => `${seance.dayOfWeek}|${seance.startTime}|${seance.endTime}`));
      const tempsLibres: CreneauALoter[] = contexte.grille
        .filter(grilleCase => !casesOccupees.has(`${grilleCase.dayOfWeek}|${grilleCase.startTime}|${grilleCase.endTime}`))
        .map(grilleCase => ({ ...grilleCase, kind: 'FREE' }));
      lots.push({ timetableId: proposition.timetableId, creneaux: [...seances, ...tempsLibres] });
    }
    if (!this.timetableRepository.appliquerCreneauxLotsEnAtomique) throw new Error('Repository sans application atomique par lot');
    return this.timetableRepository.appliquerCreneauxLotsEnAtomique(commande.schoolId, lots);
  }
}
