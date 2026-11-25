/**
 * DOMAIN LAYER — Port Repository Promotion
 * Gère classPromotion (mapping classe→classe suivante)
 * et studentPromotion (audit des promotions individuelles).
 */
export interface ClassPromotionMapping {
  fromClassId: string;
  toClassId: string;
}

export interface PromotionEleveParams {
  schoolId: string;
  studentId: string;
  fromClassId: string;
  toClassId: string;
  academicYearId: string;
  promotedById: string;
}

export interface DecisionConseil {
  studentId: string;
  fromClassId: string;
  decision: 'PASS' | 'REPEAT' | 'DELIBERATION';
}

export interface PromotionRepository {
  /**
   * Retourne le mapping classe source → classe destination pour une école.
   * Créé par ProposerStructureAnneeSuivanteUseCase, revu par l'Admin avant la clôture.
   */
  findMappingsPromotion(
    schoolId: string,
    academicYearId: string
  ): Promise<ClassPromotionMapping[]>;

  /**
   * Enregistre les mappings classe source → classe (DRAFT) proposée pour l'année suivante.
   * `academicYearId` est l'année COURANTE (celle qu'on s'apprête à clôturer), cohérent avec
   * findMappingsPromotion. Appelé une seule fois par ProposerStructureAnneeSuivanteUseCase.
   */
  creerMappingsPromotion(
    mappings: (ClassPromotionMapping & { schoolId: string; academicYearId: string })[]
  ): Promise<void>;

  /**
   * Retourne toutes les décisions de conseil pour une année.
   * Source : classCouncilDecision (tous les periodes de l'année).
   */
  findDecisionsEleves(
    schoolId: string,
    academicYearId: string
  ): Promise<DecisionConseil[]>;

  /**
   * Déplace un élève vers sa nouvelle classe + enregistre l'audit.
   * Upsert avec clé (studentId, academicYearId).
   */
  promouvoirEleve(params: PromotionEleveParams): Promise<void>;

  /**
   * Met à jour l'inscription d'un élève (clôture l'ancien Enrollment, crée le nouveau).
   */
  mettreAJourClasseEleve(studentId: string, newClassId: string, demandeurId: string): Promise<void>;

  /**
   * Compte les promotions enregistrées pour le rapport de clôture.
   */
  countPromotions(
    schoolId: string,
    academicYearId: string
  ): Promise<{ promus: number; redoublants: number }>;

  /**
   * Résout la classe cible depuis une recommandation d'orientation finalisée (statut
   * VALIDEE_ELEVE ou VALIDEE_PAR_DEFAUT) pour cet élève sur cette année de clôture — prioritaire
   * sur le mapping générique classe→classe. Retourne null si aucune recommandation finalisée
   * n'existe (comportement normal pour la quasi-totalité des élèves, hors année de checkpoint).
   */
  findClasseCibleOrientation(
    schoolId: string,
    studentId: string,
    academicYearId: string
  ): Promise<string | null>;
}
