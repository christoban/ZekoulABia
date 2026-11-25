export interface TransferSnapshotEncryptionPort {
  encrypt(payload: string): Promise<string>;
  decrypt(payloadEncrypted: string): Promise<string>;
}
