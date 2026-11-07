import { describe, expect, it } from 'bun:test';
import type { TransferRequestRecord, TransferRequestRepositoryPort } from '../../../../src/domain/ports/repositories/TransferRequestRepository.ts';
import type { TransferAuditEventInput, TransferAuditPort } from '../../../../src/domain/ports/services/TransferAuditPort.ts';
import type { TransferSnapshotBuildResult, TransferSnapshotBuilderPort } from '../../../../src/domain/ports/services/TransferSnapshotBuilderPort.ts';
import type { TransferSnapshotEncryptionPort } from '../../../../src/domain/ports/services/TransferSnapshotEncryptionPort.ts';
import type { GuardianConsentPort } from '../../../../src/domain/ports/services/GuardianConsentPort.ts';
import type { StudentTransferLifecycleRepository } from '../../../../src/domain/ports/repositories/StudentTransferLifecycleRepository.ts';
import { AutoApprouverDemandeTransfertUseCase } from '../../../../src/application/studentTransfer/AutoApprouverDemandeTransfertUseCase.ts';
import { ExpirerDemandeTransfertUseCase } from '../../../../src/application/studentTransfer/ExpirerDemandeTransfertUseCase.ts';
import { RevoquerConsentementTransfertUseCase } from '../../../../src/application/studentTransfer/RevoquerConsentementTransfertUseCase.ts';
import { AnnulerDemandeTransfertUseCase } from '../../../../src/application/studentTransfer/AnnulerDemandeTransfertUseCase.ts';
import { GenererInstantaneTransfertUseCase } from '../../../../src/application/studentTransfer/GenererInstantaneTransfertUseCase.ts';
import { ConsulterDossierTransfertUseCase } from '../../../../src/application/studentTransfer/ConsulterDossierTransfertUseCase.ts';
import { AssocierProfilCibleTransfertUseCase } from '../../../../src/application/studentTransfer/AssocierProfilCibleTransfertUseCase.ts';
import { createHash } from 'node:crypto';

const base: TransferRequestRecord = {
  id: 'request-a', identityId: 'identity-a', sourceSchoolId: 'school-a', targetSchoolId: 'school-b',
  sourceStudentProfileId: 'student-a', targetStudentProfileId: null, requestedByUserId: 'user-b',
  academicYearTarget: '2026-2027', status: 'PENDING_SOURCE', requestedAt: new Date('2026-11-01'),
  guardianDecisionAt: new Date('2026-11-02'), sourceDecisionAt: null, completedAt: null,
  parentExpiresAt: new Date('2026-12-01'), sourceAutoApprovalAt: new Date('2026-11-08'),
  rejectionReason: null, rejectedBy: null,
};

class FakeRepository implements TransferRequestRepositoryPort {
  request: TransferRequestRecord = { ...base };
  async findById(): Promise<TransferRequestRecord> { return this.request; }
  async findActiveByIdentityByNationalId(): Promise<TransferRequestRecord | null> { return this.request; }
  async createPendingGuardian(): Promise<TransferRequestRecord> { return this.request; }
  async listSentByTarget(): Promise<TransferRequestRecord[]> { return []; }
  async listReceivedBySource(): Promise<TransferRequestRecord[]> { return []; }
  async transitionIfCurrent(command: { id: string; expectedStatus: TransferRequestRecord['status']; nextStatus: TransferRequestRecord['status']; patch?: Partial<TransferRequestRecord> }): Promise<TransferRequestRecord | null> {
    if (this.request.id !== command.id || this.request.status !== command.expectedStatus) return null;
    this.request = { ...this.request, ...command.patch, status: command.nextStatus };
    return this.request;
  }
  async completeWithSnapshot(command: { id: string; snapshot: TransferSnapshotBuildResult }): Promise<TransferRequestRecord | null> {
    if (this.request.id !== command.id || this.request.status !== 'APPROVED') return null;
    this.request = { ...this.request, status: 'COMPLETED', completedAt: command.snapshot.generatedAt };
    return this.request;
  }
}

