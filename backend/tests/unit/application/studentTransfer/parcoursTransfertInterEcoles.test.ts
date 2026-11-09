import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type {
  CompletedTransferBrief,
  CreateTransferRequestCommand,
  SourceReceivedBrief,
  TargetSentBrief,
  TransferRequestRecord,
  TransferRequestRepositoryPort,
} from '../../../../src/domain/ports/repositories/TransferRequestRepository.ts';
import type { TransferAuditEventInput, TransferAuditPort } from '../../../../src/domain/ports/services/TransferAuditPort.ts';
import type {
  ConsentChallengeState,
  GuardianConsentPort,
  VerifiedTransferConsent,
} from '../../../../src/domain/ports/services/GuardianConsentPort.ts';
import type { StudentTransferLifecycleRepository } from '../../../../src/domain/ports/repositories/StudentTransferLifecycleRepository.ts';
import type { CrossSchoolTransferGatewayPort } from '../../../../src/domain/ports/services/CrossSchoolTransferGatewayPort.ts';
import type {
  TransferSnapshotBuilderPort,
  TransferSnapshotBuildResult,
} from '../../../../src/domain/ports/services/TransferSnapshotBuilderPort.ts';
import { TransferSnapshotEncryptionAdapter } from '../../../../src/infrastructure/backup/TransferSnapshotEncryptionAdapter.ts';
import { DetecterIdentiteTransfertUseCase } from '../../../../src/application/studentTransfer/DetecterIdentiteTransfertUseCase.ts';
import { CreerDemandeTransfertUseCase } from '../../../../src/application/studentTransfer/CreerDemandeTransfertUseCase.ts';
import { EnregistrerConsentementTransfertUseCase } from '../../../../src/application/studentTransfer/EnregistrerConsentementTransfertUseCase.ts';
import { DeciderDemandeTransfertUseCase } from '../../../../src/application/studentTransfer/DeciderDemandeTransfertUseCase.ts';
import { GenererInstantaneTransfertUseCase } from '../../../../src/application/studentTransfer/GenererInstantaneTransfertUseCase.ts';
import { ConsulterDossierTransfertUseCase } from '../../../../src/application/studentTransfer/ConsulterDossierTransfertUseCase.ts';
import { AssocierProfilCibleTransfertUseCase } from '../../../../src/application/studentTransfer/AssocierProfilCibleTransfertUseCase.ts';
import { MarquerEleveTransfereUseCase } from '../../../../src/application/studentTransfer/MarquerEleveTransfereUseCase.ts';
import { construireSnapshotTransfert, TRANSFER_SNAPSHOT_CATEGORIES } from '../../../../src/application/studentTransfer/snapshotContract.ts';
import { creerFixtureDeuxEcoles } from '../../../helpers/studentTransferFixture.ts';

/**
 * Phase 6 — parcours complet A → B (fixtures 1H) : détection, création,
 * consentement (réutilisation interdite), décision source, instantané chiffré
 * (adaptateur AES réel + checksum réel), consultation cible, association du
 * profil de réception, marquage TRANSFERRED, historique. Chaque étape hors
 * ordre est prouée refusée au fil de l'eau.
 */
const FIXTURE = creerFixtureDeuxEcoles();
const A = FIXTURE.sourceSchoolId;
const B = FIXTURE.targetSchoolId;
const IDENTITY = FIXTURE.snapshotSource.identity;

let debutStatut = 'PENDING_GUARDIAN' as const;

class ParcoursRepository implements TransferRequestRepositoryPort {
  request: TransferRequestRecord = {
    id: 'request-parcours',
    identityId: 'identity-parcours',
    sourceSchoolId: A,
    targetSchoolId: B,
    sourceStudentProfileId: FIXTURE.sourceStudentProfileId,
    targetStudentProfileId: null,
    requestedByUserId: 'secretaire-b',
    academicYearTarget: '2026-2027',
    status: debutStatut,
    requestedAt: new Date('2026-11-02T09:00:00.000Z'),
    guardianDecisionAt: null,
    sourceDecisionAt: null,
    completedAt: null,
    parentExpiresAt: new Date('2026-11-17T09:00:00.000Z'),
    sourceAutoApprovalAt: null,
    rejectionReason: null,
    rejectedBy: null,
  };

  snapshot: TransferSnapshotBuildResult | null = null;
  transitions = 0;
  /** Le doublon actif n'existe qu'après la création de la demande du parcours. */
  private cree = false;

