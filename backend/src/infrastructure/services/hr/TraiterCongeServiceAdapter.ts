import type { TraiterCongeServicePort } from '@domain/ports/services/TraiterCongeServicePort';
import type { LeaveRepository } from '@domain/ports/repositories/LeaveRepository';
import { traiterDemandeConge } from './TraiterCongeService';

export class TraiterCongeServiceAdapter implements TraiterCongeServicePort {
  constructor(private readonly leaveRepository: LeaveRepository) {}

  async traiterDemandeConge(
    schoolId: string,
    requestId: string,
    statut: 'APPROVED' | 'REJECTED',
    validatedById: string | undefined,
  ): Promise<{ id: string; statut: string }> {
    return traiterDemandeConge(this.leaveRepository, schoolId, requestId, statut, validatedById);
  }
}