class FakeAudit implements TransferAuditPort {
  events: string[] = [];
  accesses = 0;
  async append(event: TransferAuditEventInput): Promise<void> { this.events.push(event.eventType); }
  async logDossierAccess(): Promise<void> { this.accesses += 1; }
}

class FakeConsent implements GuardianConsentPort {
  titre: { consenterType: 'GUARDIAN' | 'ADULT_STUDENT'; consenterRef: string } = {
    consenterType: 'GUARDIAN',
    consenterRef: 'parent-a',
  };

  async verifyAndConsume(): Promise<never> {
    throw new Error('non utilisé par cette suite');
  }

  async revokeIfHolder(input: { token: string }): Promise<{ consenterType: 'GUARDIAN' | 'ADULT_STUDENT'; consenterRef: string } | null> {
    return input.token === 'parent-token' ? this.titre : null;
  }
}

const snapshot: TransferSnapshotBuildResult = {
  snapshotId: 'snapshot-a', payloadEncrypted: 'encrypted', schemaVersion: '1.0',
  categories: ['IDENTITY'], checksum: 'checksum', generatedAt: new Date('2026-11-09'),
  deleteAfter: new Date('2026-12-09'),
};

class FakeSnapshotBuilder implements TransferSnapshotBuilderPort {
  calls = 0;
  async buildApprovedSnapshot(): Promise<TransferSnapshotBuildResult> { this.calls += 1; return snapshot; }
  async readForTargetSchool(): Promise<TransferSnapshotBuildResult> { this.calls += 1; return snapshot; }
  async deleteExpired(): Promise<number> { return 2; }
}

class FakeEncryption implements TransferSnapshotEncryptionPort {
  clair = JSON.stringify({ identity: { nationalId: 'CM123' } });
  async encrypt(): Promise<string> { return 'encrypted'; }
  async decrypt(): Promise<string> { return this.clair; }
}

class FakeLifecycle implements StudentTransferLifecycleRepository {
  calls = 0;
  targetCalls = 0;
  lastTarget: { transferRequestId: string; targetStudentProfileId: string } | null = null;
  alreadyLinked = false;

  async markSourceTransferred(): Promise<void> { this.calls += 1; }
  async markTargetReceived(command: { transferRequestId: string; targetStudentProfileId: string }): Promise<boolean> {
    if (this.alreadyLinked) return false;
    this.targetCalls += 1;
    this.lastTarget = { transferRequestId: command.transferRequestId, targetStudentProfileId: command.targetStudentProfileId };
    return true;
  }
}

