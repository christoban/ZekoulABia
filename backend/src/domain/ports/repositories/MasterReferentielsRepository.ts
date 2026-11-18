/**
 * DOMAIN LAYER — Port Repository MasterReferentiels
 * Encapsule l'accès aux référentiels nationaux (calendriers, coefficients, progressions, tarifs).
 */
import type { TypeFraisMinesec } from '@domain/types/enums';

export interface OfficialCalendarRecord {
  id: string;
  academicYear: string;
  establishmentType: string;
  arreteReference: string | null;
  dateRentreeOfficielle: Date;
  dateClotureOfficielle: Date;
  trimestres: unknown;
  periodesVacances: unknown;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BacCoefficientRecord {
  id: string;
  subjectName: string;
  serie: string;
  niveau: string;
  coefficient: number;
  groupe: number;
  templateCode: string;
  source: string;
  isOfficialMinesec: boolean;
}

export interface TemplateSubjectLoadRecord {
  id: string;
  templateCode: string;
  classLevel: string;
  subjectName: string;
  coefficient: number;
  weeklyPeriods: number | null;
  filiere: string;
}

export interface OfficialProgressionRecord {
  id: string;
  templateCode: string;
  level: string;
  filiere: string | null;
  subjectName: string;
  titre: string;
  chapitres: unknown;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TarifMinesecRecord {
  id: string;
  typeFrais: TypeFraisMinesec;
  anneeScolaire: string;
  niveau: string | null;
  montantFCFA: number;
  description: string | null;
  actif: boolean;
  createdAt: Date;
}

export interface MasterReferentielsSummaryCounts {
  calendarCount: number;
  calendars: Array<{ academicYear: string; active: boolean }>;
  bacCoefficientsCount: number;
  cycleCoefficientsCount: number;
  anglophoneLoadsCount: number;
  progressionsCount: number;
  tarifsCount: number;
  templatesCount: number;
}

export interface MasterReferentielsRepository {
  getSummaryCounts(): Promise<MasterReferentielsSummaryCounts>;

  // Calendriers
  listCalendars(): Promise<OfficialCalendarRecord[]>;
  findCalendarById(id: string): Promise<OfficialCalendarRecord | null>;
  saveCalendar(input: {
    id?: string;
    academicYear: string;
    establishmentType: string;
    arreteReference?: string | null;
    dateRentreeOfficielle: Date;
    dateClotureOfficielle: Date;
    trimestres: unknown;
    periodesVacances: unknown;
    active: boolean;
  }): Promise<OfficialCalendarRecord>;
  updateCalendarActive(id: string, active: boolean): Promise<OfficialCalendarRecord>;

  // Coefficients Bac
  listBacCoefficients(filter: {
    serie?: string;
    niveau?: string;
    templateCode?: string;
    search?: string;
  }): Promise<BacCoefficientRecord[]>;
  findBacCoefficientById(id: string): Promise<BacCoefficientRecord | null>;
  saveBacCoefficient(input: {
    id?: string;
    subjectName: string;
    serie: string;
    niveau: string;
    coefficient: number;
    groupe: number;
    templateCode: string;
    source: string;
    isOfficialMinesec: boolean;
  }): Promise<BacCoefficientRecord>;
  deleteBacCoefficient(id: string): Promise<void>;

  // Matières / Volumes horaires par template
  listAnglophoneSubjectLoads(filter: {
    templateCode?: string;
    classLevel?: string;
    filiere?: string;
    search?: string;
  }): Promise<TemplateSubjectLoadRecord[]>;
  listCycleCoefficients(filter: {
    templateCode?: string;
    classLevel?: string;
    filiere?: string;
    search?: string;
  }): Promise<TemplateSubjectLoadRecord[]>;
  findAnglophoneSubjectLoadById(id: string): Promise<TemplateSubjectLoadRecord | null>;
  findCycleCoefficientById(id: string): Promise<TemplateSubjectLoadRecord | null>;
  saveAnglophoneSubjectLoad(input: {
    id?: string;
    templateCode: string;
    classLevel: string;
    subjectName: string;
    coefficient: number;
    weeklyPeriods: number | null;
    filiere: string;
  }): Promise<TemplateSubjectLoadRecord>;
  saveCycleCoefficient(input: {
    id?: string;
    templateCode: string;
    classLevel: string;
    subjectName: string;
    coefficient: number;
    weeklyPeriods: number | null;
    filiere: string;
  }): Promise<TemplateSubjectLoadRecord>;
  deleteAnglophoneSubjectLoad(id: string): Promise<void>;
  deleteCycleCoefficient(id: string): Promise<void>;

  // Progressions officielles
  listProgressions(filter: {
    templateCode?: string;
    level?: string;
    search?: string;
  }): Promise<OfficialProgressionRecord[]>;
  findProgressionById(id: string): Promise<OfficialProgressionRecord | null>;
  saveProgression(input: {
    id?: string;
    templateCode: string;
    level: string;
    filiere: string | null;
    subjectName: string;
    titre: string;
    chapitres: unknown;
    active: boolean;
  }): Promise<OfficialProgressionRecord>;
  deleteProgression(id: string): Promise<void>;

  // Tarifs MINESEC
  listTarifsMinesec(filter: {
    anneeScolaire?: string;
    typeFrais?: TypeFraisMinesec;
  }): Promise<TarifMinesecRecord[]>;
  findTarifMinesecById(id: string): Promise<TarifMinesecRecord | null>;
  saveTarifMinesec(input: {
    id?: string;
    typeFrais: TypeFraisMinesec;
    anneeScolaire: string;
    niveau: string | null;
    montantFCFA: number;
    description: string | null;
    actif: boolean;
  }): Promise<TarifMinesecRecord>;
  updateTarifActive(id: string, actif: boolean): Promise<TarifMinesecRecord>;
}

