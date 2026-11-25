import { describe, it, expect } from 'bun:test';
import { LoginMasterUseCase } from '../../../../src/application/masterAdmin/LoginMasterUseCase.ts';
import bcrypt from 'bcryptjs';
import type { MasterUserAuthRepository, MasterUserAuthData } from '@domain/ports/repositories/MasterUserAuthRepository';

function makeStore(overrides: Partial<MasterUserAuthData> = {}): MasterUserAuthData {
  return {
    id: 'm1',
    email: 'master@zekoulabia.cm',
    name: 'Master',
    role: 'SUPPORT',
    isActive: true,
    isSuperAdmin: false,
    passwordHash: 'hash-initial',
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

function authRepoMock(store: MasterUserAuthData): MasterUserAuthRepository {
  return {
    findByEmail: async (email) => (store.email === email ? store : null),
    findById: async (id) => (store.id === id ? store : null),
    getMfaStatus: async () => ({ mfaEnabled: store.mfaEnabled }),
    updateLoginOtp: async () => {},
    incrementLoginOtpAttempts: async () => {},
    clearLoginOtp: async () => {},
    updatePasswordChangeOtp: async (_id, data) => {
      store.passwordChangeEmailOtpHash = data.passwordChangeEmailOtpHash;
      store.passwordChangeEmailOtpExpiresAt = data.passwordChangeEmailOtpExpiresAt;
      store.passwordChangeEmailOtpAttempts = data.passwordChangeEmailOtpAttempts;
      store.passwordChangeEmailOtpSentAt = data.passwordChangeEmailOtpSentAt;
    },
    incrementPasswordChangeOtpAttempts: async () => {
      store.passwordChangeEmailOtpAttempts += 1;
    },
    applyPasswordChange: async (_id, passwordHash) => {
      store.passwordHash = passwordHash;
      store.passwordChangeEmailOtpHash = null;
      store.passwordChangeEmailOtpExpiresAt = null;
      store.passwordChangeEmailOtpAttempts = 0;
      store.passwordChangeEmailOtpSentAt = null;
    },
    updateMfaRecoveryCodes: async () => {},
    setMfaTempSecret: async (_id, secret) => { store.mfaTempSecret = secret; },
    activateMfa: async (_id, data) => {
      store.mfaEnabled = true;
      store.mfaSecret = data.mfaSecret;
      store.mfaTempSecret = null;
      store.mfaRecoveryCodeHashes = data.recoveryCodeHashes;
    },
    deactivateMfa: async () => {
      store.mfaEnabled = false;
      store.mfaSecret = null;
      store.mfaTempSecret = null;
      store.mfaRecoveryCodeHashes = [];
    },
  };
}

function makeUseCase(store: MasterUserAuthData) {
  const sent: string[] = [];
  const useCase = new LoginMasterUseCase(authRepoMock(store), async ({ otp }) => { sent.push(otp); });
  return { useCase, sent };
}

describe('LoginMasterUseCase — forgot password (récupération Master)', () => {
  it('envoie un OTP et permet de réinitialiser avec le bon code', async () => {
    const store = makeStore();
    const { useCase, sent } = makeUseCase(store);

    await useCase.executeForgotPasswordOtp(store.email);
    expect(sent.length).toBe(1);

    const newPassword = 'NouveauMotDePasseS3curisé!';
    await useCase.executeResetForgottenPassword(store.email, newPassword, sent[0]);

    const hashOk = await bcrypt.compare(newPassword, store.passwordHash);
    expect(hashOk).toBe(true);
    expect(store.passwordChangeEmailOtpHash).toBeNull();
  });

  it('rejette un code OTP incorrect et incrémente les tentatives', async () => {
    const store = makeStore();
    const { useCase, sent } = makeUseCase(store);

    await useCase.executeForgotPasswordOtp(store.email);

    await expect(
      useCase.executeResetForgottenPassword(store.email, 'NouveauMotDePasseS3curisé!', '000000'),
    ).rejects.toThrow('Code de vérification incorrect');
    expect(store.passwordChangeEmailOtpAttempts).toBe(1);
  });

  it('rejette un code expiré', async () => {
    const store = makeStore();
    const { useCase, sent } = makeUseCase(store);

    await useCase.executeForgotPasswordOtp(store.email);
    store.passwordChangeEmailOtpExpiresAt = new Date(Date.now() - 1000);

    await expect(
      useCase.executeResetForgottenPassword(store.email, 'NouveauMotDePasseS3curisé!', sent[0]),
    ).rejects.toThrow('Le code de vérification a expiré');
  });

  it('rejette un mot de passe de moins de 12 caractères', async () => {
    const store = makeStore();
    const { useCase, sent } = makeUseCase(store);

    await useCase.executeForgotPasswordOtp(store.email);

    await expect(
      useCase.executeResetForgottenPassword(store.email, 'court', sent[0]),
    ).rejects.toThrow('au moins 12 caractères');
  });

  it('rejette un email inconnu ou un compte inactif', async () => {
    const store = makeStore();
    const { useCase } = makeUseCase(store);

    await expect(useCase.executeForgotPasswordOtp('inconnu@example.com')).rejects.toThrow('Email introuvable');

    store.isActive = false;
    await expect(useCase.executeForgotPasswordOtp(store.email)).rejects.toThrow('Email introuvable');
  });
});
