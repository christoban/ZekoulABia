import type { CareerEventRepository, CareerEventData } from '@domain/ports/repositories/CareerEventRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';

export interface ListerEvenementsCarriereCommande {
  schoolId: string;
  demandeurId: string;
  userId: string;
}

export class ListerEvenementsCarriereUseCase {
  constructor(
    private readonly careerEventRepository: CareerEventRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(commande: ListerEvenementsCarriereCommande): Promise<{ events: CareerEventData[] }> {
    const employee = await this.userRepository.findEmployeeById(commande.userId, commande.schoolId);
    if (!employee) {
      throw new Error('Employé introuvable');
    }

    const events = await this.careerEventRepository.findByUserOrdered(commande.userId, commande.schoolId);
    return { events };
  }
}
