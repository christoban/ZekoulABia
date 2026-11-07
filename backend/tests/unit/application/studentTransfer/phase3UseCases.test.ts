import { describe, expect, it } from 'bun:test';
import type {
  CreateTransferRequestCommand,
  TransferRequestRecord,
  TransferRequestRepositoryPort,
} from '../../../../src/domain/ports/repositories/TransferRequestRepository.ts';
import type { TransferSnapshotBuildResult } from '../../../../src/domain/ports/services/TransferSnapshotBuilderPort.ts';
import type { TransferAuditEventInput, TransferAuditPort } from '../../../../src/domain/ports/services/TransferAuditPort.ts';
import type { GuardianConsentPort, VerifiedTransferConsent } from '../../../../src/domain/ports/services/GuardianConsentPort.ts';
import { CreerDemandeTransfertUseCase } from '../../../../src/application/studentTransfer/CreerDemandeTransfertUseCase.ts';
import { EnregistrerConsentementTransfertUseCase } from '../../../../src/application/studentTransfer/EnregistrerConsentementTransfertUseCase.ts';
import { DeciderDemandeTransfertUseCase } from '../../../../src/application/studentTransfer/DeciderDemandeTransfertUseCase.ts';

const requestBase: TransferRequestRecord = {
  id: 'request-a',
  identityId: 'identity-a',
  sourceSchoolId: 'school-a',
  targetSchoolId: 'school-b',
  sourceStudentProfileId: 'student-a',
  targetStudentProfileId: null,
  requestedByUserId: 'secretary-b',
  academicYearTarget: '2026-2027',
  status: 'PENDING_GUARDIAN',
  requestedAt: new Date('2026-11-06T12:00:00.000Z'),
  guardianDecisionAt: null,
  sourceDecisionAt: null,
  completedAt: null,
  parentExpiresAt: new Date('2026-12-06T12:00:00.000Z'),
  sourceAutoApprovalAt: null,
  rejectionReason: null,
  rejectedBy: null,
};

class FakeTransferRepository implements TransferRequestRepositoryPort {
  request: TransferRequestRecord | null = null;
  transitionCalls: Array<{ expected: string; next: string }> = [];

  async findById(id: string): Promise<TransferRequestRecord | null> {
    return this.request?.id === id ? this.request : null;
  }

  async findActiveByIdentityByNationalId(): Promise<TransferRequestRecord | null> {
    return this.request && !['REFUSED_BY_GUARDIAN', 'REFUSED_BY_SOURCE', 'EXPIRED', 'REVOKED', 'COMPLETED', 'CANCELLED'].includes(this.request.status)
      ? this.request
      : null;
  }

  async createPendingGuardian(command: CreateTransferRequestCommand): Promise<TransferRequestRecord> {
    this.request = {
      ...requestBase,
      id: 'request-a',
      status: 'PENDING_GUARDIAN',
      targetSchoolId: command.targetSchoolId,
      requestedByUserId: command.requestedByUserId,
      academicYearTarget: command.academicYearTarget,
    };
    return this.request;
  }

  async listSentByTarget(): Promise<TransferRequestRecord[]> { return []; }
  async listReceivedBySource(): Promise<TransferRequestRecord[]> { return []; }

  async transitionIfCurrent(command: {
    id: string;
    expectedStatus: TransferRequestRecord['status'];
    nextStatus: TransferRequestRecord['status'];
    patch?: Partial<TransferRequestRecord>;
  }): Promise<TransferRequestRecord | null> {
    if (!this.request || this.request.id !== command.id || this.request.status !== command.expectedStatus) return null;
    this.transitionCalls.push({ expected: command.expectedStatus, next: command.nextStatus });
    this.request = { ...this.request, ...command.patch, status: command.nextStatus };
    return this.request;
  }

  async completeWithSnapshot(command: { id: string; snapshot: TransferSnapshotBuildResult }): Promise<TransferRequestRecord | null> {
    if (!this.request || this.request.id !== command.id || this.request.status !== 'APPROVED') return null;
    this.request = { ...this.request, status: 'COMPLETED', completedAt: command.snapshot.generatedAt };
    return this.request;
  }
}

class FakeAuditPort implements TransferAuditPort {
  events: string[] = [];
  async append(event: TransferAuditEventInput): Promise<void> {
    this.events.push(event.eventType);
  }

  async logDossierAccess(): Promise<void> {}
}

