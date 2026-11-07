import { chiffrerBuffer, dechiffrerBuffer } from './BackupEncryption';
import type { TransferSnapshotEncryptionPort } from '@domain/ports/services/TransferSnapshotEncryptionPort';

export class TransferSnapshotEncryptionAdapter implements TransferSnapshotEncryptionPort {
  async encrypt(payload: string): Promise<string> {
    return chiffrerBuffer(Buffer.from(payload, 'utf8')).toString('base64');
  }

  async decrypt(payloadEncrypted: string): Promise<string> {
    return dechiffrerBuffer(Buffer.from(payloadEncrypted, 'base64')).toString('utf8');
  }
}
