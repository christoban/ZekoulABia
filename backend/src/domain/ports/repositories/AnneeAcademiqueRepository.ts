/**
 * DOMAIN LAYER — Port Repository AnneeAcademique
 * Couvre AcademicYear, AcademicPeriod et AcademicSequence.
 */
import type { AcademicYearStatus, PeriodType, SequenceType } from '@domain/types/enums';

export interface AnneeAcademiqueProps {
  id: string;
  schoolId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  status: AcademicYearStatus;
}

export interface PeriodeAcademiqueProps {
  id: string;
  academicYearId: string;
  name: string;
  type: PeriodType;
  orderIndex: number;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
}

export interface SequenceAcademiqueProps {
  id: string;
  academicPeriodId: string;
  schoolId: string;
  name: string;
  type: SequenceType;
  orderIndex: number;
  startDate?: Date;
  endDate?: Date;
  isCurrent: boolean;
}

export interface CalendrierPeriode {
  id?: string;
  name: string;
  type: PeriodType;
  orderIndex: number;
  startDate: Date;
  endDate: Date;
  sequences: {
    id?: string;
    name: string;
    type: SequenceType;
    orderIndex: number;
    startDate?: Date;
    endDate?: Date;
  }[];
}

export interface AnneeAcademiqueRepository {
  // --- Années ---
  findById(id: string): Promise<AnneeAcademiqueProps | null>;
  findBySchool(schoolId: string): Promise<AnneeAcademiqueProps[]>;
  findCourante(schoolId: string): Promise<AnneeAcademiqueProps | null>;
  existsByName(schoolId: string, name: string): Promise<boolean>;
  save(annee: AnneeAcademiqueProps): Promise<void>;
  update(annee: AnneeAcademiqueProps): Promise<void>;
  archiver(anneeId: string): Promise<void>;

  /**
   * Invariant : exactement 1 année courante par école.
   * Désactive toutes les années avant d'en activer une nouvelle.
   */
  desactiverToutesAnneesEcole(schoolId: string): Promise<void>;

  // --- Périodes ---
  /**
   * Le `schoolId` est OBLIGATOIRE : une période d'une autre école doit être introuvable, pas
   * seulement interdite. Paramètre requis pour que le compilateur empêche tout appelant de l'omettre.
   * NB : AcademicPeriod ne porte pas de schoolId — le filtrage passe par la relation academicYear.
   */
  findPeriodeById(id: string, schoolId: string): Promise<PeriodeAcademiqueProps | null>;
  findPeriodesByAnnee(academicYearId: string): Promise<PeriodeAcademiqueProps[]>;
  findPeriodeCourante(schoolId: string): Promise<PeriodeAcademiqueProps | null>;
  findDernierePeriode(academicYearId: string): Promise<PeriodeAcademiqueProps | null>;
  savePeriode(periode: PeriodeAcademiqueProps): Promise<void>;

  /**
   * Invariant : exactement 1 période courante par année.
   */
  desactiverToutesPeriodes(academicYearId: string): Promise<void>;
  activerPeriode(periodeId: string): Promise<void>;

  // --- Séquences ---
  /**
   * Le `schoolId` est OBLIGATOIRE : une séquence d'une autre école doit être introuvable, pas
   * seulement interdite. Paramètre requis pour que le compilateur empêche tout appelant de l'omettre.
   */
  findSequenceById(id: string, schoolId: string): Promise<SequenceAcademiqueProps | null>;
  findSequencesByPeriode(academicPeriodId: string): Promise<SequenceAcademiqueProps[]>;
  findSequenceCourante(schoolId: string): Promise<SequenceAcademiqueProps | null>;
  saveSequence(sequence: SequenceAcademiqueProps): Promise<void>;

  /**
   * Invariant : exactement 1 séquence courante par période.
   */
  desactiverToutesSequences(academicPeriodId: string): Promise<void>;
  activerSequence(sequenceId: string): Promise<void>;

  // --- Calendrier ---
  /**
   * Upsert structurel complet : périodes + séquences en transaction.
   * Si id fourni → update, sinon → create.
   */
  upsertCalendrier(
    academicYearId: string,
    schoolId: string,
    periodes: CalendrierPeriode[]
  ): Promise<void>;

  // --- Vérifications pré-clôture ---
  /**
   * Compte les notes non validées (pas LOCKED) pour toute une année.
   */
  countNotesNonValidees(academicYearId: string): Promise<number>;

  /**
   * Retourne les classes ayant des bulletins manquants pour au moins une période.
   * Optimisé : O(3+M) requêtes (M = nombre de périodes) au lieu de N×M séquentielles.
   */
  getClassesAvecBulletinsManquants(
    academicYearId: string
  ): Promise<{ classeId: string; classeNom: string; periodeNom: string }[]>;

  /**
   * Retourne les classes sans conseil de classe verrouillé pour la dernière période.
   */
  getClassesSansConseilVerrouille(
    academicYearId: string
  ): Promise<{ classeId: string; classeNom: string }[]>;
}
