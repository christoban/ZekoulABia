import { describe, it, expect } from 'bun:test';
import { VerifierMfaConnexionUseCase } from '../../../../src/application/user/VerifierMfaConnexionUseCase.ts';
import { generateSecret, generateSync } from 'otplib';
import bcrypt from 'bcryptjs';
import type { UserRepository, AuthUserData } from '@domain/ports/repositories/UserRepository';

function userRepoMock(user: AuthUserData | null): UserRepository {
  const store = { user };
  return {
    findById: async () => null,
    findByEmail: async () => null,
    findByPhone: async () => null,
    findByPhoneContient: async () => null,
    findBySchool: async () => [],
    findByRole: async () => [],
    findActiveByRoles: async () => [],
    findByClass: async () => [],
    existsByEmail: async () => false,
    save: async () => {},
    update: async () => {},
    delete: async () => {},
    findByIdWithRefreshVersion: async () => null,
    authentifier: async () => null,
    listerRolesAvecMotDePasse: async () => [],
    findMatchingAccountsByEmailPassword: async () => [],
    saveAvecProfil: async () => {},
    mettreAJourAvecProfil: async () => {},
    supprimerAvecCascade: async () => {},
    restaurer: async () => {},
    listerSupprimes: async () => [],
    trouverSupprime: async () => null,
    findByIds: async () => [],
    transfererEleve: async () => {},
    findEmailsParentsParEleve: async () => [],
    findEmployeeById: async () => null,
    findEmployees: async () => [],
    findStudentsForBulletinGeneration: async () => [],
    findStudentNotificationContext: async () => null,
    findAuthDataById: async () => store.user,
    saveLoginEmailOtp: async () => {},
    incrementLoginEmailOtpAttempts: async () => {},
    clearLoginEmailOtp: async () => {},
    updateMfaRecoveryCodeHashes: async (_id, hashes) => {
      if (store.user) store.user.mfaRecoveryCodeHashes = hashes;
    },
    updateMfaTempSecret: async () => {},
    updateMfa: async () => {},
    isMfaEnabled: async () => store.user?.mfaEnabled ?? false,
    creerJetonReinitialisation: async () => {},
    trouverParJetonReinitialisation: async () => null,
    reinitialiserMotDePasse: async () => {},
    verifierMotDePasse: async () => false,
    mettreAJourMotDePasse: async () => {},
    definirMotDePasseInvitation: async () => {},
  };
}

function authUser(overrides: Partial<AuthUserData>): AuthUserData {
  return {
    id: 'u1',
    email: 'u1@school.cm',
    isActive: true,
    loginEmailOtpHash: null,
    loginEmailOtpExpiresAt: null,
    loginEmailOtpAttempts: 0,
    mfaEnabled: false,
    mfaSecret: null,
    mfaTempSecret: null,
    mfaRecoveryCodeHashes: [],
    ...overrides,
  };
}

describe('VerifierMfaConnexionUseCase (V0.3)', () => {
  const secret = generateSecret();

  it('valide un TOTP correct', async () => {
    const repo = userRepoMock(authUser({ mfaEnabled: true, mfaSecret: secret }));
    const useCase = new VerifierMfaConnexionUseCase(repo);
    const token = generateSync({ secret });
    await expect(useCase.execute('u1', token)).resolves.toBeUndefined();
  });

  it('rejette si MFA non configuré (mfaEnabled false)', async () => {
    const repo = userRepoMock(authUser({ mfaEnabled: false, mfaSecret: secret }));
    const useCase = new VerifierMfaConnexionUseCase(repo);
    await expect(useCase.execute('u1', '123456')).rejects.toThrow('MFA non configuré');
  });

  it('rejette si utilisateur introuvable', async () => {
    const repo = userRepoMock(null);
    const useCase = new VerifierMfaConnexionUseCase(repo);
    await expect(useCase.execute('u1', '123456')).rejects.toThrow('MFA non configuré');
  });

  it('rejette un code invalide (ni TOTP ni recovery)', async () => {
    const repo = userRepoMock(authUser({ mfaEnabled: true, mfaSecret: secret }));
    const useCase = new VerifierMfaConnexionUseCase(repo);
    await expect(useCase.execute('u1', '000000')).rejects.toThrow('Code MFA invalide');
  });

  it('valide un code de récupération et le consomme', async () => {
    const recovery = 'ABCD-1234';
    const hash = await bcrypt.hash(recovery.toUpperCase().replace(/[^A-Z0-9]/g, ''), 4);
    const user = authUser({ mfaEnabled: true, mfaSecret: secret, mfaRecoveryCodeHashes: [hash] });
    const repo = userRepoMock(user);
    const useCase = new VerifierMfaConnexionUseCase(repo);
    await useCase.execute('u1', recovery);
    // Le code est consommé (tableau vidé)
    expect(user.mfaRecoveryCodeHashes).toHaveLength(0);
  });

  it('normalise le code de récupération (trim, uppercase, tirets)', async () => {
    const recovery = 'abcd-1234';
    const hash = await bcrypt.hash('ABCD1234', 4);
    const repo = userRepoMock(authUser({ mfaEnabled: true, mfaSecret: secret, mfaRecoveryCodeHashes: [hash] }));
    const useCase = new VerifierMfaConnexionUseCase(repo);
    await expect(useCase.execute('u1', '  abcd-1234  ')).resolves.toBeUndefined();
  });
});
