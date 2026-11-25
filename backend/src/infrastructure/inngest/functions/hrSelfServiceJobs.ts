/**
 * INNGEST — Job automatique pour le module RH self-service (voir HRSelfServiceController).
 *
 * relanceProfilRH : cron quotidien qui relance par email les employés (TEACHER/STAFF/ADMIN
 * actifs) n'ayant pas confirmé leur profil RH self-service (EmployeeFile.selfServiceCompletedAt
 * null), puis escalade vers les ADMIN de l'école au-delà du délai configuré — même pattern que
 * relanceOnboarding (eleveOnboardingJobs.ts).
 *
 * Canal IN_APP : contrairement à SocketNotificationService.envoyer() (émission Socket.io pure,
 * jamais persistée nulle part dans ce projet — vérifié, aucun notification.create direct
 * n'existe ailleurs), ce job écrit directement dans la table Notification pour que l'employé
 * voie sa relance dans sa cloche même s'il n'était pas connecté au moment de l'envoi.
 */
import { inngest } from '../client/index';
import { prisma } from '../../../config/prisma';
import { PrismaHrJobsRepository } from '../../persistence/prisma/PrismaHrJobsRepository';
import { RelanceProfilRHUseCase } from '@application/hr/RelanceProfilRHUseCase';
import { NodemailerEmailService } from '../../services/email/NodemailerEmailService';

export const relanceProfilRH = inngest.createFunction(
  { id: 'relance-profil-rh-quotidien', name: 'Relances profil RH self-service', triggers: [{ cron: '0 8 * * *' }] },
  async ({ step }) => {
    const repository = new PrismaHrJobsRepository(prisma);
    const emailService = new NodemailerEmailService();
    const useCase = new RelanceProfilRHUseCase(repository, emailService);
    return useCase.execute(step);
  },
);
