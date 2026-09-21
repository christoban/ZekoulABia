/**
 * DOMAIN LAYER — Entité School (Établissement)
 * Représente un établissement scolaire — unité multi-tenant principale.
 */
import type {
  SchoolStatus, PlanType, SchoolSubsystem,
  EducationType, SchoolOwnership, SchoolLevel, JsonValue
} from '@domain/types/enums';

export interface SchoolProps {
  id: string;
  name: string;
  subdomain: string;
  status: SchoolStatus;
  plan: PlanType;
  subsystem: SchoolSubsystem;
  educationType: EducationType;
  ownership: SchoolOwnership;
  city?: string;
  region?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  templateCode?: string;
  onboardingConfig?: JsonValue | null;
  saturdaySchedule: boolean;
  adminGereInscriptions?: boolean;
  adminGereFinances?: boolean;
  contractEnd?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreerSchoolProps {
  name: string;
  subdomain: string;
  subsystem: SchoolSubsystem;
  educationType: EducationType;
  ownership: SchoolOwnership;
  plan?: PlanType;
  city?: string;
  region?: string;
  address?: string;
  phone?: string;
  email?: string;
  templateCode?: string;
  onboardingConfig?: JsonValue | null;
}

export class School {
  private constructor(private readonly props: SchoolProps) {}

  // --- Factories ---

  static create(props: CreerSchoolProps): School {
    if (!props.name?.trim() || props.name.trim().length < 3) {
      throw new Error('Le nom de l\'établissement doit contenir au moins 3 caractères');
    }
    if (!props.subdomain?.trim()) {
      throw new Error('Le sous-domaine est obligatoire');
    }
    if (!/^[a-z0-9-]+$/.test(props.subdomain)) {
      throw new Error('Le sous-domaine ne peut contenir que des lettres minuscules, chiffres et tirets');
    }

    return new School({
      ...props,
      id: crypto.randomUUID(),
      status: 'PENDING',
      plan: props.plan ?? 'DISCOVERY',
      saturdaySchedule: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstituer(props: SchoolProps): School {
    return new School(props);
  }

  // --- Getters ---

  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get subdomain(): string { return this.props.subdomain; }
  get status(): SchoolStatus { return this.props.status; }
  get plan(): PlanType { return this.props.plan; }
  get subsystem(): SchoolSubsystem { return this.props.subsystem; }
  get templateCode(): string | undefined { return this.props.templateCode; }
  get onboardingConfig(): JsonValue | null | undefined { return this.props.onboardingConfig; }
  get adminGereInscriptions(): boolean { return this.props.adminGereInscriptions ?? false; }
  get adminGereFinances(): boolean { return this.props.adminGereFinances ?? true; }

  // --- Méthodes métier ---

  estActive(): boolean { return this.props.status === 'ACTIVE'; }
  estSuspendue(): boolean { return this.props.status === 'SUSPENDED'; }
  estBilingue(): boolean { return this.props.subsystem === 'BILINGUAL'; }

  approuver(): void {
    if (this.props.status !== 'PENDING' && this.props.status !== 'APPROVED') {
      throw new Error(`Impossible d'approuver un établissement avec le statut "${this.props.status}"`);
    }
    this.props.status = 'APPROVED';
    this.props.updatedAt = new Date();
  }

  activer(): void {
    if (this.props.status !== 'APPROVED') {
      throw new Error(`L'établissement doit être approuvé avant d'être activé`);
    }
    this.props.status = 'ACTIVE';
    this.props.updatedAt = new Date();
  }

  suspendre(): void {
    if (this.props.status !== 'ACTIVE') {
      throw new Error(`Seul un établissement actif peut être suspendu`);
    }
    this.props.status = 'SUSPENDED';
    this.props.updatedAt = new Date();
  }

  rejeter(): void {
    if (this.props.status !== 'PENDING') {
      throw new Error(`Seul un établissement en attente peut être rejeté`);
    }
    this.props.status = 'REJECTED';
    this.props.updatedAt = new Date();
  }

  reactiver(): void {
    if (this.props.status !== 'SUSPENDED') {
      throw new Error(`Seul un établissement suspendu peut être réactivé`);
    }
    this.props.status = 'ACTIVE';
    this.props.updatedAt = new Date();
  }

  /** Seconde chance après un rejet : repasse en PENDING pour réexamen (ReactiverEcoleUseCase). */
  redonnerUneChanceApresRejet(): void {
    if (this.props.status !== 'REJECTED') {
      throw new Error(`Seul un établissement rejeté peut être repassé en attente de réexamen`);
    }
    this.props.status = 'PENDING';
    this.props.updatedAt = new Date();
  }

  changerPlan(nouveauPlan: PlanType): void {
    if (!this.estActive() && this.props.status !== 'APPROVED') {
      throw new Error('Le plan ne peut être changé que pour une école active ou approuvée');
    }
    this.props.plan = nouveauPlan;
    this.props.updatedAt = new Date();
  }

  // --- Sérialisation ---

  toObject(): SchoolProps {
    return { ...this.props };
  }
}
