/**
 * DOMAIN LAYER — Entité BulletinValidationSession
 * Porte le workflow de validation des bulletins par classe/période :
 * SUBMITTED → VALIDATED → PUBLISHED
 */
import type { BulletinValidationStatus } from '@domain/types/enums';

export interface BulletinValidationSessionProps {
  id: string;
  schoolId: string;
  classId: string;
  academicPeriodId: string;
  status: BulletinValidationStatus;
  submittedById: string;
  submittedAt: Date;
  validatedById?: string;
  validatedAt?: Date;
  publishedAt?: Date;
  createdAt: Date;
}

export interface CreerBulletinValidationSessionProps {
  schoolId: string;
  classId: string;
  academicPeriodId: string;
  submittedById: string;
}

export class BulletinValidationSession {
  private constructor(private readonly props: BulletinValidationSessionProps) {}

  // --- Factories ---

  static create(props: CreerBulletinValidationSessionProps): BulletinValidationSession {
    return new BulletinValidationSession({
      ...props,
      id: crypto.randomUUID(),
      status: 'SUBMITTED',
      submittedAt: new Date(),
      createdAt: new Date(),
    });
  }

  static reconstituer(props: BulletinValidationSessionProps): BulletinValidationSession {
    return new BulletinValidationSession(props);
  }

  // --- Getters ---

  get id(): string { return this.props.id; }
  get schoolId(): string { return this.props.schoolId; }
  get classId(): string { return this.props.classId; }
  get academicPeriodId(): string { return this.props.academicPeriodId; }
  get status(): BulletinValidationStatus { return this.props.status; }
  get submittedById(): string { return this.props.submittedById; }
  get submittedAt(): Date { return this.props.submittedAt; }
  get validatedById(): string | undefined { return this.props.validatedById; }
  get validatedAt(): Date | undefined { return this.props.validatedAt; }
  get publishedAt(): Date | undefined { return this.props.publishedAt; }
  get createdAt(): Date { return this.props.createdAt; }

  // --- Workflow de validation ---

  /**
   * Valide la session : SUBMITTED → VALIDATED
   */
  valider(validateurId: string): void {
    if (this.props.status !== 'SUBMITTED') {
      throw new Error(
        `Impossible de valider : statut actuel "${this.props.status}". ` +
        `Seules les sessions en SUBMITTED peuvent être validées.`
      );
    }
    this.props.status = 'VALIDATED';
    this.props.validatedById = validateurId;
    this.props.validatedAt = new Date();
  }

  /**
   * Publie la session : VALIDATED → PUBLISHED
   */
  publier(): void {
    if (this.props.status !== 'VALIDATED') {
      throw new Error(
        `Impossible de publier : statut actuel "${this.props.status}". ` +
        `Seules les sessions VALIDATED peuvent être publiées.`
      );
    }
    this.props.status = 'PUBLISHED';
    this.props.publishedAt = new Date();
  }

  // --- Helpers métier ---

  estSoumise(): boolean { return this.props.status === 'SUBMITTED'; }
  estValidee(): boolean { return this.props.status === 'VALIDATED'; }
  estPubliee(): boolean { return this.props.status === 'PUBLISHED'; }

  // --- Sérialisation ---

  toObject(): BulletinValidationSessionProps {
    return { ...this.props };
  }
}