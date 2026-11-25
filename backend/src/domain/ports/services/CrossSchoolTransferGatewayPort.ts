export type TransferRequestStatus =
  | 'PENDING_GUARDIAN'
  | 'PENDING_SOURCE'
  | 'APPROVED'
  | 'REFUSED_BY_GUARDIAN'
  | 'REFUSED_BY_SOURCE'
  | 'EXPIRED'
  | 'REVOKED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface TransferIdentityLookupResult {
  exists: boolean;
}

export interface CrossSchoolTransferGatewayPort {
  identityExists(nationalId: string, targetSchoolId: string): Promise<TransferIdentityLookupResult>;
}

export const TRANSFER_REQUEST_FINAL_STATUSES: readonly TransferRequestStatus[] = [
  'REFUSED_BY_GUARDIAN',
  'REFUSED_BY_SOURCE',
  'EXPIRED',
  'REVOKED',
  'COMPLETED',
  'CANCELLED',
] as const;
