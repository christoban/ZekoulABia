import { afterAll, describe, expect, it } from 'bun:test';
import { TransferSnapshotEncryptionAdapter } from '../../../../src/infrastructure/backup/TransferSnapshotEncryptionAdapter.ts';

const originalKey = process.env.BACKUP_ENCRYPTION_KEY;
process.env.BACKUP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

describe('chiffrement du snapshot de transfert', () => {
  it('chiffre puis déchiffre le payload avec AES-GCM', async () => {
    const adapter = new TransferSnapshotEncryptionAdapter();
    const clair = JSON.stringify({ identity: { nationalId: 'CMFIXTURE001' } });

    const chiffre = await adapter.encrypt(clair);
    const dechiffre = await adapter.decrypt(chiffre);

    expect(chiffre).not.toContain('CMFIXTURE001');
    expect(dechiffre).toBe(clair);
  });
});

afterAll(() => {
  if (originalKey === undefined) {
    delete process.env.BACKUP_ENCRYPTION_KEY;
  } else {
    process.env.BACKUP_ENCRYPTION_KEY = originalKey;
  }
});
