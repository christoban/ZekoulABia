import type { MissionOrderRepository } from '@domain/ports/repositories/MissionOrderRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';

export interface CreerOrdreMissionCommande {
  schoolId: string;
  demandeurId: string;
  userId: string;
  motif: string;
  lieu: string;
  dateDebut: Date;
  dateFin: Date;
  signataire?: string | null;
}

export class CreerOrdreMissionUseCase {
  constructor(
    private readonly missionOrderRepository: MissionOrderRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(commande: CreerOrdreMissionCommande): Promise<{ missionOrder: import('@domain/ports/repositories/MissionOrderRepository').MissionOrderData }> {
    if (!commande.userId || !commande.motif || !commande.lieu || !commande.dateDebut || !commande.dateFin) {
      throw new Error('userId, motif, lieu, dateDebut et dateFin sont requis');
    }
    if (Number.isNaN(commande.dateDebut.getTime()) || Number.isNaN(commande.dateFin.getTime())) {
      throw new Error('userId, motif, lieu, dateDebut et dateFin sont requis');
    }

    const employee = await this.userRepository.findEmployeeById(commande.userId, commande.schoolId);
    if (!employee) {
      throw new Error('Employé introuvable');
    }

    const missionOrder = await this.missionOrderRepository.create({
      userId: commande.userId,
      schoolId: commande.schoolId,
      motif: commande.motif.trim(),
      lieu: commande.lieu.trim(),
      dateDebut: commande.dateDebut,
      dateFin: commande.dateFin,
      signataire: commande.signataire?.trim() || undefined,
    });

    return { missionOrder };
  }
}
