/**
 * DOMAIN LAYER — Port Repository Room (Salle)
 */
import type { Room } from '@domain/entities/Room';

export interface RoomRepository {
  // Lecture
  findById(id: string): Promise<Room | null>;
  findBySchool(schoolId: string): Promise<Room[]>;

  /**
   * Vérifie l'unicité du nom dans une école.
   * excludeId : exclut la salle courante lors d'une modification.
   */
  existsByName(schoolId: string, name: string, excludeId?: string): Promise<boolean>;

  // Écriture
  save(room: Room): Promise<void>;
  update(room: Room): Promise<void>;

  /** Suppression douce — pose deletedAt, cohérent avec Classe/Subject. */
  supprimerAvecCascade(roomId: string, deletedById?: string): Promise<void>;
  restaurer(roomId: string): Promise<void>;
}
