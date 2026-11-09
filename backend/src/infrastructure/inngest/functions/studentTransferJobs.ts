import { inngest } from '../client/index';
import { prisma } from '../../../config/prisma';
import { PrismaTransferRequestRepository } from '../../persistence/prisma/PrismaTransferRequestRepository';
import { PrismaTransferAuditAdapter } from '../../persistence/prisma/PrismaTransferAuditAdapter';
import { PrismaTransferSnapshotBuilder } from '../../persistence/prisma/PrismaTransferSnapshotBuilder';
import { PrismaStudentTransferLifecycleRepository } from '../../persistence/prisma/PrismaStudentTransferLifecycleRepository';
import { PrismaGuardianConsentIssuerAdapter } from '../../persistence/prisma/PrismaGuardianConsentIssuerAdapter';
import { TransferConsentNotificationAdapter } from '../../services/sms/TransferConsentNotificationAdapter';
import { TransferSnapshotEncryptionAdapter } from '../../backup/TransferSnapshotEncryptionAdapter';
import { AutoApprouverDemandeTransfertUseCase } from '@application/studentTransfer/AutoApprouverDemandeTransfertUseCase';
import { ExpirerDemandeTransfertUseCase } from '@application/studentTransfer/ExpirerDemandeTransfertUseCase';
import { GenererInstantaneTransfertUseCase } from '@application/studentTransfer/GenererInstantaneTransfertUseCase';
import { MarquerEleveTransfereUseCase } from '@application/studentTransfer/MarquerEleveTransfereUseCase';
import { RappelerConsentementTransfertUseCase, choisirJourRelance } from '@application/studentTransfer/RappelerConsentementTransfertUseCase';
import { SupprimerInstantanesExpiresUseCase } from '@application/studentTransfer/SupprimerInstantanesExpiresUseCase';
import { messageErreur } from '@application/shared/messageErreur';

const BATCH_MAX = 100;

export const traiterAutoApprobationTransferts = inngest.createFunction(
  { id: 'student-transfer-auto-approval', name: 'Auto-approbation transferts élèves', triggers: [{ cron: '*/15 * * * *' }] },
  async ({ step }) => step.run('auto-approve-transfer-requests', async () => {
    const repository = new PrismaTransferRequestRepository(prisma);
    const audit = new PrismaTransferAuditAdapter(prisma);
    const pending = await prisma.transferRequest.findMany({
      where: { status: 'PENDING_SOURCE', sourceAutoApprovalAt: { lte: new Date() } },
      select: { id: true },
      take: BATCH_MAX,
    });
    let processed = 0;
    for (const request of pending) {
      if (await new AutoApprouverDemandeTransfertUseCase(repository, audit).execute(request.id)) processed += 1;
    }
    return { processed };
  }),
);

export const traiterExpirationConsentementsTransferts = inngest.createFunction(
  { id: 'student-transfer-expiration', name: 'Expiration consentements transferts', triggers: [{ cron: '*/15 * * * *' }] },
  async ({ step }) => step.run('expire-transfer-consents', async () => {
    const repository = new PrismaTransferRequestRepository(prisma);
    const audit = new PrismaTransferAuditAdapter(prisma);
    const pending = await prisma.transferRequest.findMany({
      where: { status: 'PENDING_GUARDIAN', parentExpiresAt: { lte: new Date() } },
      select: { id: true },
      take: BATCH_MAX,
    });
    let processed = 0;
    for (const request of pending) {
      if (await new ExpirerDemandeTransfertUseCase(repository, audit).execute(request.id)) processed += 1;
    }
    return { processed };
  }),
);

/** APPROVED -> instantané chiffré -> COMPLETED. Chaque sécurité est relue dans le use case. */
export const traiterGenerationInstantanesTransferts = inngest.createFunction(
  { id: 'student-transfer-snapshot-generation', name: 'Génération instantanés transferts', triggers: [{ cron: '*/15 * * * *' }] },
  async ({ step }) => step.run('generate-approved-transfer-snapshots', async () => {
    const repository = new PrismaTransferRequestRepository(prisma);
    const audit = new PrismaTransferAuditAdapter(prisma);
    const builder = new PrismaTransferSnapshotBuilder(prisma, new TransferSnapshotEncryptionAdapter());
    const approved = await prisma.transferRequest.findMany({
      where: { status: 'APPROVED' },
      select: { id: true },
      take: BATCH_MAX,
    });
    let processed = 0;
    for (const request of approved) {
      try {
        await new GenererInstantaneTransfertUseCase(repository, builder, audit).execute(request.id);
        processed += 1;
      } catch (error) {
        console.error(`Snapshot transfer ${request.id} : ${messageErreur(error)}`);
      }
    }
    return { processed };
  }),
);

