import type { TransferSnapshotBuilderPort } from '@domain/ports/services/TransferSnapshotBuilderPort';

export class SupprimerInstantanesExpiresUseCase {
  constructor(private readonly snapshotBuilder: TransferSnapshotBuilderPort) {}

  async execute(now = new Date()): Promise<number> {
    return this.snapshotBuilder.deleteExpired(now);
  }
}
