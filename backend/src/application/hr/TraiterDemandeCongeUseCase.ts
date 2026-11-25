import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import type { TraiterCongeServicePort } from '@domain/ports/services/TraiterCongeServicePort';
import type { LeaveRepository } from '@domain/ports/repositories/LeaveRepository';

export interface TraiterDemandeCongeCommande {
  schoolId: string;
  demandeurId: string;
  demandeurRole?: string;
  leaveRequestId: string;
  statut: 'APPROVED' | 'REJECTED';
}

export class TraiterDemandeCongeUseCase {
  constructor(
    private readonly traiterCongeService: TraiterCongeServicePort,
    private readonly audit: AIActionAuditPort,
    private readonly leaveRepository: LeaveRepository,
  ) {}

  async execute(commande: TraiterDemandeCongeCommande): Promise<{ leaveRequest: { id: string; statut: string } }> {
    if (!commande.statut || !['APPROVED', 'REJECTED'].includes(commande.statut)) {
      throw new Error('statut doit être APPROVED ou REJECTED');
    }

    const existing = await this.leaveRepository.findRequestByIdAndSchool(commande.leaveRequestId, commande.schoolId);
    if (existing && existing.userId === commande.demandeurId) {
      throw new Error('Auto-approbation interdite : vous ne pouvez pas traiter votre propre demande');
    }

    let updated;
    try {
      updated = await this.traiterCongeService.traiterDemandeConge(
        commande.schoolId,
        commande.leaveRequestId,
        commande.statut,
        commande.demandeurId,
      );
    } catch (err) {
      this.audit.journaliser({
        actorUserId: commande.demandeurId,
        actorRole: commande.demandeurRole,
        schoolId: commande.schoolId,
        actionName: 'traiter_demande_conge',
        targetType: 'LeaveRequest',
        targetId: commande.leaveRequestId,
        origin: 'UI_DIRECT',
        outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined,
        parametersSummary: { statut: commande.statut },
      });
      throw err;
    }

    this.audit.journaliser({
      actorUserId: commande.demandeurId,
      actorRole: commande.demandeurRole,
      schoolId: commande.schoolId,
      actionName: 'traiter_demande_conge',
      targetType: 'LeaveRequest',
      targetId: commande.leaveRequestId,
      origin: 'UI_DIRECT',
      outcome: 'SUCCES',
      parametersSummary: { statut: commande.statut },
    });

    return { leaveRequest: updated };
  }
}
