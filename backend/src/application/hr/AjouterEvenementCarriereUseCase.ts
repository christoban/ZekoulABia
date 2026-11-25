import type { CareerEventRepository, CareerEventData } from '@domain/ports/repositories/CareerEventRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';

export interface AjouterEvenementCarriereCommande {
  schoolId: string;
  demandeurId: string;
  userId: string;
  type: string;
  date: Date;
  observation?: string | null;
}

export class AjouterEvenementCarriereUseCase {
  constructor(
    private readonly careerEventRepository: CareerEventRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(commande: AjouterEvenementCarriereCommande): Promise<{ event: CareerEventData }> {
    if (!commande.type || !commande.date || Number.isNaN(commande.date.getTime())) {
      throw new Error('type et date sont requis');
    }

    const employee = await this.userRepository.findEmployeeById(commande.userId, commande.schoolId);
    if (!employee) {
      throw new Error('Employé introuvable');
    }

    const event = await this.careerEventRepository.create({
      userId: commande.userId,
      schoolId: commande.schoolId,
      type: commande.type,
      date: commande.date,
      observation: commande.observation?.trim() || undefined,
    });

    return { event };
  }
}