class FakeConsentPort implements GuardianConsentPort {
  consent: VerifiedTransferConsent = {
    requestId: 'request-a',
    consenterType: 'GUARDIAN',
    consenterRef: 'parent-a',
    channel: 'LINK_OTP',
    consentTextVersion: 'v1',
    scopeAccepted: true,
    ipAddress: '127.0.0.1',
  };

  async verifyAndConsume(): Promise<VerifiedTransferConsent> {
    return this.consent;
  }

  async revokeIfHolder(): Promise<{ consenterType: 'GUARDIAN' | 'ADULT_STUDENT'; consenterRef: string } | null> {
    return null;
  }
}

describe('use cases Phase 3 studentTransfer', () => {
  it('crée une demande côté école cible à partir du matricule national et refuse un doublon actif', async () => {
    const repository = new FakeTransferRepository();
    const audit = new FakeAuditPort();
    const useCase = new CreerDemandeTransfertUseCase(repository, audit);

    const created = await useCase.execute({
      nationalId: 'CM123',
      targetSchoolId: 'school-b',
      requestedByUserId: 'secretary-b',
      academicYearTarget: '2026-2027',
      now: new Date('2026-11-06T12:00:00.000Z'),
    });
    expect(created.status).toBe('PENDING_GUARDIAN');

    await expect(useCase.execute({
      nationalId: 'cm 123',
      targetSchoolId: 'school-b',
      requestedByUserId: 'secretary-b',
      academicYearTarget: '2026-2027',
      now: new Date('2026-11-06T12:00:00.000Z'),
    })).rejects.toThrow('demande active');
  });

  it('refuse un matricule invalide avant toute écriture', async () => {
    const repository = new FakeTransferRepository();
    const useCase = new CreerDemandeTransfertUseCase(repository, new FakeAuditPort());

    await expect(useCase.execute({
      nationalId: '***',
      targetSchoolId: 'school-b',
      requestedByUserId: 'secretary-b',
      academicYearTarget: '2026-2027',
    })).rejects.toThrow('alphanumérique');
    expect(repository.request).toBeNull();
  });

  it('ne fait passer la demande à PENDING_SOURCE qu’après consentement accepté', async () => {
    const repository = new FakeTransferRepository();
    repository.request = { ...requestBase };
    const audit = new FakeAuditPort();
    const useCase = new EnregistrerConsentementTransfertUseCase(repository, new FakeConsentPort(), audit);

    await useCase.execute({ requestId: 'request-a', token: 'signed-token', otp: '123456' });

    expect(repository.request?.status).toBe('PENDING_SOURCE');
    expect(audit.events).toContain('GUARDIAN_CONSENT_ACCEPTED');
  });

  it('traite un refus du tuteur : REFUSED_BY_GUARDIAN, jamais PENDING_SOURCE', async () => {
    const repository = new FakeTransferRepository();
    repository.request = { ...requestBase };
    const audit = new FakeAuditPort();
    const consent = new FakeConsentPort();
    const useCase = new EnregistrerConsentementTransfertUseCase(repository, consent, audit);

    await useCase.execute({ requestId: 'request-a', token: 'signed-token', otp: '123456', decision: 'REFUSE' });

    expect(repository.request?.status).toBe('REFUSED_BY_GUARDIAN');
    expect(audit.events).toContain('GUARDIAN_CONSENT_REFUSED');
    expect(repository.transitionCalls[0]).toEqual({ expected: 'PENDING_GUARDIAN', next: 'REFUSED_BY_GUARDIAN' });
  });

  it('journalise le canal assisté au guichet', async () => {
    const repository = new FakeTransferRepository();
    repository.request = { ...requestBase };
    const audit = new FakeAuditPort();
    const useCase = new EnregistrerConsentementTransfertUseCase(repository, new FakeConsentPort(), audit);

    await useCase.execute({
      requestId: 'request-a',
      token: 'signed-token',
      otp: '123456',
      channel: 'ASSISTED_BY_STAFF',
    });

    expect(audit.events).toContain('GUARDIAN_CONSENT_ACCEPTED');
  });

  it('refuse la décision de l’école source si la demande n’est pas à PENDING_SOURCE', async () => {
    const repository = new FakeTransferRepository();
    repository.request = { ...requestBase };
    const audit = new FakeAuditPort();
    const useCase = new DeciderDemandeTransfertUseCase(repository, audit);

    await expect(useCase.execute({
      requestId: 'request-a',
      sourceSchoolId: 'school-a',
      decision: 'APPROVE',
      actorUserId: 'admin-a',
    })).rejects.toThrow('PENDING_SOURCE');
    expect(audit.events).toHaveLength(0);
  });
});
