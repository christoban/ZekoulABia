import type { LeaveRepository } from '@domain/ports/repositories/LeaveRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';

export interface CreerDemandeCongeCommande {
  schoolId: string;
  demandeurId: string;
  demandeurRole?: string;
  userId: string;
  type: string;
  dateDebut: Date;
  dateFin: Date;
  motif?: string | null;
}

export class CreerDemandeCongeUseCase {
  constructor(
    private readonly leaveRepository: LeaveRepository,
    private readonly userRepository: UserRepository,
  ) {}

  private async ensureLeaveBalance(userId: string, schoolId: string) {
    const year = new Date().getFullYear();
    const existing = await this.leaveRepository.findBalanceForYear(userId, year);
    if (existing) return existing;
    return this.leaveRepository.createBalance({ userId, schoolId, annee: year });
  }

  async execute(commande: CreerDemandeCongeCommande): Promise<{ leaveRequest: import('@domain/ports/repositories/LeaveRepository').LeaveRequestData }> {
    if (commande.userId !== commande.demandeurId && commande.demandeurRole !== 'ADMIN') {
      throw new Error('Permission refusée : vous ne pouvez créer une demande que pour vous-même');
    }

    if (!commande.userId || !commande.type || !commande.dateDebut || !commande.dateFin) {
      throw new Error('userId, type, dateDebut et dateFin sont requis');
    }
    if (Number.isNaN(commande.dateDebut.getTime()) || Number.isNaN(commande.dateFin.getTime())) {
      throw new Error('userId, type, dateDebut et dateFin sont requis');
    }

    const employee = await this.userRepository.findEmployeeById(commande.userId, commande.schoolId);
    if (!employee) {
      throw new Error('Employé introuvable');
    }

    await this.ensureLeaveBalance(commande.userId, commande.schoolId);

    const leaveRequest = await this.leaveRepository.createRequest({
      userId: commande.userId,
      schoolId: commande.schoolId,
      type: commande.type,
      dateDebut: commande.dateDebut,
      dateFin: commande.dateFin,
      motif: commande.motif?.trim() || undefined,
    });

    return { leaveRequest };
  }
}
