/**
 * DOMAIN LAYER — Entité Facture (Invoice)
 *
 * Workflow : PENDING → PARTIAL → PAID
 *                    ↘ OVERDUE (si dueDate dépassée)
 *
 * getInvoiceStatus() était inline dans le controller — migré ici.
 */
import type { InvoiceStatus } from '@domain/types/enums';

export interface FactureProps {
  id: string;
  schoolId: string;
  studentId: string;
  feePlanId?: string;
  amount: number;
  currency: string;
  dueDate?: Date;
  status: InvoiceStatus;
  description?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface CreerFactureProps {
  schoolId: string;
  studentId: string;
  feePlanId?: string;
  amount: number;
  currency?: string;
  dueDate?: Date;
  description?: string;
}

export class Facture {
  private constructor(private readonly props: FactureProps) {}

  static create(props: CreerFactureProps): Facture {
    if (props.amount <= 0) throw new Error('Le montant de la facture doit être supérieur à 0');

    return new Facture({
      ...props,
      id: crypto.randomUUID(),
      currency: props.currency ?? 'XAF',
      status: 'PENDING',
      createdAt: new Date(),
    });
  }

  static reconstituer(props: FactureProps): Facture {
    return new Facture(props);
  }

  // --- Getters ---
  get id(): string { return this.props.id; }
  get schoolId(): string { return this.props.schoolId; }
  get studentId(): string { return this.props.studentId; }
  get feePlanId(): string | undefined { return this.props.feePlanId; }
  get amount(): number { return this.props.amount; }
  get currency(): string { return this.props.currency; }
  get description(): string | undefined { return this.props.description; }
  get status(): InvoiceStatus { return this.props.status; }
  get dueDate(): Date | undefined { return this.props.dueDate; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date | undefined { return this.props.updatedAt; }

  // --- Logique métier pure ---
  // (extraite de getInvoiceStatus() dans controllers/finance.ts)

  /**
   * Calcule et met à jour le statut en fonction du total payé.
   * Correction du bug : seuls les paiements SUCCESS sont comptés.
   */
  mettreAJourStatut(totalPayeAvecSucces: number): void {
    if (totalPayeAvecSucces >= this.props.amount) {
      this.props.status = 'PAID';
    } else if (totalPayeAvecSucces > 0) {
      this.props.status = 'PARTIAL';
    } else if (this.props.dueDate && this.props.dueDate < new Date()) {
      this.props.status = 'OVERDUE';
    } else {
      this.props.status = 'PENDING';
    }
  }

  estEnRetard(): boolean {
    if (this.props.status === 'PAID') return false;
    return !!this.props.dueDate && this.props.dueDate < new Date();
  }

  estPayee(): boolean { return this.props.status === 'PAID'; }

  peutEtrePayee(): boolean {
    return this.props.status !== 'PAID' && this.props.status !== 'CANCELLED';
  }

  annuler(): void {
    if (this.props.status === 'PAID') {
      throw new Error("Impossible d'annuler une facture déjà payée");
    }
    this.props.status = 'CANCELLED';
  }

  toObject(): FactureProps {
    return { ...this.props };
  }
}
