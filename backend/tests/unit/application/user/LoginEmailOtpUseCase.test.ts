import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { LoginEmailOtpUseCase } from '../../../../src/application/user/LoginEmailOtpUseCase.ts';
import bcrypt from 'bcryptjs';
import type { UserRepository, AuthUserData } from '@domain/ports/repositories/UserRepository';

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
  const store: { user: AuthUserData | null; saved?: { hash: string; expiresAt: Date } } = { user };
  let attempts = user?.loginEmailOtpAttempts ?? 0;
  const repo: Partial<UserRepository> = {
    findAuthDataById: async () => {
      if (!store.user) return null;
      // reflect increments/clears
      return { ...store.user, loginEmailOtpAttempts: attempts } as AuthUserData;
    },
    saveLoginEmailOtp: async (_id: string, data: { hash: string; expiresAt: Date }) => {
      store.saved = data;
      if (store.user) {
        store.user = { ...store.user, loginEmailOtpHash: data.hash, loginEmailOtpExpiresAt: data.expiresAt, loginEmailOtpAttempts: 0 } as AuthUserData;
        attempts = 0;
      }
    },
    incrementLoginEmailOtpAttempts: async () => {
      attempts += 1;
      if (store.user) store.user = { ...store.user, loginEmailOtpAttempts: attempts } as any;
    },
    clearLoginEmailOtp: async () => {
      attempts = 0;
      if (store.user) store.user = { ...store.user, loginEmailOtpHash: null, loginEmailOtpExpiresAt: null, loginEmailOtpAttempts: 0 } as any;
    },
    // stubs for UserRepository
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
    updateMfaRecoveryCodeHashes: async () => {},
    updateMfaTempSecret: async () => {},
    updateMfa: async () => {},
    isMfaEnabled: async () => false,
    creerJetonReinitialisation: async () => {},
    trouverParJetonReinitialisation: async () => null,
    reinitialiserMotDePasse: async () => {},
    verifierMotDePasse: async () => false,
    mettreAJourMotDePasse: async () => {},
    definirMotDePasseInvitation: async () => {},
  };
  return { repo: repo as UserRepository, store, getAttempts: () => attempts };
}

