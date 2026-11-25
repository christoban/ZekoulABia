import { Room } from '@domain/entities/Room';
import type { RoomRepository } from '@domain/ports/repositories/RoomRepository';
import type { RoomType } from '@domain/types/enums';

export interface CreerSalleCommande {
  schoolId: string;
  name: string;
  type?: RoomType;
  capacity?: number;
  equipment?: string[];
}

export interface CreerSalleResultat {
  roomId: string;
  name: string;
}

export class CreerSalleUseCase {
  constructor(private readonly roomRepository: RoomRepository) {}

  async execute(commande: CreerSalleCommande): Promise<CreerSalleResultat> {
    const dejaExiste = await this.roomRepository.existsByName(commande.schoolId, commande.name);
    if (dejaExiste) {
      throw new Error(`Une salle avec le nom "${commande.name}" existe déjà dans cet établissement`);
    }

    const room = Room.create({
      schoolId: commande.schoolId,
      name: commande.name,
      type: commande.type,
      capacity: commande.capacity,
      equipment: commande.equipment,
    });

    await this.roomRepository.save(room);

    return { roomId: room.id, name: room.name };
  }
}
