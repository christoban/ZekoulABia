import type { SlotKind } from '@domain/types/enums';
import { ConflitHoraireError } from '@domain/errors/ConflitHoraireError';
import { ConflitSalleError } from '@domain/errors/ConflitSalleError';

export interface CreneauHoraireProps {
  id: string;
  timetableId: string;
  subjectId?: string;
  teacherId?: string;
  teacherNom?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  roomId?: string;
  roomNom?: string;
  kind: SlotKind;
  subGroupId?: string;
  groupId?: string;
  isLV2Slot?: boolean;
  isElectiveSlot?: boolean;
}

export interface CreerCreneauProps {
  timetableId: string;
  subjectId?: string;
  teacherId?: string;
  teacherNom?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  roomId?: string;
  roomNom?: string;
  kind?: SlotKind;
  subGroupId?: string;
  groupId?: string;
  isLV2Slot?: boolean;
  isElectiveSlot?: boolean;
}

export class CreneauHoraire {
  private constructor(private readonly props: CreneauHoraireProps) {}

  static create(props: CreerCreneauProps): CreneauHoraire {
    if (!CreneauHoraire.heureValide(props.startTime)) {
      throw new Error(`Format d'heure invalide : "${props.startTime}" (attendu HH:MM)`);
    }
    if (!CreneauHoraire.heureValide(props.endTime)) {
      throw new Error(`Format d'heure invalide : "${props.endTime}" (attendu HH:MM)`);
    }
    if (
      CreneauHoraire.heureEnMinutes(props.startTime) >=
      CreneauHoraire.heureEnMinutes(props.endTime)
    ) {
      throw new Error(
        `L'heure de début (${props.startTime}) doit être avant l'heure de fin (${props.endTime})`
      );
    }
    if (props.dayOfWeek < 0 || props.dayOfWeek > 5) {
      throw new Error(`Jour invalide : ${props.dayOfWeek} (0=Lundi, 5=Samedi)`);
    }

    return new CreneauHoraire({
      ...props,
      id: crypto.randomUUID(),
      kind: props.kind ?? 'CLASS',
    });
  }

  static reconstituer(props: CreneauHoraireProps): CreneauHoraire {
    return new CreneauHoraire(props);
  }

  get id(): string { return this.props.id; }
  get timetableId(): string { return this.props.timetableId; }
  get teacherId(): string | undefined { return this.props.teacherId; }
  get subjectId(): string | undefined { return this.props.subjectId; }
  get dayOfWeek(): number { return this.props.dayOfWeek; }
  get startTime(): string { return this.props.startTime; }
  get endTime(): string { return this.props.endTime; }
  get kind(): SlotKind { return this.props.kind; }
  get subGroupId(): string | undefined { return this.props.subGroupId; }
  get groupId(): string | undefined { return this.props.groupId; }
  get roomId(): string | undefined { return this.props.roomId; }
  get roomNom(): string | undefined { return this.props.roomNom; }
  get isLV2Slot(): boolean { return this.props.isLV2Slot ?? false; }
  get isElectiveSlot(): boolean { return this.props.isElectiveSlot ?? false; }

  calculerDureeMinutes(): number {
    return (
      CreneauHoraire.heureEnMinutes(this.props.endTime) -
      CreneauHoraire.heureEnMinutes(this.props.startTime)
    );
  }

  verifierConflitEnseignant(
    creneauxExistants: { id: string; startTime: string; endTime: string; classeNom: string }[],
    excludeId?: string
  ): void {
    if (!this.props.teacherId) return;

    const debutMinutes = CreneauHoraire.heureEnMinutes(this.props.startTime);
    const finMinutes = CreneauHoraire.heureEnMinutes(this.props.endTime);

    for (const existant of creneauxExistants) {
      if (existant.id === excludeId) continue;

      const existantDebut = CreneauHoraire.heureEnMinutes(existant.startTime);
      const existantFin = CreneauHoraire.heureEnMinutes(existant.endTime);

      if (debutMinutes < existantFin && finMinutes > existantDebut) {
        throw new ConflitHoraireError(
          this.props.teacherNom ?? this.props.teacherId!,
          this.props.dayOfWeek,
          this.props.startTime,
          this.props.endTime,
          existant.classeNom
        );
      }
    }
  }

  verifierConflitSalle(
    creneauxExistants: { id: string; startTime: string; endTime: string; classeNom: string }[],
    excludeId?: string
  ): void {
    if (!this.props.roomId) return;

    const debutMinutes = CreneauHoraire.heureEnMinutes(this.props.startTime);
    const finMinutes = CreneauHoraire.heureEnMinutes(this.props.endTime);

    for (const existant of creneauxExistants) {
      if (existant.id === excludeId) continue;

      const existantDebut = CreneauHoraire.heureEnMinutes(existant.startTime);
      const existantFin = CreneauHoraire.heureEnMinutes(existant.endTime);

      if (debutMinutes < existantFin && finMinutes > existantDebut) {
        throw new ConflitSalleError(
          this.props.roomNom ?? this.props.roomId!,
          this.props.dayOfWeek,
          this.props.startTime,
          this.props.endTime,
          existant.classeNom
        );
      }
    }
  }

  static heureEnMinutes(heure: string): number {
    const [h, m] = heure.split(':').map(Number);
    return h! * 60 + m!;
  }

  static heureValide(heure: string): boolean {
    return /^\d{2}:\d{2}$/.test(heure);
  }

  toObject(): CreneauHoraireProps {
    return { ...this.props };
  }
}
