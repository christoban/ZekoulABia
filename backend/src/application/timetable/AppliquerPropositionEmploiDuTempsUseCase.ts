import type { CreneauALoter, TimetableRepository } from '@domain/ports/repositories/TimetableRepository';
import type { SeanceGroupeProposee, SeanceProposee } from '@domain/ports/services/SchedulingSolverPort';
import { validerReglesPedagogiquesProposition } from '@domain/rules/ReglesPedagogiquesEmploiDuTemps';
import type { ProposerEmploiDuTempsUseCase } from './ProposerEmploiDuTempsUseCase';

export interface AppliquerPropositionCommande {
  timetableId: string;
  schoolId: string;
  seances: SeanceProposee[];
  seancesGroupes?: SeanceGroupeProposee[];
}

export interface AppliquerPropositionResultat {
  creneauxCrees: number;
  avertissements?: string[];
}

/**
 * Écrit réellement une proposition d'emploi du temps, après revue et confirmation de l'admin —
 * le solveur ne persiste jamais rien lui-même (jamais de génération silencieuse, même principe
 * que ProposerStructureAnneeSuivanteUseCase / ValiderStructureAnneeSuivanteUseCase).
 *
 * L'écriture est déléguée telle quelle à appliquerPropositionAtomique() : TOUT OU RIEN dans une
 * transaction unique. Si l'état a changé entre la proposition et son application (un créneau
 * ajouté à la main entre-temps), la séance fautive lève ConflitHoraireError/ConflitSalleError et
 * AUCUNE séance de la proposition n'est écrite — jamais d'emploi du temps à moitié appliqué.
 */
export class AppliquerPropositionEmploiDuTempsUseCase {
  constructor(
    private readonly timetableRepository: TimetableRepository,
    private readonly proposer: Pick<ProposerEmploiDuTempsUseCase, 'chargerContexte'> & Partial<Pick<ProposerEmploiDuTempsUseCase, 'calculerSeancesGroupes'>>,
  ) {}

  async execute(commande: AppliquerPropositionCommande): Promise<AppliquerPropositionResultat> {
    const seancesGroupes = commande.seancesGroupes ?? [];
    if (commande.seances.length === 0 && seancesGroupes.length === 0) {
      throw new Error('Proposition vide : aucune séance à appliquer');
    }

    const contexte = await this.proposer.chargerContexte(commande);
    const avertissements: string[] = [];
    try {
      validerReglesPedagogiquesProposition(commande.seances, contexte.exigences, contexte.grille);
    } catch (error) {
      avertissements.push(error instanceof Error ? `Règle pédagogique à revoir : ${error.message}` : 'Une règle pédagogique doit être revue.');
    }

    const seancesGroupesAttendues = (contexte.groupesLV2?.length ?? 0) > 0
      ? await this.proposer.calculerSeancesGroupes?.(contexte, commande.seances)
      : [];
    if (!this.proposer.calculerSeancesGroupes && (contexte.groupesLV2?.length ?? 0) > 0) {
      throw new Error('La proposition LV2 ne peut pas être validée dans ce contexte');
    }
    if (JSON.stringify(this.normaliserGroupes(seancesGroupes)) !== JSON.stringify(this.normaliserGroupes(seancesGroupesAttendues ?? []))) {
      throw new Error('Proposition LV2 invalide ou obsolète : régénérez la proposition avant de l’appliquer');
    }

    // verifierConflits laissé à son défaut (true) : l'état a pu changer entre la proposition et
    // sa confirmation par l'admin, c'est précisément le cas que la re-vérification couvre.
    const seancesOccupees = [...commande.seances, ...seancesGroupes];
    const casesOccupees = new Set(seancesOccupees.map(seance => `${seance.dayOfWeek}|${seance.startTime}|${seance.endTime}`));
    const tempsLibres: CreneauALoter[] = contexte.grille
      .filter(grilleCase => !casesOccupees.has(`${grilleCase.dayOfWeek}|${grilleCase.startTime}|${grilleCase.endTime}`))
      .map(grilleCase => ({ ...grilleCase, kind: 'FREE' }));

    const resultat = await this.timetableRepository.creerCreneauxEnLot(
      commande.timetableId,
      commande.schoolId,
      [...seancesOccupees, ...tempsLibres],
      { remplacerLignesGerees: true },
    );
    return { ...resultat, ...(avertissements.length > 0 ? { avertissements } : {}) };
  }

  private normaliserGroupes(seances: SeanceGroupeProposee[]): SeanceGroupeProposee[] {
    return [...seances].sort((a, b) => a.groupId.localeCompare(b.groupId)).map(seance => ({
      ...seance,
    }));
  }
}
