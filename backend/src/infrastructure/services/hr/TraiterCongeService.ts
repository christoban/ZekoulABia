import type { LeaveRepository } from '@domain/ports/repositories/LeaveRepository';

export interface TraiterCongeResultat {
  id: string;
  statut: string;
}

function daysBetweenInclusive(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diff = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
  return diff + 1;
}

export async function traiterDemandeConge(
  repo: LeaveRepository,
  schoolId: string,
  requestId: string,
  statut: 'APPROVED' | 'REJECTED',
  validatedById: string | undefined,
): Promise<TraiterCongeResultat> {
  const leaveRequest = await repo.findRequestByIdAndSchool(requestId, schoolId);
  if (!leaveRequest) throw new Error('Demande de congé introuvable');
  if (leaveRequest.statut !== 'PENDING') throw new Error('La demande a déjà été traitée');

  const updated = await repo.updateRequestStatus(requestId, statut, validatedById ?? null);

  if (statut === 'APPROVED') {
    const year = new Date(leaveRequest.dateDebut).getFullYear();
    const balance = await repo.upsertBalanceForYear(leaveRequest.userId, schoolId, year);
    const jours = daysBetweenInclusive(new Date(leaveRequest.dateDebut), new Date(leaveRequest.dateFin));
    await repo.decrementBalance(balance.id, jours);
  }

  return { id: updated.id, statut: updated.statut };
}