/** COMPLETED -> marquage TRANSFERRED côté école source (idempotent). */
export const traiterMarquageTransferts = inngest.createFunction(
  { id: 'student-transfer-marking', name: 'Marquage élèves transférés', triggers: [{ cron: '*/15 * * * *' }] },
  async ({ step }) => step.run('mark-completed-transfer-students', async () => {
    const repository = new PrismaStudentTransferLifecycleRepository(prisma);
    const useCase = new MarquerEleveTransfereUseCase(repository);
    const completed = await prisma.transferRequest.findMany({
      where: { status: 'COMPLETED' },
      select: { id: true, sourceStudentProfileId: true, sourceSchoolId: true, targetSchoolId: true, completedAt: true },
      take: BATCH_MAX,
    });
    let processed = 0;
    for (const request of completed) {
      const dejaMarque = await prisma.studentProfile.findFirst({
        where: { id: request.sourceStudentProfileId, studentStatus: 'TRANSFERRED' },
        select: { id: true },
      });
      if (dejaMarque) continue;
      await useCase.execute({
        transferRequestId: request.id,
        sourceStudentProfileId: request.sourceStudentProfileId,
        sourceSchoolId: request.sourceSchoolId,
        targetSchoolId: request.targetSchoolId,
        status: 'COMPLETED',
      });
      await prisma.transferAuditEvent.create({
        data: {
          transferRequestId: request.id,
          eventType: 'SOURCE_STUDENT_MARKED_TRANSFERRED',
          actorSchoolId: request.sourceSchoolId,
          sourceSchoolId: request.sourceSchoolId,
          targetSchoolId: request.targetSchoolId,
          stateBefore: 'COMPLETED',
          stateAfter: 'COMPLETED',
          metadata: { completedAt: request.completedAt?.toISOString() ?? null },
        },
      });
      processed += 1;
    }
    return { processed };
  }),
);

/** Relances parent à J+3 et J+10 (dédupliquée par l'événement d'audit du jour). */
export const traiterRelancesConsentementTransferts = inngest.createFunction(
  { id: 'student-transfer-reminders', name: 'Relances consentement transferts', triggers: [{ cron: '0 9 * * *' }] },
  async ({ step }) => step.run('remind-pending-guardian-consents', async () => {
    const audit = new PrismaTransferAuditAdapter(prisma);
    const useCase = new RappelerConsentementTransfertUseCase(
      new PrismaGuardianConsentIssuerAdapter(prisma),
      new TransferConsentNotificationAdapter(prisma),
      audit,
    );
    const maintenant = new Date();
    const pending = await prisma.transferRequest.findMany({
      where: { status: 'PENDING_GUARDIAN' },
      select: { id: true, sourceSchoolId: true, targetSchoolId: true, requestedAt: true },
      take: BATCH_MAX,
    });
    let processed = 0;
    for (const request of pending) {
      const jours = Math.floor((maintenant.getTime() - request.requestedAt.getTime()) / 86_400_000);
      const dejaFait = (day: number) => prisma.transferAuditEvent.findFirst({
        where: {
          transferRequestId: request.id,
          eventType: 'GUARDIAN_CONSENT_REMINDER',
          metadata: { path: ['day'], equals: day },
        },
      });
      const day = choisirJourRelance(jours, Boolean(await dejaFait(3)), Boolean(await dejaFait(10)));
      if (day === null) continue;
      try {
        await useCase.execute({
          requestId: request.id,
          sourceSchoolId: request.sourceSchoolId,
          targetSchoolId: request.targetSchoolId,
          day,
        });
        processed += 1;
      } catch (error) {
        console.error(`Relance transfer ${request.id} : ${messageErreur(error)}`);
      }
    }
    return { processed };
  }),
);

export const purgerSnapshotsTransferts = inngest.createFunction(
  { id: 'student-transfer-snapshot-purge', name: 'Purge snapshots transferts', triggers: [{ cron: '0 2 * * *' }] },
  async ({ step }) => step.run('purge-expired-transfer-snapshots', async () => {
    const builder = new PrismaTransferSnapshotBuilder(prisma, new TransferSnapshotEncryptionAdapter());
    return { deleted: await new SupprimerInstantanesExpiresUseCase(builder).execute() };
  }),
);
