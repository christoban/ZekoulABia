/**
 * DOMAIN — Port : solveur d'emploi du temps (V2.5 Scheduling Engine)
 *
 * Le domaine décrit le PROBLÈME (exigences, grille, salles, occupation existante) et reçoit une
 * PROPOSITION — il ne connaît ni CP-SAT, ni OR-Tools, ni WebAssembly. L'implémentation retenue
 * (ORToolsWasmAdapter) est interchangeable, conformément à la roadmap :
 *   SchedulingEngine → SchedulingSolverPort → ORToolsWasmAdapter (aujourd'hui) / autre demain.
 *
 * Le solveur ne PERSISTE jamais rien : il propose, l'admin valide, puis
 * AppliquerPropositionEmploiDuTempsUseCase écrit réellement (jamais de génération silencieuse).
 */
import type { RoomType, SubjectType } from '@domain/types/enums';

/** Une séance à placer : une matière enseignée par un enseignant donné, pour la classe visée. */
export interface ExigenceSeance {
  subjectId: string;
  subjectType: SubjectType;
  teacherId: string;
  durationMinutes: number;
  /** Nom de la matière (rempli par chargerExigences quand hoursPerWeek est connu). */
  subjectName?: string;
  /** Nom de l'enseignant (rempli plus tard depuis le repository). */
  teacherName?: string;
  /** Identifiant interne pour suivre les séances d'une même matière. */
  seanceId?: string;
  /** V2.5 — séances groupées en blocs de N cases adjacentes (2 = blocs de 2 h). null/1 = libre. */
  blocDureeCases?: number | null;
  /** Volume hebdomadaire pédagogique, en heures. */
  volumeHebdomadaire?: number;
  /** Nombre réel d'occurrences générées pour la semaine, après conversion en cases de cours. */
  nbOccurrencesHebdomadaires?: number;
  /** Catégorie exigeant deux jours distincts lorsqu'elle compte deux occurrences. */
  categorieJoursDistincts?: 'EPS_TM';
}

/**
 * Créneau déjà occupé ailleurs dans l'école (autre classe déjà planifiée) — sert à poser les
 * contraintes dures "enseignant déjà pris" / "salle déjà prise" dans le modèle.
 */
export interface CreneauOccupe {
  teacherId?: string;
  roomId?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

/**
 * Indisponibilité d'un enseignant (V2.4) — plage hebdomadaire où il ne peut pas recevoir de
 * séance. Contrainte DURE pour le solveur : aucun placement sur un créneau chevauchant.
 */
export interface IndisponibiliteEnseignant {
  teacherId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface SalleDisponible {
  roomId: string;
  type: RoomType;
  capacity: number;
  /** Nom d'affichage de la salle (pour les explicatifs) — optionnel. */
  roomName?: string;
}

/** Une case de la grille horaire (issue de TimetableGridConfig, jamais codée en dur). */
export interface CaseGrille {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

/**
 * Options des contraintes douces V2.5 — toutes optionnelles, défaut false/désactivé.
 * Absence d'option = comportement d'avant V2.5 (aucune pénalité, première solution trouvée).
 * Les poids sont exprimés en « cases » (une case = dureeCase minutes, grille homogène).
 */
export interface ContraintesDoucesOptions {
  /** Pénaliser les interstices vides dans la journée d'un enseignant. */
  trouEnseignant?: boolean;
  /** Pénaliser 3 cases consécutives occupées par le même enseignant. */
  troisCoursConsecutifs?: boolean;
  /** Équilibrer la charge hebdomadaire de la CLASSE (tous enseignants confondus). */
  equilibrageSemaine?: boolean;
  /** Plafond journalier par enseignant, en minutes. Absent = désactivé. */
  volumeMaxEnseignantParJour?: number;
  /** V2.5 — honorer Subject.blocDureeCases (blocs de 2 h). Défaut true. */
  blocsDeuxHeures?: boolean;
  /** V2.5 — générer une explication textuelle par séance retenue (Explain My Timetable). */
  explicatifs?: boolean;
  /** Surcharge des poids par défaut (calibration). */
  poids?: {
    trou?: number;
    troisConsecutifs?: number;
    desequilibre?: number;
    volumeJour?: number;
  };
}

/** Poids par défaut — calibrés sur l'échelle de POIDS_SALLE_HABITUELLE (10). */
export const POIDS_TROU_CASE = 5;
export const POIDS_TROIS_CONSECUTIFS = 15;
export const POIDS_DESEQUILIBRE = 2;
export const POIDS_VOLUME_JOUR = 3;

export interface ProposerEmploiDuTempsInput {
  classId: string;
  /** Salle habituelle de la classe (ClassRoomAssignment) — contrainte SOUPLE : bonus si retenue. */
  salleHabituelleId?: string;
  exigences: ExigenceSeance[];
  grille: CaseGrille[];
  sallesDisponibles: SalleDisponible[];
  occupationExistante: CreneauOccupe[];
  /** Plages où un enseignant est indisponible (V2.4) — contrainte DURE. Vide par défaut. */
  indisponibilitesEnseignants?: IndisponibiliteEnseignant[];
  /** Contraintes douces V2.5 — absentes = aucune pénalité. */
  contraintes?: ContraintesDoucesOptions;
  /** V2.5 — retourner plusieurs solutions classées par score (no-good re-solve). */
  solutionsMultiples?: { nombre?: number; margeScore?: number };
}

export interface SeanceProposee {
  subjectId: string;
  teacherId: string;
  roomId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface SeanceGroupeProposee extends SeanceProposee {
  groupId: string;
  groupName: string;
  participantsCount: number;
  isLV2Slot: true;
}

export interface TempsLibrePropose {
  kind: 'FREE';
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface PropositionEmploiDuTemps {
  statut: 'OPTIMAL' | 'FEASIBLE' | 'INFAISABLE';
  seances: SeanceProposee[];
  seancesGroupes?: SeanceGroupeProposee[];
  tempsLibres?: TempsLibrePropose[];
  /** Score de l'objectif souple (préférence salle habituelle) — 0 si INFAISABLE. */
  scoreObjectif: number;
  /** Temps de résolution mesuré, remonté pour observabilité (le solveur WASM a un coût à froid). */
  dureeResolutionMs: number;
  /**
   * Renseigné uniquement si INFAISABLE — explique CE QUI bloque (ex. "aucune salle de type
   * LABORATORY disponible pour la matière X"), pour que l'admin sache quoi corriger plutôt que
   * de recevoir un échec opaque.
   */
  raisonInfaisabilite?: string;
  /** V2.5 — pistes de correction déterministes (max 5) sur INFAISABLE (réparation auto). */
  suggestions?: string[];
  /** V2.5 — solutions alternatives scorées (la principale reste `seances`). Jamais appliquées auto. */
  solutionsAlternatives?: { score: number; seances: SeanceProposee[] }[];
  /** V2.5 — texte explicatif d'une ligne par séance retenue (Explain My Timetable). */
  explicatifs?: string[];
}

export interface SchedulingSolverPort {
  proposer(input: ProposerEmploiDuTempsInput): Promise<PropositionEmploiDuTemps>;
}
