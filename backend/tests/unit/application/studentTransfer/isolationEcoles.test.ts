import { describe, expect, it } from 'bun:test';
import type {
  CompletedTransferBrief,
  SourceReceivedBrief,
  TargetSentBrief,
  TransferRequestRecord,
  TransferRequestRepositoryPort,
} from '../../../../src/domain/ports/repositories/TransferRequestRepository.ts';
import type { TransferAuditEventInput, TransferAuditPort } from '../../../../src/domain/ports/services/TransferAuditPort.ts';
import type { ConsentChallengeState, GuardianConsentPort } from '../../../../src/domain/ports/services/GuardianConsentPort.ts';
import type { TransferSnapshotBuildResult, TransferSnapshotBuilderPort } from '../../../../src/domain/ports/services/TransferSnapshotBuilderPort.ts';
import type { TransferSnapshotEncryptionPort } from '../../../../src/domain/ports/services/TransferSnapshotEncryptionPort.ts';
import { DeciderDemandeTransfertUseCase } from '../../../../src/application/studentTransfer/DeciderDemandeTransfertUseCase.ts';
import { AnnulerDemandeTransfertUseCase } from '../../../../src/application/studentTransfer/AnnulerDemandeTransfertUseCase.ts';
import { ConsulterDossierTransfertUseCase } from '../../../../src/application/studentTransfer/ConsulterDossierTransfertUseCase.ts';
import { ListerHistoriqueTransfertsUseCase } from '../../../../src/application/studentTransfer/ListerHistoriqueTransfertsUseCase.ts';
import { ConsulterEtatConsentementTransfertUseCase } from '../../../../src/application/studentTransfer/ConsulterEtatConsentementTransfertUseCase.ts';

/**
 * Phase 6 — isolation inter-écoles : l'école A (source) ne décide ni n'annule
 * via l'écran de B et inversement ; le dossier reste inaccessible avant
 * COMPLETED, quel que soit l'état intermédiaire ; l'historique n'est jamais
 * servi hors de l'école courante.
 */
const base: TransferRequestRecord = {
  id: 'request-iso', identityId: 'identity-iso', sourceSchoolId: 'school-a', targetSchoolId: 'school-b',
  sourceStudentProfileId: 'student-a', targetStudentProfileId: null, requestedByUserId: 'secretary-b',
  academicYearTarget: '2026-2027', status: 'PENDING_SOURCE', requestedAt: new Date('2026-11-01'),
  guardianDecisionAt: new Date('2026-11-02'), sourceDecisionAt: null, completedAt: null,
  parentExpiresAt: new Date('2026-12-01'), sourceAutoApprovalAt: new Date('2026-11-08'),
  rejectionReason: null, rejectedBy: null,
};

class FakeRepository implements TransferRequestRepositoryPort {
  request: TransferRequestRecord | null = { ...base };
  dernierTargetSchoolIdHistorique: string | null = null;
  remplitHistorique: CompletedTransferBrief[] = [];

  async findById(id: string): Promise<TransferRequestRecord | null> {
    return this.request?.id === id ? this.request : null;
  }
  async findActiveByIdentityByNationalId(): Promise<TransferRequestRecord | null> { return null; }
  async createPendingGuardian(): Promise<TransferRequestRecord> { throw new Error('non utilisé'); }
  async listSentByTarget(): Promise<TargetSentBrief[]> { return []; }
  async listReceivedBySource(): Promise<SourceReceivedBrief[]> { return []; }
  async listCompletedForTargetSchool(targetSchoolId: string): Promise<CompletedTransferBrief[]> {
    this.dernierTargetSchoolIdHistorique = targetSchoolId;
    return this.remplitHistorique;
  }
  async transitionIfCurrent(): Promise<TransferRequestRecord | null> { throw new Error('non utilisé'); }
  async completeWithSnapshot(): Promise<TransferRequestRecord | null> { throw new Error('non utilisé'); }
}

class FakeAudit implements TransferAuditPort {
  events: string[] = [];
  async append(event: TransferAuditEventInput): Promise<void> { this.events.push(event.eventType); }
  async logDossierAccess(): Promise<void> { this.events.push('DOSSIER_ACCESS'); }
}

class FakeSnapshotBuilder implements TransferSnapshotBuilderPort {
  async buildApprovedSnapshot(): Promise<TransferSnapshotBuildResult> { throw new Error('non utilisé'); }
  async readForTargetSchool(): Promise<TransferSnapshotBuildResult> {
    return {
      snapshotId: 'snapshot-iso', payloadEncrypted: 'chiffre', schemaVersion: '1.0',
      categories: ['IDENTITY'], checksum: 'somme', generatedAt: new Date('2026-11-09'),
      deleteAfter: new Date('2026-12-09'),
    };
  }
  async deleteExpired(): Promise<number> { return 0; }
}