describe('use cases cycle de vie et dossier Phase 3', () => {
  it('n’auto-approuve pas avant la date calculée (jamais sans consentement parent)', async () => {
    const repository = new FakeRepository();
    const audit = new FakeAudit();
    const result = await new AutoApprouverDemandeTransfertUseCase(repository, audit).execute('request-a', new Date('2026-11-07'));
    expect(result).toBe(false);
    expect(repository.request.status).toBe('PENDING_SOURCE');
  });

  it('expire uniquement une demande parent arrivée à échéance', async () => {
    const repository = new FakeRepository();
    repository.request = { ...base, status: 'PENDING_GUARDIAN', parentExpiresAt: new Date('2026-11-01') };
    const audit = new FakeAudit();
    expect(await new ExpirerDemandeTransfertUseCase(repository, audit).execute('request-a', new Date('2026-11-02'))).toBe(true);
    expect(repository.request.status).toBe('EXPIRED');
  });

  it('révoque avec le jeton du tuteur uniquement, avant ou après approbation', async () => {
    const repository = new FakeRepository();
    const audit = new FakeAudit();
    const consent = new FakeConsent();
    await new RevoquerConsentementTransfertUseCase(repository, consent, audit).execute({ requestId: 'request-a', token: 'parent-token' });
    expect(repository.request.status).toBe('REVOKED');

    repository.request = { ...base, status: 'APPROVED' };
    await new RevoquerConsentementTransfertUseCase(repository, consent, audit).execute({ requestId: 'request-a', token: 'parent-token' });
    expect(repository.request.status).toBe('REVOKED');

    repository.request = { ...base, status: 'PENDING_SOURCE' };
    await expect(new RevoquerConsentementTransfertUseCase(repository, consent, audit).execute({ requestId: 'request-a', token: 'mauvais-token' })).rejects.toThrow('Lien de consentement invalide');
    expect(repository.request.status).toBe('PENDING_SOURCE');
  });

  it('annule seulement depuis l’école cible', async () => {
    const repository = new FakeRepository();
    const audit = new FakeAudit();
    await expect(new AnnulerDemandeTransfertUseCase(repository, audit).execute('request-a', 'school-a', 'admin-a')).rejects.toThrow('école cible');
    await new AnnulerDemandeTransfertUseCase(repository, audit).execute('request-a', 'school-b', 'admin-b');
    expect(repository.request.status).toBe('CANCELLED');
  });

  it('génère l’instantané uniquement en APPROVED et complète avec le snapshot', async () => {
    const repository = new FakeRepository();
    const audit = new FakeAudit();
    const builder = new FakeSnapshotBuilder();
    const generate = new GenererInstantaneTransfertUseCase(repository, builder, audit);
    await expect(generate.execute('request-a')).rejects.toThrow('APPROVED');
    repository.request = { ...base, status: 'APPROVED' };
    await generate.execute('request-a');
    expect(repository.request.status).toBe('COMPLETED');
  });

  it('consulte le dossier déchiffré avec intégrité vérifiée', async () => {
    const repository = new FakeRepository();
    repository.request = { ...base, status: 'COMPLETED', completedAt: new Date('2026-11-09') };
    const audit = new FakeAudit();
    const builder = new FakeSnapshotBuilder();
    const encryption = new FakeEncryption();
    snapshot.checksum = createHash('sha256').update(encryption.clair, 'utf8').digest('hex');
    const consult = new ConsulterDossierTransfertUseCase(repository, builder, encryption, audit);

    await expect(consult.execute({ requestId: 'request-a', snapshotId: 'snapshot-a', targetSchoolId: 'school-a', userId: 'user-b' })).rejects.toThrow('école cible');
    const dossier = await consult.execute({ requestId: 'request-a', snapshotId: 'snapshot-a', targetSchoolId: 'school-b', userId: 'user-b' });
    expect(dossier.payload).toEqual({ identity: { nationalId: 'CM123' } });
    expect(audit.accesses).toBe(1);

    snapshot.checksum = 'corrompu';
    await expect(consult.execute({ requestId: 'request-a', snapshotId: 'snapshot-a', targetSchoolId: 'school-b', userId: 'user-b' })).rejects.toThrow('altéré');
  });

  it('associe le profil cible après COMPLETED, avec idempotence explicite', async () => {
    const repository = new FakeRepository();
    repository.request = { ...base, status: 'COMPLETED', completedAt: new Date('2026-11-09') };
    const lifecycle = new FakeLifecycle();
    const useCase = new AssocierProfilCibleTransfertUseCase(repository, lifecycle, new FakeAudit());

    await expect(useCase.execute({ requestId: 'request-a', targetStudentProfileId: 'target-a', actingSchoolId: 'school-a', actorUserId: 'user-b' })).rejects.toThrow('école cible');

    repository.request = { ...base, status: 'APPROVED' };
    await expect(useCase.execute({ requestId: 'request-a', targetStudentProfileId: 'target-a', actingSchoolId: 'school-b', actorUserId: 'user-b' })).rejects.toThrow('COMPLETED');

    repository.request = { ...base, status: 'COMPLETED', completedAt: new Date('2026-11-09') };

    await useCase.execute({ requestId: 'request-a', targetStudentProfileId: 'target-a', actingSchoolId: 'school-b', actorUserId: 'user-b' });
    expect(lifecycle.lastTarget).toEqual({ transferRequestId: 'request-a', targetStudentProfileId: 'target-a' });

    lifecycle.alreadyLinked = true;
    await expect(useCase.execute({ requestId: 'request-a', targetStudentProfileId: 'target-a', actingSchoolId: 'school-b', actorUserId: 'user-b' })).rejects.toThrow('déjà associé');
  });
});
