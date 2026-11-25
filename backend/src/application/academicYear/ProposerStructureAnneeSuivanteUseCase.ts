/**
 * APPLICATION LAYER — Use Case : Proposer la structure de classes de l'année suivante
 *
 * Première étape du workflow de clôture (design tranché) : jamais de clonage silencieux.
 * Clone 1:1 (même nom, niveau, série, filière, section, capacité) chaque classe ACTIVE de
 * l'année en cours vers l'année suivante, en statut DRAFT — l'Admin renomme/ajuste/supprime
 * ensuite via les endpoints classes existants (ex. "6ème A" → "5ème A") avant de valider.
 *
 * Enregistre aussi, dès cette étape, le mapping ClassPromotion (ancienne classe → nouvelle
 * classe DRAFT) que CloturerAnneeUseCase consomme déjà tel quel — aucune modification requise
 * côté clôture. Si l'admin renomme la classe DRAFT ensuite, c'est la même ligne (même id) :
 * le mapping reste valide.
 */
import { Classe } from '@domain/entities/Classe';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { PromotionRepository } from '@domain/ports/repositories/PromotionRepository';

export interface ProposerStructureCommande {
  schoolId: string;
  anneeActuelleId: string;
  anneeSuivanteId: string;
}

export interface ClasseProposee {
  classeActuelleId: string;
  classeActuelleNom: string;
  classeProposeeId: string;
  classeProposeeNom: string;
}

export interface ProposerStructureResultat {
  anneeSuivanteId: string;
  classesProposees: ClasseProposee[];
}

export class ProposerStructureAnneeSuivanteUseCase {
  constructor(
    private readonly anneeRepository: AnneeAcademiqueRepository,
    private readonly classeRepository: ClasseRepository,
    private readonly promotionRepository: PromotionRepository,
  ) {}

  async execute(commande: ProposerStructureCommande): Promise<ProposerStructureResultat> {
    const anneeActuelle = await this.anneeRepository.findById(commande.anneeActuelleId);
    if (!anneeActuelle) throw new Error(`Année académique introuvable : ${commande.anneeActuelleId}`);
    if (anneeActuelle.schoolId !== commande.schoolId) throw new Error('Accès refusé');
    if (anneeActuelle.status === 'ARCHIVED') {
      throw new Error('Cette année est déjà archivée — impossible de proposer une structure pour la suivante');
    }

    const anneeSuivante = await this.anneeRepository.findById(commande.anneeSuivanteId);
    if (!anneeSuivante) throw new Error(`Année académique introuvable : ${commande.anneeSuivanteId}`);
    if (anneeSuivante.schoolId !== commande.schoolId) throw new Error('Accès refusé');
    if (anneeSuivante.id === anneeActuelle.id) {
      throw new Error("Proposition de structure impossible : l'année suivante doit être différente de l'année en cours de clôture");
    }

    const classesActuelles = await this.classeRepository.findBySchoolAndYear(commande.schoolId, commande.anneeActuelleId);
    const classesActives = classesActuelles.filter(c => c.status === 'ACTIVE');
    if (classesActives.length === 0) {
      throw new Error("Proposition de structure impossible : aucune classe active sur l'année en cours");
    }

    // Idempotence : jamais de no-op silencieux ni de reclonage par-dessus une proposition (ou
    // une structure déjà validée) existante — rejet explicite (409) pour que l'appelant sache
    // que l'état réel diffère de ce qu'il croyait déclencher.
    const classesExistantes = await this.classeRepository.findBySchoolAndYear(commande.schoolId, commande.anneeSuivanteId);
    if (classesExistantes.length > 0) {
      throw new Error(
        'Une structure est déjà proposée pour cette année. Validez-la ou annulez-la avant d\'en proposer une nouvelle.'
      );
    }

    const classesProposees: ClasseProposee[] = [];
    const mappings: { schoolId: string; academicYearId: string; fromClassId: string; toClassId: string }[] = [];

    for (const classe of classesActives) {
      const nouvelleClasse = Classe.create({
        schoolId: commande.schoolId,
        academicYearId: commande.anneeSuivanteId,
        name: classe.name,
        level: classe.level,
        serie: classe.serie,
        filiere: classe.filiere,
        sectionId: classe.sectionId,
        capacity: classe.capacity,
        status: 'DRAFT',
      });
      await this.classeRepository.save(nouvelleClasse);

      classesProposees.push({
        classeActuelleId: classe.id,
        classeActuelleNom: classe.nomComplet,
        classeProposeeId: nouvelleClasse.id,
        classeProposeeNom: nouvelleClasse.nomComplet,
      });

      mappings.push({
        schoolId: commande.schoolId,
        academicYearId: commande.anneeActuelleId,
        fromClassId: classe.id,
        toClassId: nouvelleClasse.id,
      });
    }

    await this.promotionRepository.creerMappingsPromotion(mappings);

    return { anneeSuivanteId: commande.anneeSuivanteId, classesProposees };
  }
}
