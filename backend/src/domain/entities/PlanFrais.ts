/**
 * DOMAIN LAYER — Entité Plan de Frais (FeePlan)
 *
 * Loi 3 — Art. 48 MINESEC :
 * Aucune facturation supérieure aux seuils légaux.
 * verifierSeuilLegal() lance SeuilLegalDepasseError si dépassement.
 */
import type { FeeType, FeePlanStatus } from '@domain/types/enums';
import { SeuilLegalDepasseError } from '@domain/errors/SeuilLegalDepasseError';
import { TransitionStatutPlanFraisError } from '@domain/errors/TransitionStatutPlanFraisError';

export interface PlanFraisProps {
  id: string;
  schoolId: string;
  sectionId?: string;
  name: string;
  amount: number;
  currency: string;
  feeType: FeeType;
  level?: string;
  isRefundable: boolean;
  dueDate?: Date;
  description?: string;
  createdAt: Date;
  /** Non renseigné pour un plan "évergreen" — voir note du modèle FeePlan. */
  academicYearId?: string;
  /** Workflow de publication V1.11. */
  status: FeePlanStatus;
}

export interface CreerPlanFraisProps {
  schoolId: string;
  sectionId?: string;
  name: string;
  amount: number;
  currency?: string;
  feeType: FeeType;
  level?: string;
  isRefundable?: boolean;
  dueDate?: Date;
  description?: string;
  academicYearId?: string;
  status?: FeePlanStatus;
}

export class PlanFrais {
  private constructor(private readonly props: PlanFraisProps) {}

  static create(props: CreerPlanFraisProps): PlanFrais {
    if (!props.name?.trim()) throw new Error('Le nom du plan est obligatoire');
    if (props.amount <= 0) throw new Error('Le montant doit être supérieur à 0');

    return new PlanFrais({
      ...props,
      id: crypto.randomUUID(),
      currency: props.currency ?? 'XAF',
      isRefundable: props.isRefundable ?? false,
      status: props.status ?? 'PUBLISHED',
      createdAt: new Date(),
    });
  }

  static reconstituer(props: PlanFraisProps): PlanFrais {
    return new PlanFrais(props);
  }

  // --- Getters ---
  get id(): string { return this.props.id; }
  get schoolId(): string { return this.props.schoolId; }
  get name(): string { return this.props.name; }
  get amount(): number { return this.props.amount; }
  get currency(): string { return this.props.currency; }
  get feeType(): FeeType { return this.props.feeType; }
  get level(): string | undefined { return this.props.level; }
  get isRefundable(): boolean { return this.props.isRefundable; }
  get dueDate(): Date | undefined { return this.props.dueDate; }
  get academicYearId(): string | undefined { return this.props.academicYearId; }
  get status(): FeePlanStatus { return this.props.status; }

  // --- Méthodes métier ---

  estScolarite(): boolean { return this.props.feeType === 'TUITION'; }
  estCaution(): boolean { return this.props.feeType === 'CAUTION'; }
  estAPEE(): boolean { return this.props.feeType === 'APEE_PTA'; }

  estPublie(): boolean { return this.props.status === 'PUBLISHED'; }

  /**
   * Workflow de publication V1.11 : DRAFT → PENDING_VALIDATION → APPROVED → PUBLISHED.
   * Toute autre transition lance TransitionStatutPlanFraisError.
   */
  changerStatut(cible: FeePlanStatus): void {
    const transitions: Record<FeePlanStatus, FeePlanStatus[]> = {
      DRAFT: ['PENDING_VALIDATION'],
      PENDING_VALIDATION: ['APPROVED', 'PUBLISHED'],
      APPROVED: ['PUBLISHED'],
      PUBLISHED: [],
    };
    if (!transitions[this.props.status].includes(cible)) {
      throw new TransitionStatutPlanFraisError(this.props.name, this.props.status, cible);
    }
    this.props.status = cible;
  }

  /**
   * Loi 3 — Art. 48 MINESEC
   * Vérifie que le montant ne dépasse pas le seuil légal autorisé.
   * S'applique uniquement aux frais de scolarité (TUITION).
   * Lance SeuilLegalDepasseError si dépassement.
   */
  verifierSeuilLegal(seuilLegal: number): void {
    if (!this.estScolarite()) return;
    if (this.props.amount > seuilLegal) {
      throw new SeuilLegalDepasseError(
        this.props.amount,
        seuilLegal,
        this.props.name
      );
    }
  }

  modifier(props: {
    name?: string;
    amount?: number;
    description?: string;
    level?: string | null;
    dueDate?: Date | null;
    status?: FeePlanStatus;
  }): void {
    if (props.name !== undefined) {
      if (!props.name.trim()) throw new Error('Le nom du plan est obligatoire');
      this.props.name = props.name.trim();
    }
    if (props.amount !== undefined) {
      if (props.amount < 0) throw new Error('Le montant ne peut pas être négatif');
      this.props.amount = props.amount;
    }
    if (props.description !== undefined) {
      this.props.description = props.description;
    }
    if (props.level !== undefined) {
      this.props.level = props.level ?? undefined;
    }
    if (props.dueDate !== undefined) {
      this.props.dueDate = props.dueDate ?? undefined;
    }
    if (props.status !== undefined) {
      this.props.status = props.status;
    }
  }

  toObject(): PlanFraisProps {
    return { ...this.props };
  }
}
