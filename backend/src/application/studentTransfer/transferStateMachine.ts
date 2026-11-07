import { TRANSFER_REQUEST_FINAL_STATUSES } from '@domain/ports/services/CrossSchoolTransferGatewayPort';
import type { TransferRequestStatus } from '@domain/ports/services/CrossSchoolTransferGatewayPort';

export type { TransferRequestStatus };

export type TransferRequestEvent =
  | 'GUARDIAN_ACCEPT'
  | 'GUARDIAN_REFUSE'
  | 'PARENT_EXPIRE'
  | 'PARENT_REVOKE'
  | 'SOURCE_ACCEPT'
  | 'SOURCE_AUTO_APPROVE'
  | 'SOURCE_REFUSE'
  | 'SNAPSHOT_GENERATED'
  | 'TARGET_CANCEL';

export const FINAL_STATUSES: ReadonlySet<TransferRequestStatus> = new Set(TRANSFER_REQUEST_FINAL_STATUSES);

const TRANSITIONS: ReadonlyMap<string, TransferRequestStatus> = new Map([
  ['PENDING_GUARDIAN:GUARDIAN_ACCEPT', 'PENDING_SOURCE'],
  ['PENDING_GUARDIAN:GUARDIAN_REFUSE', 'REFUSED_BY_GUARDIAN'],
  ['PENDING_GUARDIAN:PARENT_EXPIRE', 'EXPIRED'],
  ['PENDING_GUARDIAN:PARENT_REVOKE', 'REVOKED'],
  ['PENDING_SOURCE:SOURCE_ACCEPT', 'APPROVED'],
  ['PENDING_SOURCE:SOURCE_AUTO_APPROVE', 'APPROVED'],
  ['PENDING_SOURCE:SOURCE_REFUSE', 'REFUSED_BY_SOURCE'],
  ['PENDING_SOURCE:PARENT_REVOKE', 'REVOKED'],
  ['APPROVED:PARENT_REVOKE', 'REVOKED'],
  ['APPROVED:SNAPSHOT_GENERATED', 'COMPLETED'],
]);

export function transitionTransferRequest(
  status: TransferRequestStatus,
  event: TransferRequestEvent,
): TransferRequestStatus {
  if (FINAL_STATUSES.has(status)) {
    throw new Error(`Impossible de faire évoluer un état final (${status}).`);
  }
  if (event === 'TARGET_CANCEL') {
    return 'CANCELLED';
  }

  const nextStatus = TRANSITIONS.get(`${status}:${event}`);
  if (!nextStatus) {
    throw new Error(`Transition ${event} impossible depuis ${status}.`);
  }
  return nextStatus;
}
