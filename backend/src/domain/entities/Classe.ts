/**
 * DOMAIN LAYER — Entité Classe
 * Représente une classe dans un établissement scolaire ZekoulABia.
 */
import type { SectionLanguage, ClassStatus } from '@domain/types/enums';

export interface ClasseProps {
  id: string;
  schoolId: string;
  academicYearId: string;
  name: string;
  level?: string;         // ex: "6e", "2nde", "Form1", "CP"
  serie?: string;         // ex: "C", "D", "A4", "S1"
  filiere?: string;       // ex: "F1", "MAEL", "G2" (technique)
  sectionId?: string;     // FR ou EN dans un établissement bilingue
  capacity: number;
  professorPrincipalId?: string;
  status: ClassStatus;
  createdAt: Date;
}

export interface CreerClasseProps {
  schoolId: string;
  academicYearId: string;
  name: string;
  level?: string;
  serie?: string;
  filiere?: string;
  sectionId?: string;
  capacity?: number;
  professorPrincipalId?: string;
  /** DRAFT uniquement pour une classe proposée à la clôture d'année — ACTIVE par défaut. */
  status?: ClassStatus;
}

export class Classe {
  private constructor(private readonly props: ClasseProps) {}

  // --- Factories ---

  static create(props: CreerClasseProps): Classe {
    if (!props.name?.trim()) {
      throw new Error('Le nom de la classe est obligatoire');
    }
    if (props.capacity !== undefined && props.capacity < 1) {
      throw new Error('La capacité doit être supérieure à 0');
    }
    return new Classe({
      ...props,
      id: crypto.randomUUID(),
      capacity: props.capacity ?? 40,
      status: props.status ?? 'ACTIVE',
      createdAt: new Date(),
    });
  }

  static reconstituer(props: ClasseProps): Classe {
    return new Classe(props);
  }

  // --- Getters ---

  get id(): string { return this.props.id; }
  get schoolId(): string { return this.props.schoolId; }
  get academicYearId(): string { return this.props.academicYearId; }
  get name(): string { return this.props.name; }
  get level(): string | undefined { return this.props.level; }
  get serie(): string | undefined { return this.props.serie; }
  get filiere(): string | undefined { return this.props.filiere; }
  get sectionId(): string | undefined { return this.props.sectionId; }
  get capacity(): number { return this.props.capacity; }
  get professorPrincipalId(): string | undefined { return this.props.professorPrincipalId; }
  get status(): ClassStatus { return this.props.status; }

  // Nom complet ex: "2nde C" ou "CAP1 MAEL" ou "Form 2A"
  get nomComplet(): string {
    const parts = [this.props.name];
    if (this.props.serie) parts.push(this.props.serie);
    if (this.props.filiere) parts.push(this.props.filiere);
    return parts.join(' ');
  }

  // --- Méthodes métier ---

  peutAccueillirEleve(nombreElevesActuels: number): boolean {
    return nombreElevesActuels < this.props.capacity;
  }

  estPleine(nombreElevesActuels: number): boolean {
    return nombreElevesActuels >= this.props.capacity;
  }

  assignerProfesseurPrincipal(userId: string): void {
    if (!userId?.trim()) {
      throw new Error('L\'identifiant du professeur principal est invalide');
    }
    this.props.professorPrincipalId = userId;
  }

  retirerProfesseurPrincipal(): void {
    this.props.professorPrincipalId = undefined;
  }

  aProfesseurPrincipal(): boolean {
    return !!this.props.professorPrincipalId;
  }

  /** Confirme une classe proposée (DRAFT) après revue admin — ValiderStructureAnneeSuivanteUseCase. */
  activer(): void {
    if (this.props.status !== 'DRAFT') {
      throw new Error('Seule une classe proposée (DRAFT) peut être activée');
    }
    this.props.status = 'ACTIVE';
  }

  // --- Sérialisation ---

  toObject(): ClasseProps {
    return { ...this.props };
  }
}
