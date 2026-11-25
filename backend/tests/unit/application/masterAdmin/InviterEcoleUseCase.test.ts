import { describe, it, expect, beforeEach } from 'bun:test';
import { InviterEcoleUseCase } from '../../../../src/application/masterAdmin/InviterEcoleUseCase.ts';
import { InMemorySchoolRepository } from '../../../helpers/repositories/InMemorySchoolRepository.ts';
import { InMemoryInvitationRepository } from '../../../helpers/repositories/InMemoryInvitationRepository.ts';
import { FakeEmailService } from '../../../helpers/services/FakeEmailService.ts';
import type { EmailTemplatePort } from '@domain/ports/services/EmailTemplatePort';
import type { OutboundMessagingPolicy } from '@domain/ports/services/OutboundMessagingPolicy';

const stubEmailTemplate: EmailTemplatePort = {
  buildSchoolInviteTemplate: (payload) => ({
    subject: `Invitation ${payload.schoolName}`,
    html: '<p>test</p>',
    text: `Invitation ${payload.schoolName}`,
  }),
  buildOnboardingLink: (payload) => ({
    subject: `Onboarding ${payload.nomProvisoire}`,
    html: '<p>test</p>',
    text: `Onboarding ${payload.nomProvisoire}`,
  }),
};

describe('InviterEcoleUseCase', () => {
  let schoolRepo: InMemorySchoolRepository;
  let invitationRepo: InMemoryInvitationRepository;
  let emailService: FakeEmailService;
  let useCase: InviterEcoleUseCase;

  beforeEach(() => {
    schoolRepo = new InMemorySchoolRepository();
    invitationRepo = new InMemoryInvitationRepository();
    emailService = new FakeEmailService();
    useCase = new InviterEcoleUseCase(schoolRepo, invitationRepo, emailService, stubEmailTemplate);
  });

  it('devrait créer une école DRAFT et une invitation valide 72h', async () => {
    const resultat = await useCase.execute({
      email: 'directeur@lycee.cm',
      schoolName: 'Lycée Bilingue de Garoua',
      plan: 'STANDARD',
      masterAdminId: 'master-1',
    });

    expect(resultat.token).toBeDefined();
    expect(resultat.schoolId).toBeDefined();

    const diff = resultat.expiresAt.getTime() - Date.now();
    expect(diff).toBeGreaterThan(71 * 60 * 60 * 1000);
    expect(diff).toBeLessThan(73 * 60 * 60 * 1000);
  });

  it("devrait envoyer l'email d'invitation", async () => {
    await useCase.execute({
      email: 'directeur@lycee.cm',
      schoolName: 'Lycée Test',
      plan: 'DISCOVERY',
      masterAdminId: 'master-1',
    });

    expect(emailService.emailsEnvoyes).toHaveLength(1);
    expect(emailService.emailsEnvoyes[0].destinataire).toBe('directeur@lycee.cm');
    expect(emailService.emailsEnvoyes[0].sujet).toContain('Invitation');
  });

  it("devrait expirer l'ancienne invitation si email déjà invité", async () => {
    const premiere = await useCase.execute({
      email: 'directeur@lycee.cm',
      schoolName: 'Lycée Test',
      plan: 'DISCOVERY',
      masterAdminId: 'master-1',
    });

    const deuxieme = await useCase.execute({
      email: 'directeur@lycee.cm',
      schoolName: 'Lycée Test',
      plan: 'STANDARD',
      masterAdminId: 'master-1',
    });

    const ancienne = await invitationRepo.findByToken(premiere.token);
    expect(ancienne?.status).toBe('EXPIRED');

    const nouvelle = await invitationRepo.findByToken(deuxieme.token);
    expect(nouvelle?.status).toBe('PENDING');
  });

  it('devrait réutiliser la même école si déjà en DRAFT', async () => {
    const premiere = await useCase.execute({
      email: 'directeur@lycee.cm',
      schoolName: 'Lycée Test',
      plan: 'DISCOVERY',
      masterAdminId: 'master-1',
    });

    const deuxieme = await useCase.execute({
      email: 'directeur@lycee.cm',
      schoolName: 'Lycée Test',
      plan: 'DISCOVERY',
      masterAdminId: 'master-1',
    });

    expect(deuxieme.schoolId).toBe(premiere.schoolId);
  });

  it('devrait omettre activationUrl si envoi sortant actif (mode production réel)', async () => {
    const politiqueActive: OutboundMessagingPolicy = {
      estActive: async () => true,
    };
    const ucNormal = new InviterEcoleUseCase(schoolRepo, invitationRepo, emailService, stubEmailTemplate, politiqueActive);

    const res = await ucNormal.execute({
      email: 'directeur@lycee.cm',
      schoolName: 'Lycée Test',
      plan: 'DISCOVERY',
      masterAdminId: 'master-1',
    });

    expect(res.activationUrl).toBeUndefined();
  });

  it('devrait inclure activationUrl si envoi sortant inactif (mode test)', async () => {
    const politiqueModeTest: OutboundMessagingPolicy = {
      estActive: async () => false,
    };
    const ucTest = new InviterEcoleUseCase(schoolRepo, invitationRepo, emailService, stubEmailTemplate, politiqueModeTest);

    const res = await ucTest.execute({
      email: 'directeur@lycee.cm',
      schoolName: 'Lycée Test',
      plan: 'DISCOVERY',
      masterAdminId: 'master-1',
    });

    expect(res.activationUrl).toBeDefined();
    expect(res.activationUrl).toContain('/onboarding/');
  });
});
