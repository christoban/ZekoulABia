import type { AttendanceStatus } from '@domain/types/enums';

export interface AssessmentParticipationProps {
  id: string;
  schoolId: string;
  harmonizedAssessmentSessionId: string;
  studentId: string;
  status: AttendanceStatus;
  recordedById?: string | null;
  createdAt: Date;
}

export class AssessmentParticipation {
  private constructor(private readonly props: AssessmentParticipationProps) {}

  static create(props: Omit<AssessmentParticipationProps, 'id' | 'createdAt'>): AssessmentParticipation {
    return new AssessmentParticipation({
      ...props,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    });
  }

  static reconstituer(props: AssessmentParticipationProps): AssessmentParticipation {
    return new AssessmentParticipation(props);
  }

  get id(): string { return this.props.id; }
  get schoolId(): string { return this.props.schoolId; }
  get harmonizedAssessmentSessionId(): string { return this.props.harmonizedAssessmentSessionId; }
  get studentId(): string { return this.props.studentId; }
  get status(): AttendanceStatus { return this.props.status; }
  get recordedById(): string | null | undefined { return this.props.recordedById; }
  get createdAt(): Date { return this.props.createdAt; }

  estAbsent(): boolean {
    return this.props.status === 'ABSENT';
  }

  estPresent(): boolean {
    return this.props.status === 'PRESENT' || this.props.status === 'LATE' || this.props.status === 'ABSENT_JUSTIFIED';
  }

  toObject(): AssessmentParticipationProps {
    return { ...this.props };
  }
}