  async findById(id: string): Promise<TransferRequestRecord | null> {
    return this.request.id === id ? this.request : null;
  }
  async findActiveByIdentityByNationalId(): Promise<TransferRequestRecord | null> {
    return this.cree && !['REFUSED_BY_GUARDIAN', 'REFUSED_BY_SOURCE', 'EXPIRED', 'REVOKED', 'COMPLETED', 'CANCELLED'].includes(this.request.status)
      ? this.request
      : null;
  }
  async createPendingGuardian(command: CreateTransferRequestCommand): Promise<TransferRequestRecord> {
    this.cree = true;
    this.request = { ...this.request, targetSchoolId: command.targetSchoolId, requestedByUserId: command.requestedByUserId, academicYearTarget: command.academicYearTarget };
    return this.request;
  }
  async listSentByTarget(): Promise<TargetSentBrief[]> { return [{ ...this.request, sourceSchoolName: A }]; }
  async listReceivedBySource(): Promise<SourceReceivedBrief[]> {
    return [{ ...this.request, targetSchoolName: B, consenterDecision: 'ACCEPTED', consenterExpiresAt: null }];
  }
  async listCompletedForTargetSchool(targetSchoolId: string): Promise<CompletedTransferBrief[]> {
    if (targetSchoolId !== B || this.request.status !== 'COMPLETED') return [];
    return [{ id: this.request.id, completedAt: this.request.completedAt, sourceSchoolName: A, snapshotId: this.snapshot?.snapshotId ?? null, targetStudentProfileId: this.request.targetStudentProfileId }];
  }
  async transitionIfCurrent(command: { id: string; expectedStatus: TransferRequestRecord['status']; nextStatus: TransferRequestRecord['status']; patch?: Partial<TransferRequestRecord> }): Promise<TransferRequestRecord | null> {
    if (this.request.id !== command.id || this.request.status !== command.expectedStatus) return null;
    this.transitions += 1;
    this.request = { ...this.request, ...command.patch, status: command.nextStatus };
    return this.request;
  }
  async completeWithSnapshot(command: { id: string; snapshot: TransferSnapshotBuildResult }): Promise<TransferRequestRecord | null> {
    if (this.request.id !== command.id || this.request.status !== 'APPROVED') return null;
    this.snapshot = command.snapshot;
    this.request = { ...this.request, status: 'COMPLETED', completedAt: command.snapshot.generatedAt };
    return this.request;
  }
}

class ParcoursAudit implements TransferAuditPort {
  events: Array<Partial<TransferAuditEventInput & { eventType: string }>> = [];
  accesses = 0;
  async append(event: TransferAuditEventInput): Promise<void> { this.events.push({ eventType: event.eventType, stateAfter: event.stateAfter }); }
  async logDossierAccess(): Promise<void> { this.accesses += 1; }
}

/** Port réel de consommation unique : la 2e invocation du même jeton échoue. */
class ParcoursConsent implements GuardianConsentPort {
  consommations = 0;
  async verifyAndConsume(input: { token: string; otp: string; decision: 'ACCEPT' | 'REFUSE'; channel: VerifiedTransferConsent['channel'] }): Promise<VerifiedTransferConsent> {
    this.consommations += 1;
    if (this.consommations > 1) throw new Error('Lien de consentement expiré ou déjà utilisé.');
    return {
      requestId: 'request-parcours', consenterType: 'GUARDIAN', consenterRef: 'parent-fixture',
      channel: input.channel, consentTextVersion: 'student-transfer-v1', scopeAccepted: true,
      ipAddress: '10.0.0.1',
    };
  }
  async revokeIfHolder(): Promise<{ consenterType: 'GUARDIAN' | 'ADULT_STUDENT'; consenterRef: string } | null> { return null; }
  async describeIfHolder(): Promise<ConsentChallengeState | null> { return null; }
}

class ParcoursLifecycle implements StudentTransferLifecycleRepository {
  sourceMarquees: string[] = [];
  targetReceues: Array<{ transferRequestId: string; targetStudentProfileId: string }> = [];
  async markSourceTransferred(command: { sourceStudentProfileId: string }): Promise<void> {
    this.sourceMarquees.push(command.sourceStudentProfileId);
  }
  async markTargetReceived(command: { transferRequestId: string; targetStudentProfileId: string }): Promise<boolean> {
    this.targetReceues.push({ transferRequestId: command.transferRequestId, targetStudentProfileId: command.targetStudentProfileId });
    return true;
  }
}

class ParcoursGateway implements CrossSchoolTransferGatewayPort {
  async identityExists(nationalId: string, targetSchoolId: string): Promise<{ exists: boolean }> {
    return { exists: nationalId === IDENTITY.nationalId && targetSchoolId === B };
  }
}

