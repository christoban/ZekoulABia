import { describe, expect, it } from 'bun:test';
import type {
  CompletedTransferBrief,
  CreateTransferRequestCommand,
  SourceReceivedBrief,
  TargetSentBrief,
  TransferRequestRecord,
  TransferRequestRepositoryPort,
} from '../../../../src/domain/ports/repositories/TransferRequestRepository.ts';
import type { TransferSnapshotBuildResult } from '../../../../src/domain/ports/services/TransferSnapshotBuilderPort.ts';
import type { TransferAuditEventInput, TransferAuditPort } from '../../../../src/domain/ports/services/TransferAuditPort.ts';
import type {
  ConsentChallengeState,
  GuardianConsentPort,
  VerifiedTransferConsent,
} from '../../../../src/domain/ports/services/GuardianConsentPort.ts';
import { EnregistrerConsentementTransfertUseCase } from '../../../../src/application/studentTransfer/EnregistrerConsentementTransfertUseCase.ts';
import { AutoApprouverDemandeTransfertUseCase } from '../../../../src/application/studentTransfer/AutoApprouverDemandeTransfertUseCase.ts';

/**
 * Phase 6 — consentement : OTP faux, lien expiré, lien réutilisé, jeton
 * détourné, périmètre non accepté, canal assisté. Aucune transition d'état ni
 * écriture d'audit ne survient quand la vérification échoue ; l'auto-probation
 * n'est jamais armée par un refus du tuteur.
 */
const base: TransferRequestRecord = {
  id: 'request-a', identityId: 'identity-a', sourceSchoolId: 'school-a', targetSchoolId: 'school-b',
  sourceStudentProfileId: 'student-a', targetStudentProfileId: null, requestedByUserId: 'secretary-b',
  academicYearTarget: '2026-2027', status: 'PENDING_GUARDIAN', requestedAt: new Date('2026-11-05'),
  guardianDecisionAt: null, sourceDecisionAt: null, completedAt: null,
  parentExpiresAt: new Date('2026-12-05'), sourceAutoApprovalAt: null,
  rejectionReason: null, rejectedBy: null,
};

interface TransitionCaptee {
  expectedStatus: TransferRequestRecord['status'];
  nextStatus: TransferRequestRecord['status'];
  patch?: Partial<TransferRequestRecord>;
}

class FakeRepository implements TransferRequestRepositoryPort {
  request: TransferRequestRecord = { ...base };
  transitions: TransitionCaptee[] = [];

  async findById(id: string): Promise<TransferRequestRecord | null> {
    return this.request.id === id ? this.request : null;
  }
  async findActiveByIdentityByNationalId(): Promise<TransferRequestRecord | null> { return null; }
  async createPendingGuardian(command: CreateTransferRequestCommand): Promise<TransferRequestRecord> { this.request = { ...base, targetSchoolId: command.targetSchoolId }; return this.request; }
  async listSentByTarget(): Promise<TargetSentBrief[]> { return []; }
  async listReceivedBySource(): Promise<SourceReceivedBrief[]> { return []; }
  async listCompletedForTargetSchool(): Promise<CompletedTransferBrief[]> { return []; }
  async transitionIfCurrent(command: TransitionCaptee & { id: string }): Promise<TransferRequestRecord | null> {
    if (this.request.id !== command.id || this.request.status !== command.expectedStatus) return null;
    this.transitions.push({ expectedStatus: command.expectedStatus, nextStatus: command.nextStatus, patch: command.patch });
    this.request = { ...this.request, ...command.patch, status: command.nextStatus };
    return this.request;
  }
  async completeWithSnapshot(): Promise<TransferRequestRecord | null> { throw new Error('non utilisé'); }
}

class FakeAudit implements TransferAuditPort {
  events: TransferAuditEventInput[] = [];
  async append(event: TransferAuditEventInput): Promise<void> { this.events.push(event); }
  async logDossierAccess(): Promise<void> {}
}

type ScenarioVerify = { jetonsLegal: number };

class FakeConsent implements GuardianConsentPort {
  verifys = 0;
  /** Jetons valides consommables pour les N premières tentatives, puis refus (réutilisation). */
  jetonsConsommables = 1;
  reponse: VerifiedTransferConsent = {
    requestId: 'request-a', consenterType: 'GUARDIAN', consenterRef: 'parent-a',
    channel: 'LINK_OTP', consentTextVersion: 'student-transfer-v1', scopeAccepted: true,
    ipAddress: '127.0.0.1',
  };
  /** Si renseigné, la vérification échoue systématiquement avec ce message (OTP faux / expiré). */
  echec: string | null = null;
  otpRecu: string | null = null;

  async verifyAndConsume(input: { token: string; otp: string }): Promise<VerifiedTransferConsent> {
    this.verifys += 1;
    this.otpRecu = input.otp;
    if (this.echec) throw new Error(this.echec);
    if (this.verifys > this.jetonsConsommables) throw new Error('Lien de consentement expiré ou déjà utilisé.');
    return this.reponse;
  }
  async revokeIfHolder(): Promise<{ consenterType: 'GUARDIAN' | 'ADULT_STUDENT'; consenterRef: string } | null> { return null; }
  async describeIfHolder(): Promise<ConsentChallengeState | null> { return null; }
}

