import { describe, expect, it } from 'bun:test';
import type {
  CompletedTransferBrief,
  SourceReceivedBrief,
  TargetSentBrief,
  TransferRequestRecord,
  TransferRequestRepositoryPort,
} from '../../../../src/domain/ports/repositories/TransferRequestRepository.ts';
import type { TransferAuditEventInput, TransferAuditPort } from '../../../../src/domain/ports/services/TransferAuditPort.ts';
import type { TransferSnapshotBuildResult, TransferSnapshotBuilderPort } from '../../../../src/domain/ports/services/TransferSnapshotBuilderPort.ts';
import { AutoApprouverDemandeTransfertUseCase } from '../../../../src/application/studentTransfer/AutoApprouverDemandeTransfertUseCase.ts';
import { ExpirerDemandeTransfertUseCase } from '../../../../src/application/studentTransfer/ExpirerDemandeTransfertUseCase.ts';
import { SupprimerInstantanesExpiresUseCase } from '../../../../src/application/studentTransfer/SupprimerInstantanesExpiresUseCase.ts';
import { choisirJourRelance } from '../../../../src/application/studentTransfer/RappelerConsentementTransfertUseCase.ts';

/**
 * Phase 6 — jobs : le replay d'un job ne double pas ses effets (statut final
 * après coup, transitions irréversibles), la purge transmet bien « maintenant »
 * au port, et le jour de relance J+3/J+10 est dédoublonné.
 */
const base: TransferRequestRecord = {
  id: 'request-job', identityId: 'identity-job', sourceSchoolId: 'school-a', targetSchoolId: 'school-b',
  sourceStudentProfileId: 'student-a', targetStudentProfileId: null, requestedByUserId: 'secretary-b',
  academicYearTarget: '2026-2027', status: 'PENDING_SOURCE', requestedAt: new Date('2026-11-01T09:00:00.000Z'),
  guardianDecisionAt: new Date('2026-11-01T10:00:00.000Z'), sourceDecisionAt: null, completedAt: null,
  parentExpiresAt: new Date('2026-12-01'), sourceAutoApprovalAt: new Date('2026-11-08T09:00:00.000Z'),
  rejectionReason: null, rejectedBy: null,
};

class FakeRepository implements TransferRequestRepositoryPort {
  request: TransferRequestRecord = { ...base };
  transitions = 0;

  async findById(id: string): Promise<TransferRequestRecord | null> {
    return this.request.id === id ? this.request : null;
  }
  async findActiveByIdentityByNationalId(): Promise<TransferRequestRecord | null> { return null; }
  async createPendingGuardian(): Promise<TransferRequestRecord> { throw new Error('non utilisé'); }
  async listSentByTarget(): Promise<TargetSentBrief[]> { return []; }
  async listReceivedBySource(): Promise<SourceReceivedBrief[]> { return []; }
  async listCompletedForTargetSchool(): Promise<CompletedTransferBrief[]> { return []; }
  async transitionIfCurrent(command: { id: string; expectedStatus: TransferRequestRecord['status']; nextStatus: TransferRequestRecord['status']; patch?: Partial<TransferRequestRecord> }): Promise<TransferRequestRecord | null> {
    if (this.request.id !== command.id || this.request.status !== command.expectedStatus) return null;
    this.transitions += 1;
    this.request = { ...this.request, ...command.patch, status: command.nextStatus };
    return this.request;
  }
  async completeWithSnapshot(): Promise<TransferRequestRecord | null> { throw new Error('non utilisé'); }
}

class FakeAudit implements TransferAuditPort {
  events: Array<{ eventType: string; stateAfter?: string }> = [];
  async append(event: TransferAuditEventInput): Promise<void> {
    this.events.push({ eventType: event.eventType, stateAfter: event.stateAfter });
  }
  async logDossierAccess(): Promise<void> {}
}

