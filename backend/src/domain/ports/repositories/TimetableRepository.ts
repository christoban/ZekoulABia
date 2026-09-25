import type { EmploiDuTemps } from '@domain/entities/EmploiDuTemps';
import type { CreneauHoraire } from '@domain/entities/CreneauHoraire';
import type { CreneauOccupe } from '@domain/ports/services/SchedulingSolverPort';
import type { SlotKind, TimetableStatus } from '@domain/types/enums';

export interface CreneauConflitInfo {
  id: string;
  startTime: string;
  endTime: string;
  classeNom: string;
}

/** Configuration de grille horaire d'une école (source unique pour calculer le squelette). */
export interface GridConfig {
  heureDebut: string;
  dureePeriode: number;
  periodesAvantP1: number;
  dureePetitePause: number;
  periodesAvantP2: number;
  dureeGrandePause: number;
  periodesApresP2: number;
  joursActifs: string[];
  periodesCoursParJour: Record<string, number>;
}

/** Créneau d'un enseignant pour un jour donné (pré-remplissage formulaire cahier de texte). */
export interface SlotEnseignantJour {
  id: string;
  startTime: string;
  endTime: string;
  subjectId: string | null;
  subjectName: string | null;
  classId: string;
  className: string | null;
}

/** Contexte d'un créneau résolu pour la résolution de participants (séance → classe/groupe). */
export interface SlotContexte {
  schoolId: string;
  classId: string;
  academicYearId: string;
  subjectId: string | null;
  groupId: string | null;
  isLV2Slot: boolean;
  isElectiveSlot: boolean;
  subjectName: string | null;
  restrictedToGroupId: string | null;
}

/** Élève d'une classe avec son profil LV2/A-Level (résolution de participants). */
export interface EleveClasseAvecProfil {
  id: string;
  firstName: string;
  lastName: string;
  studentProfileId: string | null;
  lv2SubjectId: string | null;
  alevelSubjectIds: string[];
}

/** Affectation pédagogique classe-entière avec les infos matière du solveur. */
export interface AffectationSolver {
  teacherId: string;
  subjectId: string;
  subjectType: string;
  hoursPerWeek: number | null;
  weeklyPeriods?: number | null;
  name: string | null;
  blocDureeCases: number | null;
}

export interface NomEnseignant {
  id: string;
  nomComplet: string;
}

/** Créneau du contexte "adjust IA" : matière et enseignant résolus pour le prompt LLM. */
export interface SlotContexteAdjustIA {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subject: { id: string; name: string } | null;
  teacher: { id: string; firstName: string; lastName: string } | null;
}

/** Contexte complet pour l'assistant IA "adjust" : EDT + nom de classe + créneaux enrichis. */
export interface ContexteAdjustIA {
  id: string;
  status: TimetableStatus;
  class: { name: string };
  slots: SlotContexteAdjustIA[];
}

export interface TimetableRepository {
  // --- EmploiDuTemps ---
  findById(id: string): Promise<EmploiDuTemps | null>;
  findByClasse(classId: string, academicYearId: string): Promise<EmploiDuTemps | null>;
  findSubmittedBySchool(schoolId: string): Promise<EmploiDuTemps[]>;
  save(emploiDuTemps: EmploiDuTemps): Promise<void>;
  update(emploiDuTemps: EmploiDuTemps): Promise<void>;
  publishSubmittedBySchool(schoolId: string): Promise<EmploiDuTemps[]>;
  countCreneaux(timetableId: string): Promise<number>;

  // --- Créneaux ---
  findCreneauById(id: string): Promise<CreneauHoraire | null>;
  findCreneauxByTimetable(timetableId: string): Promise<CreneauHoraire[]>;
  saveCreneaux(creneau: CreneauHoraire): Promise<void>;
  updateCreneau(creneau: CreneauHoraire): Promise<void>;
  deleteCreneau(id: string, timetableId: string): Promise<void>;
  deleteCreneauxTimetable(timetableId: string): Promise<number>;

