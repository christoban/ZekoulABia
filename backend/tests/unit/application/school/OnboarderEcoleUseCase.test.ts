import { describe, it, expect, beforeEach } from 'bun:test';
import { OnboarderEcoleUseCase } from '@application/school/OnboarderEcoleUseCase';
import { InMemorySchoolRepository } from '../../../helpers/repositories/InMemorySchoolRepository.ts';
import { InMemoryUserRepository } from '../../../helpers/repositories/InMemoryUserRepository.ts';
import { InMemoryEmailService } from '../../../helpers/services/InMemoryEmailService.ts';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function commandeBase() {
  return {
    nom: 'Lycée Bilingue de Bastos',
    subdomain: 'lycee-bastos',
    subsystem: 'FRANCOPHONE' as const,
    educationType: 'GENERAL' as const,
    ownership: 'PRIVATE_SECULAR' as const,
    adminPrenom: 'Marie',
    adminNom: 'Fotso',
    adminEmail: 'marie.fotso@ecole.cm',
    adminPasswordHash: '$2b$12$hashed',
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('OnboarderEcoleUseCase', () => {
  let schoolRepo: InMemorySchoolRepository;
  let userRepo: InMemoryUserRepository;
  let emailService: InMemoryEmailService;
  let useCase: OnboarderEcoleUseCase;

  beforeEach(() => {
    schoolRepo = new InMemorySchoolRepository();
    userRepo = new InMemoryUserRepository();
    emailService = new InMemoryEmailService();
    useCase = new OnboarderEcoleUseCase(schoolRepo, userRepo, emailService);
  });

  describe('Cas nominal', () => {
    it('crée l\'école avec le statut PENDING', async () => {
      const resultat = await useCase.execute(commandeBase());

      const ecole = await schoolRepo.findById(resultat.schoolId);
      expect(ecole).not.toBeNull();
      expect(ecole!.status).toBe('PENDING');
    });

    it('retourne le subdomain de la commande', async () => {
      const resultat = await useCase.execute(commandeBase());
      expect(resultat.subdomain).toBe('lycee-bastos');
    });

    it('crée l\'admin et retourne son ID', async () => {
      const resultat = await useCase.execute(commandeBase());

      const admin = await userRepo.findById(resultat.adminUserId);
      expect(admin).not.toBeNull();
      expect(admin!.role).toBe('ADMIN');
    });

    it('associe l\'admin à l\'école créée', async () => {
      const resultat = await useCase.execute(commandeBase());

      const admin = await userRepo.findById(resultat.adminUserId);
      expect(admin!.schoolId).toBe(resultat.schoolId);
    });

    it('envoie un email de confirmation à l\'adminEmail', async () => {
      await useCase.execute(commandeBase());

      expect(emailService.appels).toHaveLength(1);
      expect(emailService.appels[0].destinataire).toBe('marie.fotso@ecole.cm');
    });

    it('le message indique que la demande est en attente d\'approbation', async () => {
      const resultat = await useCase.execute(commandeBase());
      expect(resultat.message).toContain('attente');
    });
  });

  describe('Erreurs — doublon', () => {
    it('rejette si le subdomain est déjà utilisé', async () => {
      await useCase.execute(commandeBase());

      await expect(useCase.execute(commandeBase())).rejects.toThrow(
        'déjà utilisé'
      );
    });
  });

  describe('Erreurs — validation', () => {
    it('rejette si le nom de l\'école a moins de 3 caractères', async () => {
      await expect(
        useCase.execute({ ...commandeBase(), nom: 'AB' })
      ).rejects.toThrow('au moins 3 caractères');
    });

    it('rejette si le subdomain contient des caractères invalides (espaces, majuscules)', async () => {
      await expect(
        useCase.execute({ ...commandeBase(), subdomain: 'Mon Lycée!' })
      ).rejects.toThrow('sous-domaine');
    });

    it('rejette si le subdomain est vide', async () => {
      await expect(
        useCase.execute({ ...commandeBase(), subdomain: '' })
      ).rejects.toThrow('sous-domaine');
    });
  });
});