describe('LoginEmailOtpUseCase', () => {
  it('envoyer : génère OTP hashé, expiration ~10 min, appelle sendEmail', async () => {
    const { repo, store } = makeRepo(authUser());
    const sent: any[] = [];
    const sendEmail = mock(async (p: { recipientEmail: string; otp: string }) => {
      sent.push(p);
    });
    const uc = new LoginEmailOtpUseCase(repo, sendEmail as any);

    await uc.envoyer('u1');
    // allow fire-and-forget sendEmail to flush (void .catch path does not await, but mock was awaited via void?)
    // Our mock is called via void …catch, so need short delay
    await new Promise((r) => setTimeout(r, 10));

    expect(store.saved).toBeDefined();
    expect(store.saved!.hash).toBeTruthy();
    expect(sent.length).toBe(1);
    expect(sent[0].recipientEmail).toBe('u1@school.cm');
    expect(sent[0].otp).toMatch(/^\d{6}$/);
    // hash matches otp
    expect(await bcrypt.compare(sent[0].otp, store.saved!.hash)).toBe(true);
    // ~10 min
    const delta = store.saved!.expiresAt.getTime() - Date.now();
    expect(delta).toBeGreaterThan(9 * 60 * 1000);
    expect(delta).toBeLessThan(11 * 60 * 1000);
  });

  it('envoyer : refuse compte inactif', async () => {
    const { repo } = makeRepo(authUser({ isActive: false }));
    const uc = new LoginEmailOtpUseCase(repo, async () => {});
    await expect(uc.envoyer('u1')).rejects.toThrow('Compte introuvable');
  });

  it('envoyer : refuse sans email', async () => {
    const { repo } = makeRepo(authUser({ email: null }));
    const uc = new LoginEmailOtpUseCase(repo, async () => {});
    await expect(uc.envoyer('u1')).rejects.toThrow('Compte introuvable');
  });

  it('envoyer : refuse si utilisateur introuvable', async () => {
    const { repo } = makeRepo(null);
    const uc = new LoginEmailOtpUseCase(repo, async () => {});
    await expect(uc.envoyer('u1')).rejects.toThrow('Compte introuvable');
  });

  it('envoyer : refuse compte dont accessMode est SMS_ONLY', async () => {
    const { repo } = makeRepo(authUser({ accessMode: 'SMS_ONLY' }));
    const uc = new LoginEmailOtpUseCase(repo, async () => {});
    await expect(uc.envoyer('u1')).rejects.toThrow("Ce compte ne dispose pas d'un accès de connexion direct.");
  });

  it('verifier : refuse compte dont accessMode est SMS_ONLY', async () => {
    const otp = '123456';
    const hash = await bcrypt.hash(otp, 4);
    const user = authUser({
      accessMode: 'SMS_ONLY',
      loginEmailOtpHash: hash,
      loginEmailOtpExpiresAt: new Date(Date.now() + 60000),
      loginEmailOtpAttempts: 0,
    });
    const { repo } = makeRepo(user);
    const uc = new LoginEmailOtpUseCase(repo, async () => {});
    await expect(uc.verifier('u1', otp)).rejects.toThrow("Ce compte ne dispose pas d'un accès de connexion direct.");
  });

  it('verifier : accepte OTP correct et clear', async () => {
    const otp = '123456';
    const hash = await bcrypt.hash(otp, 4);
    const user = authUser({ loginEmailOtpHash: hash, loginEmailOtpExpiresAt: new Date(Date.now() + 60000), loginEmailOtpAttempts: 0 });
    const { repo } = makeRepo(user);
    const uc = new LoginEmailOtpUseCase(repo, async () => {});
    await expect(uc.verifier('u1', otp)).resolves.toBeUndefined();
    // après clear, verifier à nouveau doit échouer "Aucun code demandé"
    await expect(uc.verifier('u1', otp)).rejects.toThrow('Aucun code');
  });

  it('verifier : refuse OTP expiré', async () => {
    const hash = await bcrypt.hash('123456', 4);
    const user = authUser({ loginEmailOtpHash: hash, loginEmailOtpExpiresAt: new Date(Date.now() - 1000) });
    const { repo } = makeRepo(user);
    const uc = new LoginEmailOtpUseCase(repo, async () => {});
    await expect(uc.verifier('u1', '123456')).rejects.toThrow('expiré');
  });

  it('verifier : refuse après 5 tentatives', async () => {
    const hash = await bcrypt.hash('123456', 4);
    const user = authUser({ loginEmailOtpHash: hash, loginEmailOtpExpiresAt: new Date(Date.now() + 60000), loginEmailOtpAttempts: 5 });
    const { repo } = makeRepo(user);
    const uc = new LoginEmailOtpUseCase(repo, async () => {});
    await expect(uc.verifier('u1', '123456')).rejects.toThrow('Trop de tentatives');
  });

  it('verifier : incrémente tentatives sur mauvais code', async () => {
    const hash = await bcrypt.hash('123456', 4);
    const user = authUser({ loginEmailOtpHash: hash, loginEmailOtpExpiresAt: new Date(Date.now() + 60000), loginEmailOtpAttempts: 1 });
    const { repo, getAttempts } = makeRepo(user);
    const uc = new LoginEmailOtpUseCase(repo, async () => {});
    await expect(uc.verifier('u1', '999999')).rejects.toThrow('incorrect');
    expect(getAttempts()).toBe(2);
  });

  it('verifier : refuse si aucun code demandé', async () => {
    const { repo } = makeRepo(authUser({ loginEmailOtpHash: null, loginEmailOtpExpiresAt: null }));
    const uc = new LoginEmailOtpUseCase(repo, async () => {});
    await expect(uc.verifier('u1', '123456')).rejects.toThrow('Aucun code');
  });

  it('verifier : refuse utilisateur introuvable', async () => {
    const { repo } = makeRepo(null);
    const uc = new LoginEmailOtpUseCase(repo, async () => {});
    await expect(uc.verifier('u1', '123456')).rejects.toThrow('Code de vérification invalide');
  });
});
