import type { CreneauALoter, TimetableRepository } from '@domain/ports/repositories/TimetableRepository';
import type { CreneauOccupe, SeanceGroupeProposee, SeanceProposee } from '@domain/ports/services/SchedulingSolverPort';
import { validerReglesPedagogiquesProposition } from '@domain/rules/ReglesPedagogiquesEmploiDuTemps';
import type { ProposerEmploiDuTempsUseCase } from './ProposerEmploiDuTempsUseCase';

export type StatutPropositionGlobale = 'SUCCESS' | 'DEGRADE' | 'PARTIEL';

export interface AppliquerLotEmploiDuTempsCommande {
  schoolId: string;
  propositions: Array<{
    timetableId: string;
    statut: StatutPropositionGlobale;
    confirmationPartiel?: boolean;
    seances: SeanceProposee[];
    seancesGroupes?: SeanceGroupeProposee[];
  }>;
}

export interface AppliquerLotEmploiDuTempsResultat {
  creneauxCrees: number;
}

function normaliserGroupes(seances: SeanceGroupeProposee[]): SeanceGroupeProposee[] {
  return [...seances]
    .sort((a, b) => a.groupId.localeCompare(b.groupId))
    .map(seance => ({
      subjectId: seance.subjectId,
      teacherId: seance.teacherId,
      roomId: seance.roomId,
      dayOfWeek: seance.dayOfWeek,
      startTime: seance.startTime,
      endTime: seance.endTime,
      groupId: seance.groupId,
      groupName: seance.groupName,
      participantsCount: seance.participantsCount,
      isLV2Slot: seance.isLV2Slot,
    }));
}

export class AppliquerLotEmploiDuTempsUseCase {
  constructor(
    private readonly timetableRepository: TimetableRepository,
    private readonly proposer: Pick<ProposerEmploiDuTempsUseCase, 'chargerContexte'> & Pick<ProposerEmploiDuTempsUseCase, 'calculerSeancesGroupes'>,
  ) {}

  async execute(commande: AppliquerLotEmploiDuTempsCommande): Promise<AppliquerLotEmploiDuTempsResultat> {
    if (commande.propositions.length === 0) throw new Error('Lot vide : aucune proposition à appliquer');
     const lots: Array<{ timetableId: string; creneaux: CreneauALoter[] }> = [];
     const occupationSupplementaire: CreneauOccupe[] = [];
     const timetableIds = commande.propositions.map(proposition => proposition.timetableId);
     for (const proposition of commande.propositions) {
       if (!['SUCCESS', 'DEGRADE', 'PARTIEL'].includes(proposition.statut)) throw new Error(`Statut de proposition invalide : ${proposition.timetableId}`);
       if (proposition.statut === 'PARTIEL' && proposition.confirmationPartiel !== true) throw new Error(`Proposition PARTIEL : confirmation explicite requise pour ${proposition.timetableId}`);
       if (proposition.seances.length === 0 && (proposition.seancesGroupes?.length ?? 0) === 0) throw new Error(`Proposition vide : ${proposition.timetableId}`);
       const contexte = await this.proposer.chargerContexte({
         timetableId: proposition.timetableId,
         schoolId: commande.schoolId,
         ignoreTimetableIds: timetableIds,
         occupationSupplementaire,
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
      const groupesRecus = normaliserGroupes(proposition.seancesGroupes ?? []);
      const groupesAttendus = normaliserGroupes(groupesAttendusCalcules);
      if (JSON.stringify(groupesRecus) !== JSON.stringify(groupesAttendus)) throw new Error(`Proposition LV2 invalide ou obsolète : ${proposition.timetableId}`);
      const casesOccupees = new Set(seances.map(seance => `${seance.dayOfWeek}|${seance.startTime}|${seance.endTime}`));
       const tempsLibres: CreneauALoter[] = contexte.grille
         .filter(grilleCase => !casesOccupees.has(`${grilleCase.dayOfWeek}|${grilleCase.startTime}|${grilleCase.endTime}`))
         .map(grilleCase => ({ ...grilleCase, kind: 'FREE' }));
       occupationSupplementaire.push(...seances.map(seance => ({ teacherId: seance.teacherId, roomId: seance.roomId, dayOfWeek: seance.dayOfWeek, startTime: seance.startTime, endTime: seance.endTime })));
       lots.push({ timetableId: proposition.timetableId, creneaux: [...seances, ...tempsLibres] });
    }
    if (!this.timetableRepository.appliquerCreneauxLotsEnAtomique) throw new Error('Repository sans application atomique par lot');
    return this.timetableRepository.appliquerCreneauxLotsEnAtomique(commande.schoolId, lots);
  }
}
