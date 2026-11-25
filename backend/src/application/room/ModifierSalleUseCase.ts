import { Room } from '@domain/entities/Room';
import type { RoomRepository } from '@domain/ports/repositories/RoomRepository';
import type { RoomType, RoomStatus } from '@domain/types/enums';

export interface ModifierSalleCommande {
  roomId: string;
  schoolId: string;
  name?: string;
  type?: RoomType;
  capacity?: number;
  equipment?: string[];
  /** Transition d'état explicite (ACTIVE/MAINTENANCE/INACTIVE) — passe par les méthodes métier
   *  de l'entité (activer/mettreEnMaintenance/desactiver), jamais un écrasement direct. Rejette
   *  explicitement une transition vers l'état déjà courant (jamais de no-op silencieux — même
   *  principe que l'idempotence appliquée ailleurs sur ce projet, ex. AnnulerStructureProposeeUseCase). */
  status?: RoomStatus;
}

export class ModifierSalleUseCase {
  constructor(private readonly roomRepository: RoomRepository) {}

  async execute(commande: ModifierSalleCommande): Promise<void> {
    const room = await this.roomRepository.findById(commande.roomId);
    if (!room) throw new Error(`Salle introuvable : ${commande.roomId}`);

    if (room.schoolId !== commande.schoolId) {
      throw new Error('Accès refusé : salle hors de votre établissement');
    }

    if (commande.name && commande.name !== room.name) {
      const dejaExiste = await this.roomRepository.existsByName(
        commande.schoolId,
        commande.name,
        commande.roomId
      );
      if (dejaExiste) {
        throw new Error(`Une autre salle avec le nom "${commande.name}" existe déjà`);
      }
    }

    const donneesMisesAJour = {
      ...room.toObject(),
      ...(commande.name && { name: commande.name }),
      ...(commande.type !== undefined && { type: commande.type }),
      ...(commande.capacity !== undefined && { capacity: commande.capacity }),
      ...(commande.equipment !== undefined && { equipment: commande.equipment }),
    };

    const salleMiseAJour = Room.reconstituer(donneesMisesAJour);

    if (commande.status) {
      if (commande.status === 'ACTIVE') salleMiseAJour.activer();
      else if (commande.status === 'MAINTENANCE') salleMiseAJour.mettreEnMaintenance();
      else salleMiseAJour.desactiver();
    }

    await this.roomRepository.update(salleMiseAJour);
  }
}