describe('sécurité du consentement parent (Phase 6)', () => {
  it('un OTP faux n’entraîne aucune transition ni aucun audit', async () => {
    const repository = new FakeRepository();
    const consent = new FakeConsent();
    consent.echec = 'OTP invalide.';
    const audit = new FakeAudit();
    const enregistrer = new EnregistrerConsentementTransfertUseCase(repository, consent, audit);

    await expect(enregistrer.execute({ requestId: 'request-a', token: 'signe', otp: '000000' })).rejects.toThrow('OTP invalide');

    expect(repository.transitions).toHaveLength(0);
    expect(audit.events).toHaveLength(0);
    expect(repository.request.status).toBe('PENDING_GUARDIAN');
  });

  it('un lien expiré est refusé avant toute transition', async () => {
    const repository = new FakeRepository();
    const consent = new FakeConsent();
    consent.echec = 'Lien de consentement expiré ou déjà utilisé.';
    const enregistrer = new EnregistrerConsentementTransfertUseCase(repository, consent, new FakeAudit());

    await expect(enregistrer.execute({ requestId: 'request-a', token: 'signe', otp: '123456' })).rejects.toThrow('expiré');
    expect(repository.transitions).toHaveLength(0);
    expect(repository.request.status).toBe('PENDING_GUARDIAN');
  });

  it('un lien déjà consommé (réutilisation) ne peut pas reconsentir', async () => {
    const repository = new FakeRepository();
    const consent = new FakeConsent();
    const enregistrer = new EnregistrerConsentementTransfertUseCase(repository, consent, new FakeAudit());

    await enregistrer.execute({ requestId: 'request-a', token: 'signe', otp: '123456' });
    expect(repository.request.status).toBe('PENDING_SOURCE');

    repository.request = { ...base };
    await expect(enregistrer.execute({ requestId: 'request-a', token: 'signe', otp: '123456' }))
      .rejects.toThrow('déjà utilisé');
    expect(repository.request.status).toBe('PENDING_GUARDIAN');
  });

  it('un jeton lié à une autre demande est détecté (requestId ne correspond pas)', async () => {
    const repository = new FakeRepository();
    const consent = new FakeConsent();
    consent.jetonsConsommables = 9;
    consent.reponse = { ...consent.reponse, requestId: 'request-autre' };
    const enregistrer = new EnregistrerConsentementTransfertUseCase(repository, consent, new FakeAudit());

    await expect(enregistrer.execute({ requestId: 'request-a', token: 'esigne-autre-demande', otp: '123456' }))
      .rejects.toThrow('ne correspond pas');
    expect(repository.transitions).toHaveLength(0);
  });

  it('l’acceptation exige le périmètre du consentement accepté', async () => {
    const repository = new FakeRepository();
    const consent = new FakeConsent();
    consent.jetonsConsommables = 9;
    consent.reponse = { ...consent.reponse, scopeAccepted: false };
    const enregistrer = new EnregistrerConsentementTransfertUseCase(repository, consent, new FakeAudit());

    await expect(enregistrer.execute({ requestId: 'request-a', token: 'signe', otp: '123456' }))
      .rejects.toThrow('périmètre');
    expect(repository.transitions).toHaveLength(0);
  });

  it('un refus du tuteur n’arme JAMAIS l’auto-approbation (pas de sourceAutoApprovalAt)', async () => {
    const repository = new FakeRepository();
    const consent = new FakeConsent();
    consent.jetonsConsommables = 9;
    consent.reponse = { ...consent.reponse, channel: 'ASSISTED_BY_STAFF' };
    const audit = new FakeAudit();
    const enregistrer = new EnregistrerConsentementTransfertUseCase(repository, consent, audit);

    await enregistrer.execute({ requestId: 'request-a', token: 'signe', otp: '123456', decision: 'REFUSE' });

    expect(repository.transitions[0]?.patch?.sourceAutoApprovalAt).toBeUndefined();
    expect(repository.request.sourceAutoApprovalAt).toBeNull();
    expect(audit.events[0]?.eventType).toBe('GUARDIAN_CONSENT_REFUSED');
    expect(audit.events[0]?.metadata).toMatchObject({ channel: 'ASSISTED_BY_STAFF' });
  });

  it('l’auto-approbation ne s’applique jamais sans consentement (PENDING_GUARDIAN), même après J+7', async () => {
    const repository = new FakeRepository();
    repository.request = { ...base, status: 'PENDING_GUARDIAN', sourceAutoApprovalAt: new Date('2026-11-01') };
    const audit = new FakeAudit();
    const autoApprouver = new AutoApprouverDemandeTransfertUseCase(repository, audit);

    expect(await autoApprouver.execute('request-a', new Date('2026-11-20T00:00:00.000Z'))).toBe(false);
    expect(repository.request.status).toBe('PENDING_GUARDIAN');
    expect(audit.events).toHaveLength(0);
  });

  it('l’auto-approbation ne s’applique pas non plus sans date armée', async () => {
    const repository = new FakeRepository();
    repository.request = { ...base, status: 'PENDING_GUARDIAN', sourceAutoApprovalAt: null };
    expect(await new AutoApprouverDemandeTransfertUseCase(repository, new FakeAudit())
      .execute('request-a', new Date('2026-11-20T00:00:00.000Z'))).toBe(false);
    expect(repository.request.status).toBe('PENDING_GUARDIAN');
  });
});
