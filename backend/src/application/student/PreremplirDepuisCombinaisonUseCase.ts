import type { StudentAffectationRepository } from '@domain/ports/repositories/StudentAffectationRepository';
import { ALEVEL_MAX_SUBJECTS } from './AffecterMatieresALevelEleveUseCase';

/**
 * Préremplit les matières A-Level d'un élève depuis une combinaison type (A1-A5 / S1-S…).
 * La combinaison n'est qu'un POINT DE DÉPART : l'élève/admin peut ensuite ajouter/retirer
 * des matières (dans la limite de 5). Consomme AnglophoneStreamCombination (jamais hardcodé).
 */
export interface PreremplirCombinaisonCommande {
  studentUserId: string;
  schoolId: string;
  combinationCode: string; // ex. "S1", "A4"
}

export interface PreremplirResultat {
  count: number;
  applied: { id: string; name: string }[];
  ignores: string[]; // matières de la combinaison absentes de l'établissement
}

export class PreremplirDepuisCombinaisonUseCase {
  constructor(private readonly affectationRepository: StudentAffectationRepository) {}

  async execute(cmd: PreremplirCombinaisonCommande): Promise<PreremplirResultat> {
    const profile = await this.affectationRepository.trouverProfilParUserId(cmd.studentUserId, cmd.schoolId);
    if (!profile) throw new Error('Élève introuvable dans cet établissement');

    const combo = await this.affectationRepository.trouverCombinaisonAnglophone(cmd.combinationCode);
    if (!combo) throw new Error(`Combinaison "${cmd.combinationCode}" introuvable`);

    // Matières de base de la combinaison (core), limitées au maximum GCE
    const wanted = combo.coreSubjects.slice(0, ALEVEL_MAX_SUBJECTS);

    // Résoudre les noms → matières réelles de l'établissement
    const schoolSubjects = await this.affectationRepository.listerMatieresParNoms(wanted, cmd.schoolId);
    const byName = new Map(schoolSubjects.map((s) => [s.name, s]));

    const applied: { id: string; name: string }[] = [];
    const ignores: string[] = [];
    for (const name of wanted) {
      const s = byName.get(name);
      if (s) applied.push({ id: s.id, name: s.name });
      else ignores.push(name);
    }

    // Remplacer la sélection actuelle par le préréglage
    await this.affectationRepository.remplacerMatieresALevel(profile.id, applied.map((s) => s.id));

    return { count: applied.length, applied, ignores };
  }
}
