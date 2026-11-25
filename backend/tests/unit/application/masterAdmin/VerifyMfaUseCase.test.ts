import { describe, it, expect } from 'bun:test';
import { VerifyMfaUseCase } from '../../../../src/application/masterAdmin/VerifyMfaUseCase.ts';
import { generateSecret, generateSync } from 'otplib';
import bcrypt from 'bcryptjs';
import type { MasterUserAuthRepository, MasterUserAuthData } from '@domain/ports/repositories/MasterUserAuthRepository';

function authRepoMock(masterUser: MasterUserAuthData | null): MasterUserAuthRepository {
  const store: { masterUser: MasterUserAuthData | null } = { masterUser };
  return {
    findByEmail: async () => store.masterUser,
    findById: async () => store.masterUser,
    getMfaStatus: async () => ({ mfaEnabled: store.masterUser?.mfaEnabled ?? false }),
    updateLoginOtp: async () => {},
    incrementLoginOtpAttempts: async () => {},
    clearLoginOtp: async () => {},
    updatePasswordChangeOtp: async () => {},
    incrementPasswordChangeOtpAttempts: async () => {},
    applyPasswordChange: async () => {},
    updateMfaRecoveryCodes: async (_id, hashes) => {
      if (store.masterUser) store.masterUser.mfaRecoveryCodeHashes = hashes;
    },
    setMfaTempSecret: async (_id, secret) => {
      if (store.masterUser) store.masterUser.mfaTempSecret = secret;
    },
    activateMfa: async (_id, data) => {
      if (store.masterUser) {
        store.masterUser.mfaEnabled = true;
        store.masterUser.mfaSecret = data.mfaSecret;
        store.masterUser.mfaTempSecret = null;
        store.masterUser.mfaRecoveryCodeHashes = data.recoveryCodeHashes;
      }
    },
    deactivateMfa: async () => {
      if (store.masterUser) {
        store.masterUser.mfaEnabled = false;
        store.masterUser.mfaSecret = null;
        store.masterUser.mfaTempSecret = null;
        store.masterUser.mfaRecoveryCodeHashes = [];
      }
    },
  };
}

function masterUser(overrides: Partial<MasterUserAuthData>): MasterUserAuthData {
  return {
    id: 'm1',
    email: 'master@zekoulabia.cm',
    name: 'Master',
    role: 'SUPPORT',
    isActive: true,
    isSuperAdmin: false,
    passwordHash: 'hash',
    mfaEnabled: false,
    mfaSecret: null,
    mfaTempSecret: null,
    mfaRecoveryCodeHashes: [],
    loginEmailOtpHash: null,
    loginEmailOtpExpiresAt: null,
    loginEmailOtpAttempts: 0,
    loginEmailOtpSentAt: null,
    passwordChangeEmailOtpHash: null,
    passwordChangeEmailOtpExpiresAt: null,
    passwordChangeEmailOtpAttempts: 0,
    passwordChangeEmailOtpSentAt: null,
    ...overrides,
  };
}

describe('VerifyMfaUseCase (V0.3)', () => {
  const secret = generateSecret();

  it('getMfaStatus retourne false si non configuré', async () => {
    const useCase = new VerifyMfaUseCase(authRepoMock(masterUser({ mfaEnabled: false })));
    expect(await useCase.getMfaStatus('m1')).toEqual({ mfaEnabled: false });
  });

  it('getMfaStatus retourne true si activé', async () => {
    const useCase = new VerifyMfaUseCase(authRepoMock(masterUser({ mfaEnabled: true, mfaSecret: secret })));
    expect(await useCase.getMfaStatus('m1')).toEqual({ mfaEnabled: true });
  });

  it('valide un TOTP correct et retourne les infos', async () => {
    const useCase = new VerifyMfaUseCase(authRepoMock(masterUser({ mfaEnabled: true, mfaSecret: secret })));
    const token = generateSync({ secret });
    const result = await useCase.execute('m1', token);
    expect(result.email).toBe('master@zekoulabia.cm');
  });

  it('rejette si MFA non configuré', async () => {
    const useCase = new VerifyMfaUseCase(authRepoMock(masterUser({ mfaEnabled: false })));
    await expect(useCase.execute('m1', '123456')).rejects.toThrow('MFA non configuré');
  });

  it('rejette un code invalide', async () => {
    const useCase = new VerifyMfaUseCase(authRepoMock(masterUser({ mfaEnabled: true, mfaSecret: secret })));
    await expect(useCase.execute('m1', '000000')).rejects.toThrow('Code MFA invalide');
  });

  it('valide un code de récupération', async () => {
    const recovery = 'WXYZ-9999';
    const hash = await bcrypt.hash('WXYZ9999', 4);
    const useCase = new VerifyMfaUseCase(authRepoMock(masterUser({ mfaEnabled: true, mfaSecret: secret, mfaRecoveryCodeHashes: [hash] })));
    const result = await useCase.execute('m1', recovery);
    expect(result.email).toBe('master@zekoulabia.cm');
  });
});
