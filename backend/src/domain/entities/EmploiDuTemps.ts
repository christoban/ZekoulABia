import type { TimetableStatus } from '@domain/types/enums';

export interface EmploiDuTempsProps {
  id: string;
  schoolId: string;
  classId: string;
  academicYearId: string;
  status: TimetableStatus;
  generatedByAI: boolean;
  createdAt: Date;
}

export interface CreerEmploiDuTempsProps {
  schoolId: string;
  classId: string;
  academicYearId: string;
  generatedByAI?: boolean;
}

export class EmploiDuTemps {
  private constructor(private readonly props: EmploiDuTempsProps) {}

  static create(props: CreerEmploiDuTempsProps): EmploiDuTemps {
    return new EmploiDuTemps({
      ...props,
      id: crypto.randomUUID(),
      status: 'DRAFT',
      generatedByAI: props.generatedByAI ?? false,
      createdAt: new Date(),
    });
  }

  static reconstituer(props: EmploiDuTempsProps): EmploiDuTemps {
    return new EmploiDuTemps(props);
  }

  get id(): string { return this.props.id; }
  get schoolId(): string { return this.props.schoolId; }
  get classId(): string { return this.props.classId; }
  get academicYearId(): string { return this.props.academicYearId; }
  get status(): TimetableStatus { return this.props.status; }
  get generatedByAI(): boolean { return this.props.generatedByAI; }

  estPublie(): boolean { return this.props.status === 'PUBLISHED'; }
  estBrouillon(): boolean { return this.props.status === 'DRAFT'; }
  estSoumis(): boolean { return this.props.status === 'SUBMITTED'; }

  soumettre(nombreCreneaux: number): void {
    if (this.props.status === 'SUBMITTED') {
      throw new Error('Cet emploi du temps est déjà soumis');
    }
    if (this.props.status === 'PUBLISHED') {
      throw new Error('Un emploi du temps publié ne peut pas être soumis');
    }
    if (nombreCreneaux === 0) {
      throw new Error('Impossible de soumettre un emploi du temps sans créneaux');
    }
    this.props.status = 'SUBMITTED';
  }

  publier(): void {
    if (this.props.status === 'PUBLISHED') {
      throw new Error('Cet emploi du temps est déjà publié');
    }
    if (this.props.status !== 'SUBMITTED') {
      throw new Error("Impossible de publier : l'emploi du temps doit être soumis");
    }
    this.props.status = 'PUBLISHED';
  }

  rouvrir(): void {
    if (this.props.status !== 'PUBLISHED') {
      throw new Error("Seul un emploi du temps publié peut être rouvert");
    }
    this.props.status = 'DRAFT';
  }

  toObject(): EmploiDuTempsProps {
    return { ...this.props };
  }
}