describe('idempotence et replay des jobs transfert (Phase 6)', () => {
  it('l’auto-approbation rejouée ne re-approb pas : 1 audit, 1 transition, APPROVED final', async () => {
    const repository = new FakeRepository();
    const audit = new FakeAudit();
    const autoApprouver = new AutoApprouverDemandeTransfertUseCase(repository, audit);
    const maintenant = new Date('2026-11-08T09:15:00.000Z');

    expect(await autoApprouver.execute('request-job', maintenant)).toBe(true);
    expect(await autoApprouver.execute('request-job', maintenant)).toBe(false);
    expect(await autoApprouver.execute('request-job', new Date('2026-11-09T00:00:00.000Z'))).toBe(false);

    expect(repository.request.status).toBe('APPROVED');
    expect(repository.transitions).toBe(1);
    expect(audit.events).toEqual([{ eventType: 'SOURCE_AUTO_APPROVED', stateAfter: 'APPROVED' }]);
  });

  it('l’expiration rejouée reste sans effet après le premier EXPIRED', async () => {
    const repository = new FakeRepository();
    repository.request = { ...base, status: 'PENDING_GUARDIAN', parentExpiresAt: new Date('2026-11-01T00:00:00.000Z') };
    const audit = new FakeAudit();
    const expirer = new ExpirerDemandeTransfertUseCase(repository, audit);

    expect(await expirer.execute('request-job', new Date('2026-11-02'))).toBe(true);
    expect(await expirer.execute('request-job', new Date('2026-11-02'))).toBe(false);

    expect(repository.request.status).toBe('EXPIRED');
    expect(repository.transitions).toBe(1);
    expect(audit.events).toHaveLength(1);
  });

  it('la purge des instantanés expires transmet « maintenant » au port (deleteAfter respecté)', async () => {
    const maintenant = new Date('2026-11-09T02:00:00.000Z');
    let recuPour: Date | null = null;
    const builder: TransferSnapshotBuilderPort = {
      async buildApprovedSnapshot(): Promise<TransferSnapshotBuildResult> { throw new Error('non utilisé'); },
      async readForTargetSchool(): Promise<TransferSnapshotBuildResult> { throw new Error('non utilisé'); },
      async deleteExpired(now: Date): Promise<number> { recuPour = new Date(now.getTime()); return 3; },
    };

    const supprime = await new SupprimerInstantanesExpiresUseCase(builder).execute(maintenant);

    expect(supprime).toBe(3);
    expect(recuPour?.getTime()).toBe(maintenant.getTime());
  });
});

describe('choix du jour de relance J+3 / J+10 (Phase 6)', () => {
  const table: Array<[number, boolean, boolean, 3 | 10 | null, string]> = [
    [0, false, false, null, 'avant J+3 : aucune relance'],
    [2, false, false, null, 'J+2 inclus : aucune relance'],
    [3, false, false, 3, 'J+3 exact : relance 3'],
    [3, true, false, null, 'J+3 déjà fait : dédoublonné'],
    [7, false, false, 3, 'J+7 avec cron manqué : relance 3 rattrapée'],
    [7, true, false, null, 'J+7 avec la 3 déjà faite : rien'],
    [10, false, false, 10, 'J+10 exact : relance 10'],
    [10, true, false, 10, 'J+10 : la 10 prime même si la 3 est faite'],
    [12, true, false, 10, 'J+12 après cron manqué : relance 10'],
    [12, true, true, null, 'les deux déjà faites : plus rien'],
    [15, false, false, 10, 'J+15 : seule la 10 partira'],
    [15, false, true, null, 'la 10 déjà faite : plus rien'],
  ];

  it('reflète la déduplication par événement d’audit, aussi tolérante aux crons manqués', () => {
    for (const [jours, fait3, fait10, attendu, raison] of table) {
      expect(choisirJourRelance(jours, fait3, fait10)).toBe(attendu);
      void raison;
    }
  });
});
