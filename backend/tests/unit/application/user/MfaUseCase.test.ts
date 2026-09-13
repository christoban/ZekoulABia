import { describe, it, expect } from 'bun:test';
import { MfaUseCase } from '../../../../src/application/user/MfaUseCase.ts';
import type { UserRepository, AuthUserData } from '@domain/ports/repositories/UserRepository';
import type { MfaService } from '@domain/ports/services/MfaService';

function authUser(overrides: Partial<AuthUserData> = {}): AuthUserData {
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

function makeRepo(user: AuthUserData | null) {
  const store: { user: AuthUserData | null } = { user: user ? { ...user } : null };
  const repo = {
    findAuthDataById: async () => (store.user ? { ...store.user } : null),
    saveLoginEmailOtp: async () => {},
    incrementLoginEmailOtpAttempts: async () => {},
    clearLoginEmailOtp: async () => {},
    updateMfaRecoveryCodeHashes: async (_id: string, hashes: string[]) => {
      if (store.user) store.user.mfaRecoveryCodeHashes = hashes;
    },
    updateMfaTempSecret: async (_id: string, secret: string | null) => {
      if (store.user) store.user.mfaTempSecret = secret;
    },
    updateMfa: async (params: { userId: string; mfaEnabled?: boolean; mfaSecret?: string | null; mfaTempSecret?: string | null; mfaRecoveryCodeHashes?: string[]; mfaRecoveryCodeGeneratedAt?: Date }) => {
      if (!store.user) return;
      if (params.mfaEnabled !== undefined) store.user.mfaEnabled = params.mfaEnabled;
      if (params.mfaSecret !== undefined) store.user.mfaSecret = params.mfaSecret;
      if (params.mfaTempSecret !== undefined) store.user.mfaTempSecret = params.mfaTempSecret;
      if (params.mfaRecoveryCodeHashes !== undefined) store.user.mfaRecoveryCodeHashes = params.mfaRecoveryCodeHashes;
    },
    isMfaEnabled: async () => store.user?.mfaEnabled ?? false,
    // stubs
    findById: async () => null as any,
    findByEmail: async () => null as any,
    findByPhone: async () => null as any,
    findByPhoneContient: async () => null as any,
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
    creerJetonReinitialisation: async () => {},
    trouverParJetonReinitialisation: async () => null,
    reinitialiserMotDePasse: async () => {},
    verifierMotDePasse: async () => false,
    mettreAJourMotDePasse: async () => {},
    definirMotDePasseInvitation: async () => {},
  } as unknown as UserRepository;
  return { repo, store };
}

function makeMfaService(): MfaService & { lastSecret?: string } {
  let call = 0;
  const svc: any = {
    genererSecret: () => {
      call += 1;
      svc.lastSecret = call === 1 ? 'SECRET_TEST' : `SECRET_TEST_${call}`;
      return svc.lastSecret;
    },
    genererURI: ({ issuer, label, secret }: { issuer: string; label: string; secret: string }) =>
      `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}`,
    genererQRCode: async (otpauthUrl: string) => `data:image/png;base64,QR-${otpauthUrl}`,
    genererCodesRecuperation: async () => ({ formatted: ['ABCD-1111', 'EFGH-2222'], hashed: ['hash1', 'hash2'] }),
    verifierTotp: (code: string, secret: string) => code === '123456' && secret === svc.lastSecret,
  };
  // fallback for first call where lastSecret not yet set if verifier called with explicit secret
  const origVerifier = svc.verifierTotp;
  svc.verifierTotp = (code: string, secret: string) => {
    if (secret === 'SECRET_TEST' || secret === svc.lastSecret || secret?.startsWith('SECRET_TEST')) {
      return code === '123456';
    }
    return origVerifier(code, secret);
  };
  return svc;
}

function makeMfaServiceFixed(): MfaService {
  return {
    genererSecret: () => 'SECRET_TEST',
    genererURI: ({ issuer, label, secret }) => `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}`,
    genererQRCode: async (url: string) => `data:image/png;base64,QR-${url}`,
    genererCodesRecuperation: async () => ({ formatted: ['ABCD-1111'], hashed: ['hash1'] }),
    verifierTotp: (code: string, secret: string) => code === '123456' && secret === 'SECRET_TEST',
  };
}

describe('MfaUseCase', () => {
  it('firstMfaSetup : refuse si MFA déjà activé', async () => {
    const { repo } = makeRepo(authUser({ mfaEnabled: true }));
    const uc = new MfaUseCase(repo, makeMfaServiceFixed());
    await expect(uc.firstMfaSetup('u1')).rejects.toThrow('MFA déjà activé');
  });

  it('firstMfaSetup : stocke temp secret et retourne qr + manualKey', async () => {
    const { repo, store } = makeRepo(authUser({ mfaEnabled: false }));
    const svc = makeMfaServiceFixed();
    const uc = new MfaUseCase(repo, svc);
    const res = await uc.firstMfaSetup('u1');
    expect(res.manualKey).toBe('SECRET_TEST');
    expect(res.qrDataUri).toContain('otpauth://');
    expect(store.user?.mfaTempSecret).toBe('SECRET_TEST');
  });

  it('firstMfaSetup : réutilise le mfaTempSecret s\'il existe déjà sans le réécraser', async () => {
    const { repo, store } = makeRepo(authUser({ mfaEnabled: false, mfaTempSecret: 'SECRET_EXISTANT' }));
    const svc = makeMfaServiceFixed();
    const uc = new MfaUseCase(repo, svc);
    const res = await uc.firstMfaSetup('u1');
    expect(res.manualKey).toBe('SECRET_EXISTANT');
    expect(store.user?.mfaTempSecret).toBe('SECRET_EXISTANT');
  });

  it('firstMfaSetup : refuse utilisateur introuvable', async () => {
    const { repo } = makeRepo(null);
    const uc = new MfaUseCase(repo, makeMfaServiceFixed());
    await expect(uc.firstMfaSetup('u1')).rejects.toThrow('Utilisateur introuvable');
  });

  it('firstMfaEnable : refuse si pas de temp secret', async () => {
    const { repo } = makeRepo(authUser({ mfaEnabled: false, mfaTempSecret: null }));
    const uc = new MfaUseCase(repo, makeMfaServiceFixed());
    await expect(uc.firstMfaEnable('u1', '123456')).rejects.toThrow('Aucune configuration MFA en cours');
  });

  it('firstMfaEnable : refuse si MFA déjà activé', async () => {
    const { repo } = makeRepo(authUser({ mfaEnabled: true, mfaTempSecret: 'SECRET_TEST' }));
    const uc = new MfaUseCase(repo, makeMfaServiceFixed());
    await expect(uc.firstMfaEnable('u1', '123456')).rejects.toThrow('MFA déjà activé');
  });

  it('firstMfaEnable : refuse code invalide', async () => {
    const { repo } = makeRepo(authUser({ mfaEnabled: false, mfaTempSecret: 'SECRET_TEST' }));
    const uc = new MfaUseCase(repo, makeMfaServiceFixed());
    await expect(uc.firstMfaEnable('u1', '000000')).rejects.toThrow('Code TOTP invalide');
  });

  it('firstMfaEnable : active MFA + retourne recovery codes', async () => {
    const { repo, store } = makeRepo(authUser({ mfaEnabled: false, mfaTempSecret: 'SECRET_TEST' }));
    const uc = new MfaUseCase(repo, makeMfaServiceFixed());
    const res = await uc.firstMfaEnable('u1', '123456');
    expect(res.recoveryCodes).toEqual(['ABCD-1111']);
    expect(store.user?.mfaEnabled).toBe(true);
    expect(store.user?.mfaSecret).toBe('SECRET_TEST');
    expect(store.user?.mfaTempSecret).toBeNull();
    expect(store.user?.mfaRecoveryCodeHashes).toEqual(['hash1']);
  });

  it('mfaStatus : retourne mfaEnabled', async () => {
    const { repo } = makeRepo(authUser({ mfaEnabled: true }));
    const uc = new MfaUseCase(repo, makeMfaServiceFixed());
    await expect(uc.mfaStatus('u1')).resolves.toEqual({ mfaEnabled: true });
    const { repo: repo2 } = makeRepo(authUser({ mfaEnabled: false }));
    const uc2 = new MfaUseCase(repo2, makeMfaServiceFixed());
    await expect(uc2.mfaStatus('u1')).resolves.toEqual({ mfaEnabled: false });
  });

  it('mfaReconfigureStart : refuse si MFA non actif', async () => {
    const { repo } = makeRepo(authUser({ mfaEnabled: false }));
    const uc = new MfaUseCase(repo, makeMfaServiceFixed());
    await expect(uc.mfaReconfigureStart('u1')).rejects.toThrow('Configurez d\'abord');
  });

  it('mfaReconfigureStart : génère nouveau temp secret et retourne qr', async () => {
    const { repo, store } = makeRepo(authUser({ mfaEnabled: true, mfaSecret: 'OLD' } as any));
    const svc = makeMfaServiceFixed();
    const uc = new MfaUseCase(repo, svc);
    const res = await uc.mfaReconfigureStart('u1');
    expect(res.manualKey).toBe('SECRET_TEST');
    expect(res.qrDataUri).toContain('SECRET_TEST');
    expect(store.user?.mfaTempSecret).toBe('SECRET_TEST');
  });

  it('mfaReconfigureConfirm : refuse sans temp secret', async () => {
    const { repo } = makeRepo(authUser({ mfaEnabled: true, mfaTempSecret: null }));
    const uc = new MfaUseCase(repo, makeMfaServiceFixed());
    await expect(uc.mfaReconfigureConfirm('u1', '123456')).rejects.toThrow('Aucune reconfiguration en cours');
  });

  it('mfaReconfigureConfirm : refuse code invalide', async () => {
    const { repo } = makeRepo(authUser({ mfaEnabled: true, mfaTempSecret: 'SECRET_TEST' }));
    const uc = new MfaUseCase(repo, makeMfaServiceFixed());
    await expect(uc.mfaReconfigureConfirm('u1', '000000')).rejects.toThrow('Code TOTP invalide');
  });

  it('mfaReconfigureConfirm : met à jour secret + nouveaux codes', async () => {
    const { repo, store } = makeRepo(authUser({ mfaEnabled: true, mfaSecret: 'OLD', mfaTempSecret: 'SECRET_TEST' }));
    const uc = new MfaUseCase(repo, makeMfaServiceFixed());
    const res = await uc.mfaReconfigureConfirm('u1', '123456');
    expect(res.recoveryCodes).toEqual(['ABCD-1111']);
    expect(store.user?.mfaSecret).toBe('SECRET_TEST');
    expect(store.user?.mfaTempSecret).toBeNull();
  });

  it('mfaRegenCodes : refuse si MFA non actif', async () => {
    const { repo } = makeRepo(authUser({ mfaEnabled: false }));
    const uc = new MfaUseCase(repo, makeMfaServiceFixed());
    await expect(uc.mfaRegenCodes('u1')).rejects.toThrow('MFA non actif');
  });

  it('mfaRegenCodes : génère de nouveaux codes', async () => {
    const { repo, store } = makeRepo(authUser({ mfaEnabled: true, mfaRecoveryCodeHashes: ['old'] }));
    const svc: MfaService = {
      genererSecret: () => 'X',
      genererURI: () => '',
      genererQRCode: async () => '',
      genererCodesRecuperation: async () => ({ formatted: ['NEW-CODE'], hashed: ['newHash'] }),
      verifierTotp: () => false,
    };
    const uc = new MfaUseCase(repo, svc);
    const res = await uc.mfaRegenCodes('u1');
    expect(res.recoveryCodes).toEqual(['NEW-CODE']);
    expect(store.user?.mfaRecoveryCodeHashes).toEqual(['newHash']);
  });
});