  /**
   * Retourne les créneaux existants d'un enseignant pour un jour donné.
   * Filtre par schoolId pour éviter les faux conflits inter-écoles.
   */
  findCreneauxEnseignantParJour(
    teacherId: string,
    dayOfWeek: number,
    schoolId: string,
    excludeId?: string
  ): Promise<CreneauConflitInfo[]>;

  /**
   * Calcule le volume horaire hebdomadaire d'un enseignant (créneaux CLASS uniquement).
   * Utilisé pour la vérification Loi 7 (AP ≤ 14h). Filtre par schoolId.
   */
  calculerVolumeHoraireHebdo(
    teacherId: string,
    schoolId: string,
    excludeId?: string
  ): Promise<number>;

  /**
   * Vérifie si un enseignant a la permission AP/HOD.
   * Retourne le nom de l'enseignant pour les messages d'erreur.
   */
  getInfosEnseignant(
    teacherId: string
  ): Promise<{ nom: string; estAP: boolean } | null>;

  /**
   * Retourne le nom d'une salle pour les messages d'erreur de conflit — même raisonnement que
   * getInfosEnseignant : le TimetableRepository résout un nom d'affichage plutôt que d'imposer
   * une dépendance RoomRepository aux use cases Ajouter/ModifierCreneauUseCase.
   */
  getInfosSalle(roomId: string): Promise<{ nom: string } | null>;

  /**
   * Retourne les créneaux existants d'une salle pour un jour donné — même contrat que
   * findCreneauxEnseignantParJour. C'est la requête que le futur Scheduling Engine (V2.5)
   * consommera comme hard constraint "conflit de salle".
   */
  findCreneauxSalleParJour(
    roomId: string,
    dayOfWeek: number,
    schoolId: string,
    excludeId?: string
  ): Promise<CreneauConflitInfo[]>;

  /**
   * Vérifie qu'un sous-groupe appartient bien à la classe de l'EDT.
   */
  sousGroupeAppartientAClasse(
    subGroupId: string,
    classId: string
  ): Promise<boolean>;

  /**
   * Occupation enseignant/salle de TOUTE l'école pour une année — alimente les contraintes dures
   * "déjà pris" du SchedulingSolverPort (V2.5). Exclut l'EDT en cours de proposition
   * (excludeTimetableId) : ses propres créneaux ne doivent pas être vus comme des conflits, on
   * est justement en train de les (re)calculer.
   */
  findOccupationEcole(
    schoolId: string,
    academicYearId: string,
    excludeTimetableId?: string | string[]
  ): Promise<CreneauOccupe[]>;

  /**
   * Écrit un lot de créneaux en TOUT OU RIEN — une transaction unique enveloppe la validation ET
   * l'insertion. Si un seul créneau échoue, rien n'est écrit : jamais d'emploi du temps à moitié
   * appliqué. Chaque créneau est construit via CreneauHoraire.create(), donc le format (heures,
   * jour 0-5) est toujours validé par le domaine, quel que soit l'appelant.
   *
   * `verifierConflits` (défaut true) :
   *  - true  → re-vérifie conflit enseignant + conflit salle, les relectures passant par la
   *            transaction pour que chaque créneau voie ceux déjà insérés dans le même lot.
   *            Lève ConflitHoraireError / ConflitSalleError avec le détail du créneau fautif.
   *  - false → validation de format uniquement, aucune requête de conflit. Réservé aux appelants
   *            pour qui la notion n'a pas de sens — aujourd'hui le seul cas est le squelette de
   *            grille (`GenererSqueletteEmploiDuTempsUseCase`), dont les créneaux n'ont ni
   *            enseignant ni salle : les vérifications seraient des no-ops coûteuses.
   *            Rend explicite et localisé ce qui était auparavant un contournement invisible.
   */
  creerCreneauxEnLot(
    timetableId: string,
    schoolId: string,
    creneaux: CreneauALoter[],
    options?: { verifierConflits?: boolean; remplacerLignesGerees?: boolean }
  ): Promise<{ creneauxCrees: number }>;

