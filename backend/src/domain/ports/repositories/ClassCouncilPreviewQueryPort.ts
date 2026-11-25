/**
 * DOMAIN LAYER — Port de lecture dédié à la vue préparatoire du Conseil de Classe (V1.12)
 *
 * Agrège en une seule requête les signaux déjà présents en base (résultats, discipline,
 * orientation) pour alimenter le use case de préparation. Lecture seule — aucune écriture.
 * Existe séparément des repositories CRUD pour éviter d'injecter Prisma ou 4 repositories
 * distincts dans le use case (cohérence hexagonale, cf. audit V0.1).
 */

export type BulletinTemplateSimplifie = 'FR' | 'EN';

export interface DonneesVueConseilParEleve {
  studentId: string;
  firstName: string;
  lastName: string;
  template: BulletinTemplateSimplifie | null;
  moyenneGenerale: number | null;
  rang: number | null;
  moyenneGeneralePeriodePrecedente: number | null;
  moyennesMatieres: number[];
  alertLevel: 'warning' | 'critical' | null;
  casDisciplinaire: boolean;
  orientationNonValidee: boolean;
}

export interface DonneesVueConseil {
  effectif: number;
  eleves: DonneesVueConseilParEleve[];
}

export interface ClassCouncilPreviewQueryPort {
  chargerDonneesVue(params: {
    schoolId: string;
    classId: string;
    academicPeriodId: string;
  }): Promise<DonneesVueConseil>;
}