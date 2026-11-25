import type { SequenceType } from '@domain/types/enums';

export interface AssessmentScopeProps {
  id: string;
  schoolId: string;
  academicYearId: string;
  name: string;
  sequenceType: SequenceType;
  subjectIds: string[];
  classIds: string[];
  createdAt: Date;
}

export class AssessmentScope {
  private constructor(private readonly props: AssessmentScopeProps) {}

  static create(props: Omit<AssessmentScopeProps, 'id' | 'createdAt'>): AssessmentScope {
    return new AssessmentScope({
      ...props,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    });
  }

  static reconstituer(props: AssessmentScopeProps): AssessmentScope {
    return new AssessmentScope(props);
  }

  get id(): string { return this.props.id; }
  get schoolId(): string { return this.props.schoolId; }
  get academicYearId(): string { return this.props.academicYearId; }
  get name(): string { return this.props.name; }
  get sequenceType(): SequenceType { return this.props.sequenceType; }
  get subjectIds(): string[] { return [...this.props.subjectIds]; }
  get classIds(): string[] { return [...this.props.classIds]; }
  get createdAt(): Date { return this.props.createdAt; }

  toObject(): AssessmentScopeProps {
    return { ...this.props };
  }
}