  appliquerCreneauxLotsEnAtomique?(
    schoolId: string,
    lots: Array<{ timetableId: string; creneaux: CreneauALoter[] }>
  ): Promise<{ creneauxCrees: number }>;

  /**
   * Configuration de grille horaire de l'école (pour calculer le squelette + la grille du
   * solveur). Null si aucune grille configurée.
   */
  getGridConfig(schoolId: string): Promise<GridConfig | null>;

  /** Persiste (create/update) la configuration de grille d'une école. */
  saveGridConfig(schoolId: string, data: GridConfig): Promise<GridConfig>;

  /** Nombre d'emplois du temps existants pour une école (avertissement "EDT déjà en place"). */
  countTimetablesBySchool(schoolId: string): Promise<number>;

  /** Vérifie qu'une classe appartient bien à l'école (isolation multi-tenant). */
  classeAppartientAEcole(classId: string, schoolId: string): Promise<boolean>;

  /** Contexte complet d'un créneau (timetable + subject) pour résoudre ses participants. */
  findSlotAvecContexte(slotId: string): Promise<SlotContexte | null>;

  /** Créneau CLASS courant d'une salle pour un enseignant à une heure donnée (croisement QR pointage V2.11). */
  findSlotActuelParSalleEtEnseignant(
    roomId: string,
    teacherId: string,
    schoolId: string,
    now: Date,
  ): Promise<{ id: string; dayOfWeek: number; startTime: string; endTime: string; subjectId: string | null; subjectName: string | null; classId: string; className: string | null } | null>;

  /** roomId d'un créneau (gate cahier de textes V2.11 — savoir si un QR salle était configuré). */
  findRoomIdDeSlot(slotId: string): Promise<string | null>;

  /** Élèves actifs d'une classe avec profil LV2/A-Level, ordonnés par nom. */
  findElevesClasseAvecProfils(schoolId: string, classId: string): Promise<EleveClasseAvecProfil[]>;

  /**
   * Affectations pédagogiques classe-entière (hors StudentGroup et hors matière restreinte à un
   * groupe) avec les infos matière nécessaires au solveur (type, volume horaire, bloc).
   */
  findAffectationsSolver(classId: string, schoolId: string, includeGrouped?: boolean): Promise<AffectationSolver[]>;

  /** Noms complets d'enseignants par id (une seule requête groupée, pas de N+1). */
  findNomsEnseignants(teacherIds: string[]): Promise<NomEnseignant[]>;

  /** Isolation multi-tenant : nombre d'enseignants trouvés parmi les ids donnés dans l'école. */
  compterEnseignants(ids: string[], schoolId: string): Promise<number>;

  /** Isolation multi-tenant : nombre de salles trouvées parmi les ids donnés dans l'école. */
  compterSalles(ids: string[], schoolId: string): Promise<number>;

  /** Isolation multi-tenant : nombre de matières trouvées parmi les ids donnés dans l'école. */
  compterMatieres(ids: string[], schoolId: string): Promise<number>;

  /** Ids de classes ayant un emploi du temps PUBLISHED pour une année — anomalies établissement. */
  findClassIdsAvecEdtPublie(schoolId: string, academicYearId: string): Promise<string[]>;

  /** Créneaux CLASS d'un enseignant pour un jour, avec matière et classe (pré-remplissage). */
  findSlotsEnseignantJour(
    teacherId: string,
    dayOfWeek: number,
    schoolId: string,
    academicYearId?: string
  ): Promise<SlotEnseignantJour[]>;

  /** Contexte complet pour l'assistant IA "adjust" : EDT, nom de classe et créneaux enrichis. */
  findContexteAdjustIA(timetableId: string, schoolId: string): Promise<ContexteAdjustIA | null>;
}

/**
 * Un créneau à insérer en lot. Surensemble de SeanceProposee : le solveur produit toujours
 * matière/enseignant/salle, alors qu'un squelette de grille n'a que le jour et l'horaire.
 */
export interface CreneauALoter {
  subjectId?: string;
  teacherId?: string;
  roomId?: string;
  groupId?: string;
  isLV2Slot?: boolean;
  kind?: SlotKind;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}
