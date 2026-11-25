/**
 * APPLICATION LAYER — Use Case : Valider la structure de classes proposée pour l'année suivante
 *
 * Seconde étape du workflow de clôture, après revue admin des classes DRAFT créées par
 * ProposerStructureAnneeSuivanteUseCase (renommage, suppression, ajout via les endpoints
 * classes existants). Bascule toutes les classes DRAFT de l'année suivante en ACTIVE — les
 * mappings ClassPromotion existent déjà depuis la proposition, rien à écrire ici. Une fois
 * validée, CloturerAnneeUseCase peut être appelé pour promouvoir réellement les élèves.
 */
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';

export interface ValiderStructureCommande {
  schoolId: string;
  anneeSuivanteId: string;
}

export interface ValiderStructureResultat {
  classesActivees: number;
}

export class ValiderStructureAnneeSuivanteUseCase {
  constructor(
    private readonly anneeRepository: AnneeAcademiqueRepository,
    private readonly classeRepository: ClasseRepository,
  ) {}

  async execute(commande: ValiderStructureCommande): Promise<ValiderStructureResultat> {
    const annee = await this.anneeRepository.findById(commande.anneeSuivanteId);
    if (!annee) throw new Error(`Année académique introuvable : ${commande.anneeSuivanteId}`);
    if (annee.schoolId !== commande.schoolId) throw new Error('Accès refusé');

    const classes = await this.classeRepository.findBySchoolAndYear(commande.schoolId, commande.anneeSuivanteId);
    const classesDraft = classes.filter(c => c.status === 'DRAFT');
    if (classesDraft.length === 0) {
      // Idempotence : distingue "jamais proposée" (422, l'appelant doit d'abord proposer) de
      // "déjà validée" (409, rejet explicite — jamais de no-op silencieux sur un second appel).
      // Pas de flag d'état dédié sur AcademicYear : la présence de classes ACTIVE pour cette
      // année est le signal fiable qu'une validation a déjà eu lieu (activerToutesDraft() est
      // le seul chemin qui fait passer une classe DRAFT→ACTIVE sur l'année suivante).
      const classesActives = classes.filter(c => c.status === 'ACTIVE');
      if (classesActives.length > 0) {
        throw new Error('Cette structure a déjà été validée.');
      }
      throw new Error('Validation de structure impossible : aucune classe proposée (DRAFT) pour cette année — appelez d\'abord la proposition de structure');
    }

    const classesActivees = await this.classeRepository.activerToutesDraft(commande.schoolId, commande.anneeSuivanteId);
    return { classesActivees };
  }
}
