/**
 * DOMAIN LAYER — Port Service d'auto-matérialisation non bloquante des programmes
 * nationaux lors du cycle de vie (activation d'établissement, création de classe,
 * validation de structure de nouvelle année).
 *
 * L'implémentation concrète vérifie le feature flag ENABLE_OFFICIAL_PROGRAMMES_MATERIALISATION
 * et isole toute erreur afin de ne jamais bloquer le flux appelant.
 */
export interface AutoMaterialisationProgrammesPort {
  /** Matérialise silencieusement les programmes officiels pour une classe nouvellement créée. */
  materialiserPourClasseSiActif(params: {
    schoolId: string;
    classId: string;
    academicYearId?: string;
  }): Promise<void>;

  /** Matérialise silencieusement les programmes officiels pour toutes les classes d'une école/année. */
  materialiserPourEcoleSiActif(params: {
    schoolId: string;
    academicYearId?: string;
  }): Promise<void>;
}
