/**
 * DOMAIN LAYER — Entité Task (tâche administrative interne)
 * Une tâche : responsable, échéance, pièces jointes, commentaires, statut
 * (à faire → en cours → terminé → validé), historique.
 * Remplace les échanges WhatsApp informels pour les demandes internes.
 */

export type TaskStatus = 'A_FAIRE' | 'EN_COURS' | 'TERMINE' | 'VALIDE';

export interface TaskComment {
  authorId: string;
  text: string;
  createdAt: string;
}

export interface TaskProps {
  id: string;
  schoolId: string;
  title: string;
  description?: string | null;
  assignedById: string;
  assignedToId: string;
  dueDate?: Date | null;
  status: TaskStatus;
  attachments: string[];
  comments: TaskComment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreerTaskProps {
  schoolId: string;
  title: string;
  description?: string;
  assignedById: string;
  assignedToId: string;
  dueDate?: Date;
  attachments?: string[];
}

const TRANSITIONS_VALIDES: Record<TaskStatus, TaskStatus[]> = {
  A_FAIRE: ['EN_COURS', 'TERMINE'],
  EN_COURS: ['TERMINE', 'A_FAIRE'],
  TERMINE: ['VALIDE', 'EN_COURS'],
  VALIDE: [],
};

export class Task {
  private constructor(private readonly props: TaskProps) {}

  static create(props: CreerTaskProps): Task {
    return new Task({
      id: crypto.randomUUID(),
      schoolId: props.schoolId,
      title: props.title,
      description: props.description,
      assignedById: props.assignedById,
      assignedToId: props.assignedToId,
      dueDate: props.dueDate,
      status: 'A_FAIRE',
      attachments: props.attachments ?? [],
      comments: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstituer(props: TaskProps): Task {
    return new Task(props);
  }

  get id(): string { return this.props.id; }
  get schoolId(): string { return this.props.schoolId; }
  get title(): string { return this.props.title; }
  get description(): string | null | undefined { return this.props.description; }
  get assignedById(): string { return this.props.assignedById; }
  get assignedToId(): string { return this.props.assignedToId; }
  get dueDate(): Date | null | undefined { return this.props.dueDate; }
  get status(): TaskStatus { return this.props.status; }
  get attachments(): string[] { return [...this.props.attachments]; }
  get comments(): TaskComment[] { return [...this.props.comments]; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  changerStatut(nouveauStatut: TaskStatus): void {
    if (nouveauStatut === this.props.status) return;
    const transitions = TRANSITIONS_VALIDES[this.props.status];
    if (!transitions.includes(nouveauStatut)) {
      throw new Error(
        `Transition de statut invalide : ${this.props.status} → ${nouveauStatut}. ` +
        `Transitions autorisées : ${transitions.join(', ')}`
      );
    }
    this.props.status = nouveauStatut;
    this.props.updatedAt = new Date();
  }

  ajouterCommentaire(commentaire: TaskComment): void {
    this.props.comments = [...this.props.comments, commentaire];
    this.props.updatedAt = new Date();
  }

  toObject(): TaskProps {
    return { ...this.props };
  }
}