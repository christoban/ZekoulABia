import { createHash } from 'node:crypto';
import type { TransferRequestRepositoryPort } from '@domain/ports/repositories/TransferRequestRepository';
import type { TransferAuditPort } from '@domain/ports/services/TransferAuditPort';
import type {
  TransferSnapshotBuilderPort,
  TransferSnapshotBuildResult,
} from '@domain/ports/services/TransferSnapshotBuilderPort';
import type { TransferSnapshotEncryptionPort } from '@domain/ports/services/TransferSnapshotEncryptionPort';
import { TRANSFER_SNAPSHOT_CATEGORY_SET } from './snapshotContract';

export interface DossierTransfertLu {
  snapshotId: string;
  categories: string[];
  payload: Record<string, unknown>;
  generatedAt: string;
  deleteAfter: string;
}

export class ConsulterDossierTransfertUseCase {
  constructor(
    private readonly repository: TransferRequestRepositoryPort,
    private readonly snapshotBuilder: TransferSnapshotBuilderPort,
    private readonly encryption: TransferSnapshotEncryptionPort,
    private readonly audit: TransferAuditPort,
  ) {}

  async execute(input: {
    requestId: string;
    snapshotId: string;
    targetSchoolId: string;
    userId: string;
  }): Promise<DossierTransfertLu> {
    const request = await this.repository.findById(input.requestId);
    if (!request) throw new Error('Demande de transfert introuvable.');
    if (request.targetSchoolId !== input.targetSchoolId) {
      throw new Error('Le dossier n’appartient pas à cette école cible.');
    }
    if (request.status !== 'COMPLETED') {
      throw new Error('Le dossier est indisponible avant COMPLETED.');
    }

    const snapshot = await this.snapshotBuilder.readForTargetSchool({
      snapshotId: input.snapshotId,
      transferRequestId: request.id,
      targetSchoolId: input.targetSchoolId,
    });
    await this.audit.logDossierAccess({
      snapshotId: snapshot.snapshotId,
      transferRequestId: request.id,
      userId: input.userId,
      schoolId: input.targetSchoolId,
    });

    const clair = await this.encryption.decrypt(snapshot.payloadEncrypted);
    const payload: Record<string, unknown> = JSON.parse(clair) as Record<string, unknown>;
    const somme = createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex');
    const incoherent = somme !== snapshot.checksum
      || snapshot.categories.some(category => !TRANSFER_SNAPSHOT_CATEGORY_SET.has(category));
    if (incoherent) {
      throw new Error('Le dossier a été altéré : intégrité non vérifiée.');
    }

    return {
      snapshotId: snapshot.snapshotId,
      categories: snapshot.categories,
      payload,
      generatedAt: snapshot.generatedAt.toISOString(),
      deleteAfter: snapshot.deleteAfter.toISOString(),
    };
  }
}
