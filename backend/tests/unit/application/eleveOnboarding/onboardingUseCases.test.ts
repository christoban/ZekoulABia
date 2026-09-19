/**
 * Tests unitaires — Use cases onboarding élèves (V1.1)
 *
 * Tests des 4 cas de portes de validation (rejeter, valider, soumettre, creer squelette).
 * Les gates sont testées via stubs localisés.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { CreerSqueletteOnboardingUseCase } from '@application/eleveOnboarding/CreerSqueletteOnboardingUseCase';
import { SoumettreFormulaireOnboardingUseCase } from '@application/eleveOnboarding/SoumettreFormulaireOnboardingUseCase';
import { ValiderOnboardingUseCase } from '@application/eleveOnboarding/ValiderOnboardingUseCase';
import { RejeterOnboardingUseCase } from '@application/eleveOnboarding/RejeterOnboardingUseCase';

const SCHOOL = 'school-1';
const activityLog = { log: async () => {} };

function stubRepo(overrides: Record<string, any> = {}) {
  return {
    findSettings: async () => overrides.settings ?? { schoolId: SCHOOL, selfServiceEnabled: true },
    upsertSettings: async () => ({}),
    findOnboardingById: async () => overrides.onboarding ?? null,
    findOnboardingByToken: async () => overrides.onboarding ?? null,
    findOnboardingByTokenWithClasse: async () => overrides.onboarding ?? null,
    listOnboardings: async () => [],
    findOnboardingForPdf: async () => null,
    findClassOnboardingInfo: async () => null,
    findProfilesParDateNaissance: async () => [],
    findGroupTransferRequestByOnboarding: async () => null,
    createSquelette: async (d: any) => ({ id: 'ob-1', ...d, status: 'LINK_SENT', createdAt: new Date(), updatedAt: new Date() }),
    marquerOnboardingExpire: async () => {},
    soumettreFormulaire: async () => ({}),
    validerOnboarding: async () => ({}),
    rejeterOnboarding: async () => ({}),
    resoudreProfilParent: async () => null,
    resoudreProfilEleve: async () => null,
    changerClasse: async () => {},
    affecterPP: async () => {},
    envoyerEmailActivation: async () => {},
    envoyerEmailLienInvitation: async () => {},
    envoyerEmailConfirmation: async () => {},
    envoyerEmailRejet: async () => {},
    logAudit: async () => {},
    ...overrides,
  };
}

const baseSquelette = {
  schoolId: SCHOOL,
  createdById: 'admin-1',
  nomProvisoire: 'Test',
  classId: null,
  contactEmail: null,
  contactTelephone: null,
  parentContactEmail: null,
  parentContactTelephone: null,
  sourceType: 'AUTOSERVICE' as const,
};

// ─── CreerSqueletteOnboardingUseCase ─────────────────────────────────────

describe('CreerSqueletteOnboardingUseCase', () => {
  it('échoue si auto-service désactivé pour l\'école', async () => {
    const repo = stubRepo({ settings: { selfServiceEnabled: false } });
    const useCase = new CreerSqueletteOnboardingUseCase(repo as any, activityLog);
    await expect(useCase.execute(baseSquelette)).rejects.toThrow('activé');
  });

  it('échoue si aucun contact fourni (ni email ni téléphone)', async () => {
    const useCase = new CreerSqueletteOnboardingUseCase(stubRepo() as any, activityLog);
    await expect(useCase.execute(baseSquelette)).rejects.toThrow('email ou un numéro');
  });

  it('échoue si email élève = email parent', async () => {
    const useCase = new CreerSqueletteOnboardingUseCase(stubRepo() as any, activityLog);
    await expect(useCase.execute({ ...baseSquelette, contactEmail: 'same@test.cm', parentContactEmail: 'same@test.cm' }))
      .rejects.toThrow('différents');
  });

  it('crée un squelette avec contact valide', async () => {
    const useCase = new CreerSqueletteOnboardingUseCase(stubRepo() as any, activityLog);
    const result = await useCase.execute({ ...baseSquelette, contactEmail: 'a@test.cm' });
    expect(result).toBeDefined();
    expect(result.id).toBe('ob-1');
  });
});

// ─── SoumettreFormulaireOnboardingUseCase ──────────────────────────────────

describe('SoumettreFormulaireOnboardingUseCase', () => {
  it('échoue si lien invalide (onboarding introuvable)', async () => {
    const useCase = new SoumettreFormulaireOnboardingUseCase(stubRepo({ onboarding: null }) as any);
    await expect(useCase.execute({ token: 'bad-token', nom: 'A', prenom: 'B' })).rejects.toThrow('invalide');
  });

  it('échoue si lien déjà utilisé', async () => {
    const onboarding = { tokenUsedAt: new Date() };
    const useCase = new SoumettreFormulaireOnboardingUseCase(stubRepo({ onboarding }) as any);
    await expect(useCase.execute({ token: 'used-token', nom: 'A', prenom: 'B' })).rejects.toThrow('déjà été utilisé');
  });

  it('échoue si lien expiré', async () => {
    const onboarding = { tokenExpiresAt: new Date('2020-01-01') };
    const useCase = new SoumettreFormulaireOnboardingUseCase(stubRepo({ onboarding }) as any);
    await expect(useCase.execute({ token: 'expired-token', nom: 'A', prenom: 'B' })).rejects.toThrow('expiré');
  });
});

// ─── ValiderOnboardingUseCase ──────────────────────────────────────────────

describe('ValiderOnboardingUseCase', () => {
  it('échoue si dossier introuvable', async () => {
    const useCase = new ValiderOnboardingUseCase(stubRepo({ onboarding: null }) as any, activityLog);
    await expect(useCase.execute({ onboardingId: 'bad', schoolId: SCHOOL, validatedById: 'admin-1', validatorRole: 'ADMIN' }))
      .rejects.toThrow('introuvable');
  });

  it('échoue si statut terminal non validable', async () => {
    const onboarding = { status: 'EXPIRED' };
    const useCase = new ValiderOnboardingUseCase(stubRepo({ onboarding }) as any, activityLog);
    await expect(useCase.execute({ onboardingId: 'ob-1', schoolId: SCHOOL, validatedById: 'admin-1', validatorRole: 'ADMIN' }))
      .rejects.toThrow('peut pas être validé');
  });

  it('échoue si rôle non autorisé', async () => {
    const onboarding = { status: 'SUBMITTED' };
    const useCase = new ValiderOnboardingUseCase(stubRepo({ onboarding }) as any, activityLog);
    await expect(useCase.execute({ onboardingId: 'ob-1', schoolId: SCHOOL, validatedById: 'teacher-1', validatorRole: 'TEACHER' }))
      .rejects.toThrow('peut valider');
  });
});

function stubSchoolRepo(adminGere = false) {
  return { findById: async () => ({ adminGereInscriptions: adminGere }) };
}

// ─── RejeterOnboardingUseCase ──────────────────────────────────────────────

describe('RejeterOnboardingUseCase', () => {
  it('échoue si motif manquant', async () => {
    const useCase = new RejeterOnboardingUseCase(stubRepo() as any, stubSchoolRepo() as any, activityLog as any);
    await expect(useCase.execute({ onboardingId: 'ob-1', schoolId: SCHOOL, rejectionReason: '', rejectedById: 'admin-1', validatorRole: 'STAFF', staffPermissions: ['MANAGE_ENROLLMENT'] }))
      .rejects.toThrow('motif');
  });

  it('échoue si dossier introuvable', async () => {
    const useCase = new RejeterOnboardingUseCase(stubRepo({ onboarding: null }) as any, stubSchoolRepo() as any, activityLog as any);
    await expect(useCase.execute({ onboardingId: 'bad', schoolId: SCHOOL, rejectionReason: 'Pas conforme', rejectedById: 'admin-1', validatorRole: 'STAFF', staffPermissions: ['MANAGE_ENROLLMENT'] }))
      .rejects.toThrow('introuvable');
  });

  it('échoue si statut non actif', async () => {
    const onboarding = { status: 'EXPIRED' };
    const useCase = new RejeterOnboardingUseCase(stubRepo({ onboarding }) as any, stubSchoolRepo() as any, activityLog as any);
    await expect(useCase.execute({ onboardingId: 'ob-1', schoolId: SCHOOL, rejectionReason: 'Non conforme', rejectedById: 'admin-1', validatorRole: 'STAFF', staffPermissions: ['MANAGE_ENROLLMENT'] }))
      .rejects.toThrow('peut pas être rejeté');
  });
});