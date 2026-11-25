/**
 * APPLICATION LAYER — Use Case : Suspendre une école
 * ACTIVE → SUSPENDED + expire invitations PENDING
 */
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { InvitationRepository } from '@domain/ports/repositories/InvitationRepository';

export class SuspendreEcoleUseCase {
  constructor(
    private readonly schoolRepository: SchoolRepository,
    private readonly invitationRepository: InvitationRepository,
  ) {}

  async execute(schoolId: string): Promise<void> {
    const school = await this.schoolRepository.findById(schoolId);
    if (!school) throw new Error(`École introuvable : ${schoolId}`);

    school.suspendre(); // Vérifie que status === ACTIVE
    await this.schoolRepository.update(school);

    // Expirer toutes les invitations PENDING
    await this.invitationRepository.expireToutes(schoolId);
  }
}
