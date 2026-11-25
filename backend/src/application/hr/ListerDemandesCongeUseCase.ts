import type { LeaveRepository, LeaveRequestData, LeaveBalanceData } from '@domain/ports/repositories/LeaveRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';

export interface ListerDemandesCongeCommande {
  schoolId: string;
  demandeurId: string;
  demandeurRole?: string;
  filtreUserId?: string;
}

export interface ListerDemandesCongeResultat {
  leaveRequests: LeaveRequestData[];
}

export interface ObtenirSoldeCongeCommande {
  schoolId: string;
  demandeurId: string;
  userId: string;
}

export class ListerDemandesCongeUseCase {
  constructor(
    private readonly leaveRepository: LeaveRepository,
    private readonly userRepository: UserRepository,
  ) {}

  private async getCurrentLeaveBalance(userId: string, schoolId: string): Promise<LeaveBalanceData> {
    const year = new Date().getFullYear();
    const balance = await this.leaveRepository.findBalanceForYear(userId, year);
    if (balance) return balance;
    const fallback = await this.leaveRepository.findLatestBalance(userId, schoolId);
    if (fallback) return fallback;
    return this.leaveRepository.createBalance({ userId, schoolId, annee: year });
  }

  async lister(commande: ListerDemandesCongeCommande): Promise<ListerDemandesCongeResultat> {
    const filtreUserId =
      commande.demandeurRole !== 'ADMIN' ? commande.demandeurId : commande.filtreUserId;
    const leaveRequests = await this.leaveRepository.findRequestsBySchool(commande.schoolId, filtreUserId);
    return { leaveRequests };
  }

  async obtenirSolde(commande: ObtenirSoldeCongeCommande): Promise<{ current: LeaveBalanceData; balances: LeaveBalanceData[] }> {
    const employee = await this.userRepository.findEmployeeById(commande.userId, commande.schoolId);
    if (!employee) {
      throw new Error('Employé introuvable');
    }
    const balances = await this.leaveRepository.findBalancesByUser(commande.userId, commande.schoolId);
    const current = balances[0] ?? await this.getCurrentLeaveBalance(commande.userId, commande.schoolId);
    return { current, balances };
  }
}
