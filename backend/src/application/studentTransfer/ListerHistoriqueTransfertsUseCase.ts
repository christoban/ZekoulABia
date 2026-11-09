import type { CompletedTransferBrief, TransferRequestRepositoryPort } from '@domain/ports/repositories/TransferRequestRepository';

/**
 * Liste les transferts COMPLETED dont l'école est la cible, pour le bloc
 * Censeur / Conseiller « Historique d'avant transfert » (Phase 5). Le dossier
 * détaillé reste servi par ConsulterDossierTransfertUseCase avec audit d'accès.
 */
export class ListerHistoriqueTransfertsUseCase {
  constructor(private readonly repository: TransferRequestRepositoryPort) {}

  execute(targetSchoolId: string): Promise<CompletedTransferBrief[]> {
    return this.repository.listCompletedForTargetSchool(targetSchoolId);
  }
}