/** Builder de parcours : contrat snapshot RÉEL (liste blanche + checksum) + AES réel. */
class ParcoursSnapshotBuilder implements TransferSnapshotBuilderPort {
  construits = 0;
  async buildApprovedSnapshot(): Promise<TransferSnapshotBuildResult> {
    const contract = construireSnapshotTransfert(FIXTURE.snapshotSource);
    const encryption = new TransferSnapshotEncryptionAdapter();
    return {
      snapshotId: 'snapshot-parcours',
      payloadEncrypted: await encryption.encrypt(JSON.stringify(contract.payload)),
      schemaVersion: contract.payload.schemaVersion,
      categories: [...contract.payload.categories],
      checksum: contract.checksum,
      generatedAt: new Date('2026-11-05T10:00:00.000Z'),
      deleteAfter: new Date('2026-12-15T10:00:00.000Z'),
    };
  }
  async readForTargetSchool(): Promise<TransferSnapshotBuildResult> {
    if (!this.enCache) throw new Error('snapshot introuvable');
    return this.enCache;
  }
  enCache: TransferSnapshotBuildResult | null = null;
  async deleteExpired(): Promise<number> { return 0; }
}

const CLE = process.env.BACKUP_ENCRYPTION_KEY;
beforeAll(() => {
  process.env.BACKUP_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
});
afterAll(() => {
  if (CLE === undefined) delete process.env.BACKUP_ENCRYPTION_KEY;
  else process.env.BACKUP_ENCRYPTION_KEY = CLE;
});

