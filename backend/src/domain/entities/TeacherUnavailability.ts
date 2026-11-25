/**
 * DOMAIN LAYER — Entité TeacherUnavailability (Indisponibilité enseignant, V2.4)
 *
 * Récurrence hebdomadaire : une plage jour-de-semaine + heures pendant laquelle l'enseignant
 * ne peut pas recevoir de séance. L'absence d'enregistrement = disponible (repli sûr) — on ne
 * stocke que les exceptions. Scoping tenant par colonne directe schoolId.
 *
 * Limitation assumée : ne s'applique qu'aux futures propositions du solveur, jamais
 * rétroactivement aux emplois du temps déjà appliqués.
 */
export interface TeacherUnavailabilityProps {
  id: string;
  schoolId: string;
  teacherId: string;
  dayOfWeek: number; // 0=Lundi … 5=Samedi (convention unifiée joursSemaine)
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  reason?: string | null;
  active: boolean;
  createdAt: Date;
}

export interface CreerTeacherUnavailabilityProps {
  schoolId: string;
  teacherId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  reason?: string | null;
}

const FORMAT_HEURE = /^\d{2}:\d{2}$/;

export class TeacherUnavailability {
  private constructor(private readonly props: TeacherUnavailabilityProps) {}

  static create(props: CreerTeacherUnavailabilityProps): TeacherUnavailability {
    TeacherUnavailability.validerPlage(props.dayOfWeek, props.startTime, props.endTime);

    return new TeacherUnavailability({
      id: crypto.randomUUID(),
      schoolId: props.schoolId,
      teacherId: props.teacherId,
      dayOfWeek: props.dayOfWeek,
      startTime: props.startTime,
      endTime: props.endTime,
      reason: props.reason ?? null,
      active: true,
      createdAt: new Date(),
    });
  }

  /**
   * Source unique de validation d'une plage (jour + heures) — utilisée à la création ET à la
   * modification (reconstruire l'entité ne revalide pas, on le fait ici explicitement).
   */
  static validerPlage(dayOfWeek: number, startTime: string, endTime: string): void {
    if (!FORMAT_HEURE.test(startTime)) {
      throw new Error(`Format d'heure invalide : "${startTime}" (attendu HH:MM)`);
    }
    if (!FORMAT_HEURE.test(endTime)) {
      throw new Error(`Format d'heure invalide : "${endTime}" (attendu HH:MM)`);
    }
    if (dayOfWeek < 0 || dayOfWeek > 5) {
      throw new Error(`Jour invalide : ${dayOfWeek} (0=Lundi, 5=Samedi)`);
    }
    if (this.heureEnMinutes(startTime) >= this.heureEnMinutes(endTime)) {
      throw new Error(
        `L'heure de début (${startTime}) doit être avant l'heure de fin (${endTime})`,
      );
    }
  }

  static reconstituer(props: TeacherUnavailabilityProps): TeacherUnavailability {
    return new TeacherUnavailability(props);
  }

  get id(): string { return this.props.id; }
  get schoolId(): string { return this.props.schoolId; }
  get teacherId(): string { return this.props.teacherId; }
  get dayOfWeek(): number { return this.props.dayOfWeek; }
  get startTime(): string { return this.props.startTime; }
  get endTime(): string { return this.props.endTime; }
  get reason(): string | null { return this.props.reason ?? null; }
  get active(): boolean { return this.props.active; }
  get createdAt(): Date { return this.props.createdAt; }

  desactiver(): void {
    if (!this.props.active) {
      throw new Error('Cette indisponibilité est déjà inactive');
    }
    this.props.active = false;
  }

  activer(): void {
    if (this.props.active) {
      throw new Error('Cette indisponibilité est déjà active');
    }
    this.props.active = true;
  }

  /**
   * Chevauchement horaire avec une autre plage (même jour) — la règle unique de chevauchement,
   * au même endroit que CreneauHoraire. Impossible de désactiver silencieusement un conflit.
   */
  chevauche(autre: { dayOfWeek: number; startTime: string; endTime: string }): boolean {
    if (autre.dayOfWeek !== this.props.dayOfWeek) return false;
    const debut = TeacherUnavailability.heureEnMinutes(this.props.startTime);
    const fin = TeacherUnavailability.heureEnMinutes(this.props.endTime);
    const autreDebut = TeacherUnavailability.heureEnMinutes(autre.startTime);
    const autreFin = TeacherUnavailability.heureEnMinutes(autre.endTime);
    return debut < autreFin && fin > autreDebut;
  }

  static heureEnMinutes(heure: string): number {
    const [h, m] = heure.split(':').map(Number);
    return h! * 60 + m!;
  }

  toObject(): TeacherUnavailabilityProps {
    return { ...this.props };
  }
}
