/**
 * DOMAIN LAYER — Port Repository Classe
 */
import type { Classe } from '@domain/entities/Classe';

export interface ClasseRepository {
  // Lecture
  findById(id: string): Promise<Classe | null>;
  findBySchool(schoolId: string): Promise<Classe[]>;
  findBySection(sectionId: string): Promise<Classe[]>;
  findByLevel(schoolId: string, level: string): Promise<Classe[]>;
  findBySchoolAndYear(schoolId: string, academicYearId: string): Promise<Classe[]>;
  countEleves(classeId: string): Promise<number>;

  /** Bascule DRAFT→ACTIVE toutes les classes proposées d'une année — ValiderStructureAnneeSuivanteUseCase. */
  activerToutesDraft(schoolId: string, academicYearId: string): Promise<number>;

  /**
   * Annule une proposition de structure : supprime définitivement (pas la corbeille —
   * supprimerAvecCascade) toutes les classes DRAFT d'une année ET les mappings ClassPromotion
   * qui pointent dessus, en une transaction unique — AnnulerStructureProposeeUseCase. Une
   * proposition jamais validée n'a par construction aucun élève ni note rattachés, donc rien
   * d'autre à nettoyer. Retourne les ids de classes supprimés.
   */
  annulerPropositionAnnee(schoolId: string, academicYearId: string): Promise<string[]>;

  /**
   * Vérifie l'unicité du nom dans une école.
   * excludeId : exclut la classe courante lors d'une modification.
   */
  existsByName(schoolId: string, name: string, excludeId?: string): Promise<boolean>;

  /**
   * Retourne la classe dont cet enseignant est professeur principal (null si aucune).
   * Utilisé pour la règle : un enseignant ne peut être PP que d'une seule classe.
   */
  findClasseDeProfPrincipal(teacherUserId: string): Promise<Classe | null>;

  /** Recherche floue par nom (contains) — SMS de présence : PRES#CLASSE#1,0,1. */
  findByNameContient(schoolId: string, name: string): Promise<{ id: string; name: string } | null>;

  // Écriture
  save(classe: Classe): Promise<void>;
  update(classe: Classe): Promise<void>;

  /**
   * Suppression douce (Couche 1) — pose deletedAt, ne touche plus aux données liées.
   * Nom historique conservé ("avecCascade"), comportement changé — voir PrismaClasseRepository.
   */
  supprimerAvecCascade(classeId: string, deletedById?: string): Promise<void>;
  restaurer(classeId: string): Promise<void>;

  /** Corbeille (Couche 1) — classes soft-deleted d'une école. */
  listerSupprimes(schoolId: string): Promise<Array<{ id: string; name: string; level: string | null; deletedAt: Date | null; deletedById: string | null }>>;
  trouverSupprime(id: string, schoolId: string): Promise<{ id: string } | null>;

  /** Liste des élèves inscrits activement dans la classe pour génération de template Excel de notes. */
  findElevesActifsPourTemplate(
    schoolId: string,
    classId: string,
  ): Promise<Array<{ matricule: string | null; firstName: string; lastName: string }>>;
}
