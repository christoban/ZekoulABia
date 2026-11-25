import type { ClassRoomAssignmentRepository } from '@domain/ports/repositories/ClassRoomAssignmentRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { RoomRepository } from '@domain/ports/repositories/RoomRepository';

export interface AssignerSalleClasseCommande {
  classId: string;
  roomId: string;
  academicYearId: string;
  schoolId: string;
  demandeurRole: string;
}

export class AssignerSalleClasseUseCase {
  constructor(
    private readonly classRoomAssignmentRepository: ClassRoomAssignmentRepository,
    private readonly classeRepository: ClasseRepository,
    private readonly roomRepository: RoomRepository,
  ) {}

  async execute(commande: AssignerSalleClasseCommande): Promise<void> {
    const classe = await this.classeRepository.findById(commande.classId);
    if (!classe) throw new Error(`Classe introuvable : ${commande.classId}`);
    if (classe.schoolId !== commande.schoolId) {
      throw new Error('Accès refusé : classe hors de votre établissement');
    }

    const room = await this.roomRepository.findById(commande.roomId);
    if (!room) throw new Error(`Salle introuvable : ${commande.roomId}`);
    if (room.schoolId !== commande.schoolId) {
      throw new Error('Accès refusé : salle hors de votre établissement');
    }

    const existante = await this.classRoomAssignmentRepository.findByClasseAndAnnee(
      commande.classId, commande.academicYearId
    );

    await this.classRoomAssignmentRepository.upsert({
      id: existante?.id ?? crypto.randomUUID(),
      schoolId: commande.schoolId,
      classId: commande.classId,
      roomId: commande.roomId,
      academicYearId: commande.academicYearId,
    });
  }
}
