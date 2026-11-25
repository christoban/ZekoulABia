import type { RoomRepository } from '@domain/ports/repositories/RoomRepository';

export class SupprimerSalleUseCase {
  constructor(private readonly roomRepository: RoomRepository) {}

  async execute(params: { roomId: string; schoolId: string; demandeurId?: string }): Promise<void> {
    const room = await this.roomRepository.findById(params.roomId);
    if (!room) throw new Error(`Salle introuvable : ${params.roomId}`);

    if (room.schoolId !== params.schoolId) {
      throw new Error('Accès refusé : salle hors de votre établissement');
    }

    await this.roomRepository.supprimerAvecCascade(params.roomId, params.demandeurId);
  }
}
