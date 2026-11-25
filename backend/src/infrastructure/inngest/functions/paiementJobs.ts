/**
 * INNGEST — Jobs automatiques pour le module Matricule & Paiements MINESEC
 *
 * 1. syncCarteScolaire : sync nocturne des paiements depuis cartescolaire.cm
 * 2. relancePaiements : rappels hebdomadaires pour les frais en retard
 * 3. auditMatricules : détection des élèves sans matricule
 */
import { inngest } from '../client/index';
import { prisma } from '../../../config/prisma';
import { CarteScolaireScrapingAdapter } from '../../services/scraping/CarteScolaireScrapingAdapter.ts';
import { PrismaMatriculeImportRepository } from '../../persistence/prisma/PrismaMatriculeImportRepository';
import { PrismaPaiementMinesecRepository } from '../../persistence/prisma/PrismaPaiementMinesecRepository';
import { PrismaMinesecJobsRepository } from '../../persistence/prisma/PrismaMinesecJobsRepository';
import { SyncCarteScolaireJobUseCase } from '@application/paiementMinesec/SyncCarteScolaireJobUseCase';
import { RelancePaiementsUseCase } from '@application/paiementMinesec/RelancePaiementsUseCase';
import { AuditMatriculesUseCase } from '@application/paiementMinesec/AuditMatriculesUseCase';
import { SmsNotificationAdapter } from '../../services/sms/SmsNotificationAdapter';

// ─── 1. Sync nocturne cartescolaire.cm ────────────────────────────────────
// Réutilise SyncFromCarteScolaireUseCase (au lieu de dupliquer la logique) pour ne
// pas dévier du comportement du déclenchement manuel admin (/matricules/sync) —
// notamment la distinction impayé confirmé vs échec de vérification.
export const syncCarteScolaire = inngest.createFunction(
  { id: 'sync-cartescolaire-nocturne', name: 'Sync nocturne cartescolaire.cm', triggers: [{ cron: '0 2 * * *' }] },
  async ({ step }) => {
    const minesecJobsRepository = new PrismaMinesecJobsRepository(prisma);
    const matriculeRepository = new PrismaMatriculeImportRepository(prisma);
    const paiementRepository = new PrismaPaiementMinesecRepository(prisma);
    const carteScolaire = new CarteScolaireScrapingAdapter();
    const useCase = new SyncCarteScolaireJobUseCase(minesecJobsRepository, matriculeRepository, paiementRepository, carteScolaire);
    return useCase.execute(step);
  }
);

// ─── 2. Relances paiements en retard ──────────────────────────────────────
export const relancePaiements = inngest.createFunction(
  { id: 'relance-paiements-hebdo', name: 'Relances paiements en retard', triggers: [{ cron: '0 8 * * 1' }] },
  async () => {
    const repository = new PrismaMinesecJobsRepository(prisma);
    const smsNotification = new SmsNotificationAdapter();
    const useCase = new RelancePaiementsUseCase(repository, smsNotification);
    return useCase.execute();
  }
);

// ─── 3. Audit matricules ─────────────────────────────────────────────────
export const auditMatricules = inngest.createFunction(
  { id: 'audit-matricules-hebdo', name: 'Audit matricules hebdomadaire', triggers: [{ cron: '0 6 * * 0' }] },
  async () => {
    const repository = new PrismaMinesecJobsRepository(prisma);
    const useCase = new AuditMatriculesUseCase(repository);
    return useCase.execute();
  }
);
