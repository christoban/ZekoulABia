/**
 * DOMAIN LAYER — Entité Room (Salle)
 * Représente une salle physique d'un établissement (V2.3) : salle normale, laboratoire,
 * atelier, salle informatique, terrain. Tenant-scoped uniquement — une salle physique ne
 * change pas d'une année scolaire à l'autre, contrairement à Classe.
 */
import type { RoomType, RoomStatus } from '@domain/types/enums';

export interface RoomProps {
  id: string;
  schoolId: string;
  name: string;
  type: RoomType;
  status: RoomStatus;
  capacity: number;
  equipment: string[];
  createdAt: Date;
}

export interface CreerRoomProps {
  schoolId: string;
  name: string;
  type?: RoomType;
  capacity?: number;
  equipment?: string[];
}

export class Room {
  private constructor(private readonly props: RoomProps) {}

  // --- Factories ---

  static create(props: CreerRoomProps): Room {
    if (!props.name?.trim()) {
      throw new Error('Le nom de la salle est obligatoire');
    }
    if (props.capacity !== undefined && props.capacity < 1) {
      throw new Error('La capacité doit être supérieure à 0');
    }
    return new Room({
      id: crypto.randomUUID(),
      schoolId: props.schoolId,
      name: props.name,
      type: props.type ?? 'NORMAL',
      status: 'ACTIVE',
      capacity: props.capacity ?? 30,
      equipment: props.equipment ?? [],
      createdAt: new Date(),
    });
  }

  static reconstituer(props: RoomProps): Room {
    return new Room(props);
  }

  // --- Getters ---

  get id(): string { return this.props.id; }
  get schoolId(): string { return this.props.schoolId; }
  get name(): string { return this.props.name; }
  get type(): RoomType { return this.props.type; }
  get status(): RoomStatus { return this.props.status; }
  get capacity(): number { return this.props.capacity; }
  get equipment(): string[] { return this.props.equipment; }
  get createdAt(): Date { return this.props.createdAt; }

  // --- Méthodes métier ---

  peutAccueillir(effectif: number): boolean {
    return effectif <= this.props.capacity;
  }

  estDisponible(): boolean {
    return this.props.status === 'ACTIVE';
  }

  mettreEnMaintenance(): void {
    if (this.props.status === 'MAINTENANCE') {
      throw new Error('Cette salle est déjà en maintenance');
    }
    this.props.status = 'MAINTENANCE';
  }

  desactiver(): void {
    if (this.props.status === 'INACTIVE') {
      throw new Error('Cette salle est déjà désactivée');
    }
    this.props.status = 'INACTIVE';
  }

  activer(): void {
    if (this.props.status === 'ACTIVE') {
      throw new Error('Cette salle est déjà active');
    }
    this.props.status = 'ACTIVE';
  }

  // --- Sérialisation ---

  toObject(): RoomProps {
    return { ...this.props };
  }
}
