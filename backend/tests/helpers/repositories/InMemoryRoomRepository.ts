import { Room } from '@domain/entities/Room';
import type { RoomRepository } from '@domain/ports/repositories/RoomRepository';

export class InMemoryRoomRepository implements RoomRepository {
  private store = new Map<string, Room>();

  ajouter(room: Room): void { this.store.set(room.id, room); }

  async findById(id: string): Promise<Room | null> { return this.store.get(id) ?? null; }

  async findBySchool(schoolId: string): Promise<Room[]> {
    return [...this.store.values()].filter(r => r.schoolId === schoolId);
  }

  async existsByName(schoolId: string, name: string, excludeId?: string): Promise<boolean> {
    return [...this.store.values()].some(
      r => r.schoolId === schoolId && r.name === name && r.id !== excludeId
    );
  }

  async save(room: Room): Promise<void> { this.store.set(room.id, room); }
  async update(room: Room): Promise<void> { this.store.set(room.id, room); }

  async supprimerAvecCascade(roomId: string): Promise<void> { this.store.delete(roomId); }
  async restaurer(_roomId: string): Promise<void> {}
}
