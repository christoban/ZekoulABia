/**
 * APPLICATION LAYER — Use Case : Annuler la structure proposée pour l'année suivante
 *
 * Sans ce use case, la seule façon d'annuler une proposition non désirée était de supprimer les
 * classes une par une via DELETE /classes/:id — endpoint générique qui ignore le contexte
 * "annulation de structure", laisse les ClassPromotion associés orphelins (RESTRICT sur
 * toClassId empêcherait même la suppression), et produit une piste d'audit illisible (N
 * suppressions séparées au lieu d'une action cohérente). Referme aussi le garde-fou anti-doublon
 * de ProposerStructureAnneeSuivanteUseCase : sans lui, un admin qui change d'avis restait
 * bloqué.
 *
 * On n'annule qu'une proposition non validée, jamais une structure déjà en production —
 * suffit qu'UNE classe ACTIVE existe sur l'année pour refuser, même si des DRAFT restent aussi
 * (état mixte : décision humaine requise, pas d'annulation partielle automatique).
 */
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';

export interface AnnulerStructureCommande {
  schoolId: string;
  anneeSuivanteId: string;
}

export interface AnnulerStructureResultat {
  classesSupprimees: number;
}

export class AnnulerStructureProposeeUseCase {
  constructor(
    private readonly anneeRepository: AnneeAcademiqueRepository,
    private readonly classeRepository: ClasseRepository,
  ) {}

  async execute(commande: AnnulerStructureCommande): Promise<AnnulerStructureResultat> {
    const annee = await this.anneeRepository.findById(commande.anneeSuivanteId);
    if (!annee) throw new Error(`Année académique introuvable : ${commande.anneeSuivanteId}`);
    if (annee.schoolId !== commande.schoolId) throw new Error('Accès refusé');

    const classes = await this.classeRepository.findBySchoolAndYear(commande.schoolId, commande.anneeSuivanteId);

    const classesActives = classes.filter(c => c.status === 'ACTIVE');
    if (classesActives.length > 0) {
      throw new Error(
        "Cette structure a déjà été validée (classes ACTIVE présentes) — on n'annule qu'une proposition non validée, pas une structure déjà en production."
      );
    }

    const classesDraft = classes.filter(c => c.status === 'DRAFT');
    if (classesDraft.length === 0) {
      throw new Error('Aucune structure proposée (classe DRAFT) introuvable pour cette année — rien à annuler.');
    }

    // Transaction unique côté persistance : supprime les classes DRAFT ET leurs mappings
    // ClassPromotion ensemble (voir PrismaClasseRepository.annulerPropositionAnnee) — jamais
    // l'un sans l'autre, même en cas d'erreur à mi-parcours.
    const idsSupprimes = await this.classeRepository.annulerPropositionAnnee(commande.schoolId, commande.anneeSuivanteId);

    return { classesSupprimees: idsSupprimes.length };
  }
}
