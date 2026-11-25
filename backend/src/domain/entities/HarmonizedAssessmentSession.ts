import type {
  AssessmentSessionStatus,
  AnonymatStatus,
  CorrectionMode,
} from '@domain/types/enums';
import { InvalidAnonymatStateError } from '@domain/errors/AnonymatErrors';

export interface HarmonizedAssessmentSessionProps {
  id: string;
  schoolId: string;
  assessmentScopeId: string;
  subjectId: string;
  classId: string;
  academicSequenceId?: string | null;
  scheduledDate: Date;
  durationMinutes?: number | null;
  status: AssessmentSessionStatus;
  createdAt: Date;
  // Anonymat
  isAnonymized: boolean;
  anonymatStatus: AnonymatStatus;
  correctionMode?: CorrectionMode | null;
  codesGeneratedAt?: Date | null;
  codesGeneratedById?: string | null;
  reconciledAt?: Date | null;
  reconciledById?: string | null;
}

export class HarmonizedAssessmentSession {
  private constructor(private readonly props: HarmonizedAssessmentSessionProps) {}

  static create(
    props: Omit<
      HarmonizedAssessmentSessionProps,
      'id' | 'createdAt' | 'isAnonymized' | 'anonymatStatus'
    > & {
      isAnonymized?: boolean;
      anonymatStatus?: AnonymatStatus;
      correctionMode?: CorrectionMode | null;
    },
  ): HarmonizedAssessmentSession {
    const isAnonymized = props.isAnonymized ?? false;
    return new HarmonizedAssessmentSession({
      ...props,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      isAnonymized,
      anonymatStatus: props.anonymatStatus ?? 'NONE',
      correctionMode: isAnonymized ? (props.correctionMode ?? 'OWN_CLASS') : null,
      codesGeneratedAt: null,
      codesGeneratedById: null,
      reconciledAt: null,
      reconciledById: null,
    });
  }

  static reconstituer(props: HarmonizedAssessmentSessionProps): HarmonizedAssessmentSession {
    return new HarmonizedAssessmentSession(props);
  }

  get id(): string {
    return this.props.id;
  }
  get schoolId(): string {
    return this.props.schoolId;
  }
  get assessmentScopeId(): string {
    return this.props.assessmentScopeId;
  }
  get subjectId(): string {
    return this.props.subjectId;
  }
  get classId(): string {
    return this.props.classId;
  }
  get academicSequenceId(): string | null | undefined {
    return this.props.academicSequenceId;
  }
  get scheduledDate(): Date {
    return this.props.scheduledDate;
  }
  get durationMinutes(): number | null | undefined {
    return this.props.durationMinutes;
  }
  get status(): AssessmentSessionStatus {
    return this.props.status;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get isAnonymized(): boolean {
    return this.props.isAnonymized;
  }
  get anonymatStatus(): AnonymatStatus {
    return this.props.anonymatStatus;
  }
  get correctionMode(): CorrectionMode | null | undefined {
    return this.props.correctionMode;
  }
  get codesGeneratedAt(): Date | null | undefined {
    return this.props.codesGeneratedAt;
  }
  get codesGeneratedById(): string | null | undefined {
    return this.props.codesGeneratedById;
  }
  get reconciledAt(): Date | null | undefined {
    return this.props.reconciledAt;
  }
  get reconciledById(): string | null | undefined {
    return this.props.reconciledById;
  }

  activerAnonymat(mode: CorrectionMode): void {
    if (this.props.status !== 'PLANNED') {
      throw new InvalidAnonymatStateError(
        'Anonymat activable uniquement sur une session PLANNED',
      );
    }
    this.props.isAnonymized = true;
    this.props.correctionMode = mode;
    this.props.anonymatStatus = 'NONE';
  }

  marquerCodesGeneres(userId: string, at: Date = new Date()): void {
    if (!this.props.isAnonymized) {
      throw new InvalidAnonymatStateError('Session non anonymisée');
    }
    if (
      this.props.anonymatStatus !== 'NONE' &&
      this.props.anonymatStatus !== 'CODES_GENERES'
    ) {
      throw new InvalidAnonymatStateError(
        `Impossible de générer les codes depuis le statut ${this.props.anonymatStatus}`,
      );
    }
    this.props.anonymatStatus = 'CODES_GENERES';
    this.props.codesGeneratedAt = at;
    this.props.codesGeneratedById = userId;
  }

  marquerEquipeDesignee(): void {
    if (!this.props.isAnonymized) {
      throw new InvalidAnonymatStateError('Session non anonymisée');
    }
    if (
      this.props.anonymatStatus !== 'CODES_GENERES' &&
      this.props.anonymatStatus !== 'EQUIPE_DESIGNEE'
    ) {
      throw new InvalidAnonymatStateError(
        "Codes requis avant désignation de l'équipe",
      );
    }
    this.props.anonymatStatus = 'EQUIPE_DESIGNEE';
  }

  marquerAnonymisationEnCours(): void {
    if (!this.props.isAnonymized) {
      throw new InvalidAnonymatStateError('Session non anonymisée');
    }
    this.props.anonymatStatus = 'ANONYMISATION_EN_COURS';
  }

  marquerAnonymisationTerminee(): void {
    if (!this.props.isAnonymized) {
      throw new InvalidAnonymatStateError('Session non anonymisée');
    }
    this.props.anonymatStatus = 'ANONYMISATION_TERMINEE';
  }

  marquerEnCorrection(): void {
    if (!this.props.isAnonymized) {
      throw new InvalidAnonymatStateError('Session non anonymisée');
    }
    this.props.anonymatStatus = 'EN_CORRECTION';
  }

  marquerCorrectionTerminee(): void {
    if (!this.props.isAnonymized) {
      throw new InvalidAnonymatStateError('Session non anonymisée');
    }
    this.props.anonymatStatus = 'CORRECTION_TERMINEE';
  }

  marquerReconcilie(userId: string): void {
    if (!this.props.isAnonymized) {
      throw new InvalidAnonymatStateError('Session non anonymisée');
    }
    this.props.anonymatStatus = 'RECONCILIE';
    this.props.reconciledAt = new Date();
    this.props.reconciledById = userId;
  }

  toObject(): HarmonizedAssessmentSessionProps {
    return { ...this.props };
  }
}
