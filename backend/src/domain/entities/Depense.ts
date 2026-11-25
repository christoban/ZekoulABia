/**
 * DOMAIN LAYER — Entité Dépense (Expense)
 *
 * Loi 2 — Art. 34 & 39 MINESEC :
 * Le Proviseur ordonne les dépenses.
 * L'Intendant les exécute.
 * Ces deux rôles ne peuvent jamais être la même personne.
 */
import { SeparationOrdonnateurError } from '@domain/errors/SeparationOrdonnateurError';

export interface DepenseProps {
  id: string;
  schoolId: string;
  label: string;
  amount: number;
  currency: string;
  category?: string;
  date: Date;
  createdById: string;
  ordonnateurId?: string;
}

export interface CreerDepenseProps {
  schoolId: string;
  label: string;
  amount: number;
  currency?: string;
  category?: string;
  date?: Date;
  createdById: string;
  ordonnateurId?: string;
}

export class Depense {
  private constructor(private readonly props: DepenseProps) {}

  static create(props: CreerDepenseProps): Depense {
    if (!props.label?.trim()) throw new Error('Le libellé de la dépense est obligatoire');
    if (props.amount <= 0) throw new Error('Le montant doit être supérieur à 0');

    // Loi 2 : vérification séparation ordonnateur/comptable
    if (props.ordonnateurId) {
      Depense.verifierSeparation(props.ordonnateurId, props.createdById);
    }

    return new Depense({
      ...props,
      id: crypto.randomUUID(),
      currency: props.currency ?? 'XAF',
      date: props.date ?? new Date(),
    });
  }

  static reconstituer(props: DepenseProps): Depense {
    return new Depense(props);
  }

  // --- Getters ---
  get id(): string { return this.props.id; }
  get schoolId(): string { return this.props.schoolId; }
  get label(): string { return this.props.label; }
  get amount(): number { return this.props.amount; }
  get createdById(): string { return this.props.createdById; }

  /**
   * Loi 2 — Art. 34 & 39 MINESEC
   * Vérifie que l'ordonnateur et l'exécutant sont deux personnes différentes.
   */
  static verifierSeparation(ordonnateurId: string, executantId: string): void {
    if (ordonnateurId === executantId) {
      throw new SeparationOrdonnateurError(executantId);
    }
  }

  toObject(): DepenseProps {
    return { ...this.props };
  }
}
