/**
 * INNGEST — Job automatique pour le module Onboarding Auto-Service Élèves
 *
 * relanceOnboarding : cron quotidien qui scanne les dossiers en LINK_SENT et gère
 * les relances (reminderDelayDays), l'escalade au responsable (escalationDelayDays)
 * et l'expiration (tokenExpiryDays) — seule partie de ce module qui doit tourner
 * sans déclencheur utilisateur (la création du lien et l'activation du compte sont
 * notifiées directement depuis EleveOnboardingController, voir son en-tête).
 */
import { inngest } from '../client/index';
import { prisma } from '../../../config/prisma';
import { PrismaEleveOnboardingJobsRepository } from '../../persistence/prisma/PrismaEleveOnboardingJobsRepository';
import { RelanceOnboardingUseCase } from '@application/eleveOnboarding/RelanceOnboardingUseCase';
import { NodemailerEmailService } from '../../services/email/NodemailerEmailService';
import { EmailTemplateAdapter } from '../../services/email/EmailTemplateAdapter';
import { SmsNotificationAdapter } from '../../services/sms/SmsNotificationAdapter';

export const relanceOnboarding = inngest.createFunction(
  { id: 'relance-onboarding-eleve-quotidien', name: 'Relances onboarding élève', triggers: [{ cron: '0 8 * * *' }] },
  async ({ step }) => {
    const repository = new PrismaEleveOnboardingJobsRepository(prisma);
    const useCase = new RelanceOnboardingUseCase(repository, new NodemailerEmailService(), new EmailTemplateAdapter(), new SmsNotificationAdapter());
    return useCase.execute(step);
  }
);