describe('parcours complet A → B avec les fixtures 1H (Phase 6)', () => {
  it('exécute le flux métier en respectant l’ordre des verrous inter-états', async () => {
    const repository = new ParcoursRepository();
    const audit = new ParcoursAudit();
    const consent = new ParcoursConsent();
    const builder = new ParcoursSnapshotBuilder();
    const lifecycle = new ParcoursLifecycle();

    // 1) Détection MINESEC côté école cible B (identité existante ailleurs)
    expect(await new DetecterIdentiteTransfertUseCase(new ParcoursGateway())
      .execute({ nationalId: IDENTITY.nationalId, targetSchoolId: B })).toEqual({ exists: true });

    // 2) Création de la demande
    const demande = await new CreerDemandeTransfertUseCase(repository, audit).execute({
      nationalId: IDENTITY.nationalId, targetSchoolId: B, requestedByUserId: 'secretaire-b',
      academicYearTarget: '2026-2027', now: repository.request.requestedAt,
    });
    expect(demande.status).toBe('PENDING_GUARDIAN');
    expect(audit.events[0]).toMatchObject({ eventType: 'REQUEST_CREATED', stateAfter: 'PENDING_GUARDIAN' });

    // 2bis) doublon actif refusé
    await expect(new CreerDemandeTransfertUseCase(repository, audit).execute({
      nationalId: IDENTITY.nationalId.toLowerCase(), targetSchoolId: B, requestedByUserId: 'secretaire-b',
      academicYearTarget: '2026-2027',
    })).rejects.toThrow('demande active');

    // 3) Hors ordre : dossier intraçable avant consentement/approbation
    const consulter = new ConsulterDossierTransfertUseCase(repository, builder, new TransferSnapshotEncryptionAdapter(), audit);
    await expect(consulter.execute({ requestId: 'request-parcours', snapshotId: 'x', targetSchoolId: B, userId: 'user-b' }))
      .rejects.toThrow('avant COMPLETED');

    // 4) Consentement tuteur, un seul jeton consommable
    const enregistrer = new EnregistrerConsentementTransfertUseCase(repository, consent, audit);
    await enregistrer.execute({ requestId: 'request-parcours', token: 'jeton-tuteur', otp: '123456' });
    expect(repository.request.status).toBe('PENDING_SOURCE');
    expect(consent.consommations).toBe(1);
    // rejeu avec le même jeton : la demande n'attend plus de consentement (verrou d'état avant le jeton)
    await expect(enregistrer.execute({ requestId: 'request-parcours', token: 'jeton-tuteur', otp: '123456' }))
      .rejects.toThrow('hors de PENDING_GUARDIAN');
    expect(consent.consommations).toBe(1);
    // l'auto-approbation J+7 est armée par le consentement accepté (date réelle + 7 jours)
    expect(repository.request.sourceAutoApprovalAt).toBeInstanceOf(Date);

    // 5) Décision de l'école source A (isolation : B ne peut pas décider)
    const decider = new DeciderDemandeTransfertUseCase(repository, audit);
    await expect(decider.execute({
      requestId: 'request-parcours', sourceSchoolId: B, decision: 'APPROVE', actorUserId: 'admin-b',
    })).rejects.toThrow('école source');
    await decider.execute({ requestId: 'request-parcours', sourceSchoolId: A, decision: 'APPROVE', actorUserId: 'admin-a' });
    expect(repository.request.status).toBe('APPROVED');

    // 5bis) marquage TRANSFERRED refusé avant COMPLETED
    const marquer = new MarquerEleveTransfereUseCase(lifecycle);
    await expect(marquer.execute({
      transferRequestId: 'request-parcours', sourceStudentProfileId: FIXTURE.sourceStudentProfileId,
      sourceSchoolId: A, targetSchoolId: B, status: 'APPROVED',
    })).rejects.toThrow('COMPLETED');
    expect(lifecycle.sourceMarquees).toHaveLength(0);

    // 6) Instantané : contrat réel (liste blanche + checksum + AES réel), puis COMPLETED
    const instantane = await new GenererInstantaneTransfertUseCase(repository, builder, audit)
      .execute('request-parcours');
    expect(repository.request.status).toBe('COMPLETED');
    expect([...instantane.categories]).toEqual([...TRANSFER_SNAPSHOT_CATEGORIES]);
    builder.enCache = instantane;

    // 6bis) la consultation pour l'école A (source) reste refusée après COMPLETED
    await expect(consulter.execute({ requestId: 'request-parcours', snapshotId: instantane.snapshotId, targetSchoolId: A, userId: 'user-a' }))
      .rejects.toThrow('école cible');

    // 7) Consultation cible : dossier déchiffré, sans données exclues
    const dossier = await consulter.execute({
      requestId: 'request-parcours', snapshotId: instantane.snapshotId, targetSchoolId: B, userId: 'user-b',
    });
    expect([...dossier.categories]).toEqual([...TRANSFER_SNAPSHOT_CATEGORIES]);
    expect(audit.accesses).toBe(1);
    const serialise = JSON.stringify(dossier.payload);
    expect(serialise).toContain(IDENTITY.nationalId);
    expect(serialise).not.toContain('discipline');
    expect(serialise).not.toContain('followUp');
    expect(serialise).not.toContain('payments');
    expect(serialise).not.toContain('medical');

    // 8) Association du profil de réception côté B (l'école A ne peut pas)
    const associer = new AssocierProfilCibleTransfertUseCase(repository, lifecycle, audit);
    await expect(associer.execute({
      requestId: 'request-parcours', targetStudentProfileId: FIXTURE.targetStudentProfileId,
      actingSchoolId: A, actorUserId: 'user-a',
    })).rejects.toThrow('école cible');
    await associer.execute({
      requestId: 'request-parcours', targetStudentProfileId: FIXTURE.targetStudentProfileId,
      actingSchoolId: B, actorUserId: 'user-b',
    });
    expect(lifecycle.targetReceues[0]).toEqual({ transferRequestId: 'request-parcours', targetStudentProfileId: FIXTURE.targetStudentProfileId });

    // 9) Marquage TRANSFERRED de l'élève côté école source A
    await marquer.execute({
      transferRequestId: 'request-parcours', sourceStudentProfileId: FIXTURE.sourceStudentProfileId,
      sourceSchoolId: A, targetSchoolId: B, status: 'COMPLETED',
    });
    expect(lifecycle.sourceMarquees).toEqual([FIXTURE.sourceStudentProfileId]);

    // 10) Historique du censeur B (et rien pour A) — l'association cible est attestée par le lifecycle réel
    const historiqueB = await repository.listCompletedForTargetSchool(B);
    expect(historiqueB).toHaveLength(1);
    expect(historiqueB[0]).toMatchObject({ sourceSchoolName: A, snapshotId: 'snapshot-parcours' });
    expect(await repository.listCompletedForTargetSchool(A)).toHaveLength(0);

    // 11) Ordre complet des événements d'audit du parcours
    expect(audit.events.map(e => e.eventType)).toEqual([
      'REQUEST_CREATED',
      'GUARDIAN_CONSENT_ACCEPTED',
      'SOURCE_APPROVED',
      'SNAPSHOT_GENERATED',
      'TARGET_PROFILE_LINKED',
    ]);
    expect(audit.events[0]?.stateAfter).toBe('PENDING_GUARDIAN');
    expect(audit.events[1]?.stateAfter).toBe('PENDING_SOURCE');
    expect(audit.events[2]?.stateAfter).toBe('APPROVED');
    expect(audit.events[3]?.stateAfter).toBe('COMPLETED');
  });
});
