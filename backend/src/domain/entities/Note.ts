/**
 * DOMAIN LAYER — Entité Note (Grade)
 * Porte le workflow de validation simplifié :
 * DRAFT → LOCKED
 *
 * Loi 6 : une note LOCKED ne peut jamais être modifiée
 * lors d'une synchronisation hors ligne.
 */
import type { GradeValidationStatus } from '@domain/types/enums';
import { NoteValideeSyncError } from '@domain/errors/NoteValideeSyncError';

export interface NoteProps {
  id: string;
  schoolId: string;
  studentId: string;
  subjectId: string;
  classId: string;
  academicYearId: string;
  sequenceId: string;
  recordedById?: string;

  // Scores selon le type d'établissement
  sequenceScore?: number;         // Secondaire FR — note DS/Compo
  classTestScore?: number;        // Secondaire EN — Class Test
  terminalExamScore?: number;     // Secondaire EN — Terminal Exam
  theoreticalScore?: number;      // Technique — note théorie
  practicalScore?: number;        // Technique — note pratique
  professionalAttitude?: number;  // Technique — attitude en atelier /20
  oralScore?: number;             // Primaire APC — composante Oral
  selfDevelopmentScore?: number;  // Primaire APC — Savoir-être

  coefficient: number;
  maxValue: number;               // 20 ou 100
  sequenceAverage?: number;       // Calculé par le GradingEngine

  validationStatus: GradeValidationStatus;
  validatedById?: string;
  validatedAt?: Date;
  rejectionReason?: string;
  observation?: string;

  harmonizedAssessmentSessionId?: string | null;
  isAbsentGrade: boolean;

  isOfflineSync: boolean;
  syncedAt?: Date;
  createdAt: Date;
}

export interface CreerNoteProps {
  schoolId: string;
  studentId: string;
  subjectId: string;
  classId: string;
  academicYearId: string;
  sequenceId: string;
  recordedById: string;
  coefficient?: number;
  maxValue?: number;
  sequenceScore?: number;
  sequenceAverage?: number;
  classTestScore?: number;
  terminalExamScore?: number;
  theoreticalScore?: number;
  practicalScore?: number;
  professionalAttitude?: number;
  oralScore?: number;
  selfDevelopmentScore?: number;
  harmonizedAssessmentSessionId?: string | null;
  isAbsentGrade?: boolean;
}

export class Note {
  private constructor(private readonly props: NoteProps) {}

  // --- Factories ---

  static create(props: CreerNoteProps): Note {
    Note.validerScores(props);

    return new Note({
      ...props,
      id: crypto.randomUUID(),
      coefficient: props.coefficient ?? 1,
      maxValue: props.maxValue ?? 20,
      sequenceAverage: props.sequenceAverage ?? props.sequenceScore,
      validationStatus: 'DRAFT',
      isAbsentGrade: props.isAbsentGrade ?? false,
      isOfflineSync: false,
      createdAt: new Date(),
    });
  }

  static reconstituer(props: NoteProps): Note {
    return new Note(props);
  }

  // --- Getters ---

  get id(): string { return this.props.id; }
  get schoolId(): string { return this.props.schoolId; }
  get studentId(): string { return this.props.studentId; }
  get subjectId(): string { return this.props.subjectId; }
  get classId(): string { return this.props.classId; }
  get sequenceId(): string { return this.props.sequenceId; }
  get validationStatus(): GradeValidationStatus { return this.props.validationStatus; }
  get sequenceScore(): number | undefined { return this.props.sequenceScore; }
  get sequenceAverage(): number | undefined { return this.props.sequenceAverage; }
  get coefficient(): number { return this.props.coefficient; }
  get maxValue(): number { return this.props.maxValue; }
  get rejectionReason(): string | undefined { return this.props.rejectionReason; }
  get isOfflineSync(): boolean { return this.props.isOfflineSync; }
  get isAbsentGrade(): boolean { return this.props.isAbsentGrade; }
  get harmonizedAssessmentSessionId(): string | null | undefined { return this.props.harmonizedAssessmentSessionId; }

  // --- Workflow de validation ---

  // Verrouillage lors de la génération du bulletin (DRAFT → LOCKED)
  verrouiller(): void {
    if (this.props.validationStatus !== 'DRAFT') {
      throw new Error(
        `Impossible de verrouiller : statut actuel "${this.props.validationStatus}". ` +
        `Seules les notes en DRAFT peuvent être verrouillées.`
      );
    }
    this.props.validationStatus = 'LOCKED';
  }

  // --- Loi 6 : protection sync hors ligne ---

  /**
   * Vérifie si cette note peut être modifiée lors d'une synchronisation hors ligne.
   * Lance NoteValideeSyncError si la note est LOCKED.
   */
  verifierModificationHorsLigneAutorisee(matiereNom: string): void {
    if (this.props.validationStatus === 'LOCKED') {
      throw new NoteValideeSyncError(this.props.id, matiereNom);
    }
  }

  peutEtreModifiee(): boolean {
    return this.props.validationStatus === 'DRAFT';
  }

  estVerrouillee(): boolean {
    return this.props.validationStatus === 'LOCKED';
  }

  // --- Méthodes de calcul ---

  definirScore(score: number): void {
    if (score < 0 || score > this.props.maxValue) {
      throw new Error(
        `Le score ${score} est hors limites (0 - ${this.props.maxValue})`
      );
    }
    this.props.sequenceScore = score;
  }

  definirMoyenne(moyenne: number): void {
    if (moyenne < 0 || moyenne > this.props.maxValue) {
      throw new Error(
        `La moyenne ${moyenne} est hors limites (0 - ${this.props.maxValue})`
      );
    }
    this.props.sequenceAverage = moyenne;
  }

  // --- Helpers privés ---

  private static validerScores(props: CreerNoteProps): void {
    const maxVal = props.maxValue ?? 20;
    const scores: { valeur?: number; nom: string }[] = [
      { valeur: props.sequenceScore, nom: 'sequenceScore' },
      { valeur: props.classTestScore, nom: 'classTestScore' },
      { valeur: props.terminalExamScore, nom: 'terminalExamScore' },
      { valeur: props.theoreticalScore, nom: 'theoreticalScore' },
      { valeur: props.practicalScore, nom: 'practicalScore' },
      { valeur: props.professionalAttitude, nom: 'professionalAttitude' },
      { valeur: props.oralScore, nom: 'oralScore' },
      { valeur: props.selfDevelopmentScore, nom: 'selfDevelopmentScore' },
    ];
    for (const { valeur, nom } of scores) {
      if (valeur !== undefined && (valeur < 0 || valeur > maxVal)) {
        throw new Error(`Score invalide pour "${nom}" : ${valeur} (doit être entre 0 et ${maxVal})`);
      }
    }
  }

  // --- Sérialisation ---

  toObject(): NoteProps {
    return { ...this.props };
  }
}