class FakeEncryption implements TransferSnapshotEncryptionPort {
  async encrypt(): Promise<string> { throw new Error('non utilisé'); }
  async decrypt(): Promise<string> { return JSON.stringify({}); }
}

class FakeConsent implements GuardianConsentPort {
  async verifyAndConsume(): Promise<never> { throw new Error('non utilisé'); }
  async revokeIfHolder(): Promise<never> { throw new Error('non utilisé'); }
  async describeIfHolder(): Promise<ConsentChallengeState | null> { return null; }
}

const SNAPSHOT: TransferSnapshotBuildResult = {
  snapshotId: 'snapshot-iso', payloadEncrypted: 'chiffre', schemaVersion: '1.0',
  categories: ['IDENTITY'], checksum: 'somme', generatedAt: new Date('2026-11-09'),
  deleteAfter: new Date('2026-12-09'),
};

describe('isolation inter-écoles (Phase 6)', () => {
  it('l’école cible B ne peut ni approuver ni refuser la demande de l’école source A', async () => {
    const repository = new FakeRepository();
    const decide = new DeciderDemandeTransfertUseCase(repository, new FakeAudit());

    await expect(decide.execute({
      requestId: 'request-iso', sourceSchoolId: 'school-b', decision: 'APPROVE', actorUserId: 'admin-b',
    })).rejects.toThrow('école source');
    await expect(decide.execute({
      requestId: 'request-iso', sourceSchoolId: 'school-b', decision: 'REFUSE', rejectionReason: 'effectif complet', actorUserId: 'admin-b',
    })).rejects.toThrow('école source');
  });

  it('l’école source A ne peut pas annuler une demande envoyée (droit réservé à la cible B)', async () => {
    const repository = new FakeRepository();
    repository.request = { ...base, status: 'PENDING_SOURCE' };
    const annuler = new AnnulerDemandeTransfertUseCase(repository, new FakeAudit());

    await expect(annuler.execute('request-iso', 'school-a', 'admin-a')).rejects.toThrow('école cible');
  });

  it('aucun dossier n’est lisible avant COMPLETED, quel que soit l’état intermédiaire', async () => {
    const repository = new FakeRepository();
    const audit = new FakeAudit();
    const consulter = new ConsulterDossierTransfertUseCase(repository, new FakeSnapshotBuilder(), new FakeEncryption(), audit);

    for (const status of ['PENDING_GUARDIAN', 'PENDING_SOURCE', 'APPROVED'] as const) {
      repository.request = { ...base, status, completedAt: null };
      await expect(consulter.execute({
        requestId: 'request-iso', snapshotId: SNAPSHOT.snapshotId, targetSchoolId: 'school-b', userId: 'user-b',
      })).rejects.toThrow('avant COMPLETED');
    }
    expect(audit.events).toHaveLength(0);
  });

  it('le dossier résiste aussi à une école tierce C', async () => {
    const repository = new FakeRepository();
    repository.request = { ...base, status: 'COMPLETED', completedAt: new Date('2026-11-09') };
    const consulter = new ConsulterDossierTransfertUseCase(repository, new FakeSnapshotBuilder(), new FakeEncryption(), new FakeAudit());

    await expect(consulter.execute({
      requestId: 'request-iso', snapshotId: SNAPSHOT.snapshotId, targetSchoolId: 'school-c', userId: 'user-c',
    })).rejects.toThrow('école cible');
  });

  it('l’historique des transferts est servi uniquement avec l’école de l’appelant (scoping port)', async () => {
    const repository = new FakeRepository();
    repository.remplitHistorique = [{
      id: 'request-iso', completedAt: null, sourceSchoolName: 'A', snapshotId: null, targetStudentProfileId: null,
    }];
    const lignes = await new ListerHistoriqueTransfertsUseCase(repository).execute('school-b');

    expect(repository.dernierTargetSchoolIdHistorique).toBe('school-b');
    expect(lignes).toHaveLength(1);
  });

  it('un jeton qui n’est pas le détenteur du challenge ne révèle aucun état (null = inconnu, jamais d’autres données)', async () => {
    const etat = new ConsulterEtatConsentementTransfertUseCase(new FakeConsent());

    await expect(etat.execute({ token: 'jeton-inconnu', requestId: 'request-iso' })).resolves.toBeNull();
    await expect(etat.execute({ token: '', requestId: 'request-iso' })).resolves.toBeNull();
  });
});
