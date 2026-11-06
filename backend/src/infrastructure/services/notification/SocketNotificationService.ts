import type { NotificationService, EnvoiNotificationOptions } from '@domain/ports/services/NotificationService';
import type { NotificationType as DomainNotificationType } from '@domain/types/enums';
import type { EventPublisher } from '@domain/ports/services/EventPublisher';
import type { NotificationType as PrismaNotificationType, NotificationChannel as PrismaNotificationChannel, UserRole, Prisma } from '@prisma/client';
import { getIO } from '../../socket/SocketServer.ts';
import { notifierUtilisateurPush, notifierUtilisateurPushAvecResultat } from './PushNotificationService.ts';
import { getParentContacts } from '../sms/SmsNotificationService.ts';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { PrismaPushSubscriptionRepository } from '@infrastructure/persistence/prisma/PrismaPushSubscriptionRepository';
import { resoudreCanal } from '@domain/policies/NotificationRoutingPolicy';
import { messageErreur } from '@application/shared/messageErreur';

/**
 * Le `NotificationType` du domaine (port NotificationService, ex. ABSENCE_ALERT,
 * GRADE_AVAILABLE) et l'enum Prisma `NotificationType` (ACADEMIC, ATTENDANCE, FINANCIAL...)
 * sont deux vocabulaires distincts qui partagent seulement le nom — vérifié en lisant les deux
 * définitions, seule la valeur SYSTEM coïncide. Toute écriture directe de `options.type` dans
 * `prisma.notification.create` échouerait silencieusement (valeur d'enum invalide) pour tout
 * le reste — cette table fait la conversion.
 */
const DOMAIN_TO_PRISMA_NOTIFICATION_TYPE: Record<DomainNotificationType, PrismaNotificationType> = {
  ABSENCE_ALERT: 'ATTENDANCE',
  GRADE_AVAILABLE: 'ACADEMIC',
  BULLETIN_AVAILABLE: 'ACADEMIC',
  PAYMENT_REMINDER: 'FINANCIAL',
  PAYMENT_CONFIRMED: 'FINANCIAL',
  PAYMENT_FAILED: 'FINANCIAL',
  COUNCIL_DECISION: 'ACADEMIC',
  LIBRARY_OVERDUE: 'SYSTEM',
  DISCIPLINE_SANCTION: 'COMMUNICATION',
  COMMUNICATION: 'COMMUNICATION',
  STUDENT_RISK_ALERT: 'ACADEMIC',
  FEE_PLAN_CREATED: 'FINANCIAL',
  ACADEMIC_EVENT: 'ACADEMIC',
  SYSTEM: 'SYSTEM',
};

const pushSubscriptionRepo = new PrismaPushSubscriptionRepository(prisma);

export class SocketNotificationService implements NotificationService {
  constructor(private readonly eventPublisher?: EventPublisher) {}

  private async poseHorodatageSiNull(
    id: string,
    userId: string,
    schoolId: string,
    field: 'deliveredAt' | 'confirmedAt' | 'readAt',
  ): Promise<boolean> {
    const notif = await prisma.notification.findFirst({
      where: { id, userId, schoolId },
      select: { id: true, deliveredAt: true, confirmedAt: true, readAt: true },
    });
    if (!notif) return false;
    if (notif[field]) return true;
    await prisma.notification.update({
      where: { id },
      data: { [field]: new Date() } as Prisma.NotificationUpdateInput,
    });
    return true;
  }

  async envoyer(options: EnvoiNotificationOptions): Promise<void> {
    // Rétrocompat : si canal est fourni mais urgency aussi, on log un warning
    if (options.urgency && options.canal && options.canal !== 'IN_APP') {
      console.warn(
        `[Notification] ⚠️ canal '${options.canal}' et urgency '${options.urgency}' fournis simultanément — urgency prioritaire. ` +
        `Miguer les appelants pour ne plus passer canal. userId=${options.userId}`,
      );
    }

    // Warning rétrocompat si ancien appelant force un canal sans urgency explicite
    if (!options.urgency && options.canal) {
      console.warn(
        `[Notification] canal='${options.canal}' sans urgency — défaut urgency=NORMAL. Migrer l'appelant. userId=${options.userId}`,
      );
    }

    // Toujours router via resoudreCanal (urgence = source de vérité, défaut NORMAL)
    const urgency = options.urgency ?? 'NORMAL';
    const prefRow = await prisma.notificationPreference
      .findUnique({
        where: { userId: options.userId },
        select: { push: true, sms: true, email: true },
      })
      .catch(() => null);
    const prefs = prefRow ? { push: prefRow.push, sms: prefRow.sms, email: prefRow.email } : null;
    const hasActivePush = await pushSubscriptionRepo.hasActiveToken(options.userId);
    const canaux = resoudreCanal(urgency, hasActivePush, prefs);

    // Canaux EMAIL/SMS sont gérés séparément — on log et on retourne
    const hasInApp = canaux.includes('IN_APP');
    const hasPush = canaux.includes('PUSH');
    const hasSms = canaux.includes('SMS');

    if (!hasInApp && !hasPush && !canaux.includes('SMS')) {
      console.log(`[Notification] ${canaux.join(',')} → ${options.userId} : ${options.titre}`);
      return;
    }

    // Persisté (table Notification) avant l'émission live / push — pour avoir notificationId
    let notificationId: string | null = null;
    try {
      const created = await prisma.notification.create({
        data: {
          schoolId: options.schoolId,
          userId: options.userId,
          type: DOMAIN_TO_PRISMA_NOTIFICATION_TYPE[options.type],
          urgency: urgency,
          title: options.titre,
          body: options.corps,
          metadata: (options.metadata ?? {}) as Prisma.InputJsonValue,
          channel: (hasPush ? 'PUSH' : 'IN_APP') as PrismaNotificationChannel,
        },
      });
      notificationId = created.id;
    } catch (err) {
      console.error('[Notification] Échec de persistance:', err);
    }

    // Push fire-and-forget si le canal inclut PUSH — inclut notificationId dans data pour ack client
    if (hasPush) {
      void notifierUtilisateurPush({
        userId: options.userId,
        title: options.titre,
        body: options.corps,
        data: { ...(options.metadata ?? {}), ...(notificationId ? { notificationId } : {}) },
      });
    }

    // SMS fire-and-forget si le canal inclut SMS
    if (hasSms) {
      const contacts = await getParentContacts(options.userId);
      for (const contact of contacts) {
        if (contact.phone) {
          const { sendSMS } = await import('../sms/SmsService.ts');
          await sendSMS(contact.phone, `${options.titre} — ${options.corps}`).catch(() => {});
        }
      }
    }

    // Émission Socket.io si IN_APP — deliveredAt immédiat si socket live (annule escalade URGENT)
    let socketEmitted = false;
    if (hasInApp) {
      const io = getIO();
      if (io) {
        try {
          io.to(`user:${options.userId}`).emit('notification', {
            id: notificationId,
            type: DOMAIN_TO_PRISMA_NOTIFICATION_TYPE[options.type],
            title: options.titre,
            body: options.corps,
            metadata: options.metadata ?? {},
            readAt: null,
            createdAt: new Date().toISOString(),
          });
          socketEmitted = true;
        } catch {}
      }
    }
    if (socketEmitted && notificationId) {
      await prisma.notification.update({
        where: { id: notificationId },
        data: { deliveredAt: new Date() },
      }).catch(() => {});
    }

    // Escalade SMS différée pour URGENT sans push actif
    if (urgency === 'URGENT' && !hasPush && notificationId) {
      try {
        await this.eventPublisher?.emit('notification/escalade-urgent', {
          notificationId,
          userId: options.userId,
          schoolId: options.schoolId,
        } as unknown as Record<string, unknown>);
      } catch (err) {
        console.error('[Notification] Échec envoi job escalade SMS:', err);
      }
    }
  }

  async envoyerAuRole(
    params: Parameters<NotificationService['envoyerAuRole']>[0]
  ): Promise<void> {
    if (params.canal && params.canal !== 'IN_APP' && !params.urgency) {
      console.log(`[Notification] ${params.canal} → rôle ${params.role}@${params.schoolId} : ${params.titre} (canal ignoré, broadcast IN_APP)`);
    }
    const urgency = params.urgency ?? 'NORMAL';
    const destinataires = await prisma.user.findMany({
      where: { schoolId: params.schoolId, role: params.role as UserRole, isActive: true },
      select: { id: true },
    });
    for (const u of destinataires) {
      await this.envoyer({
        schoolId: params.schoolId,
        userId: u.id,
        type: params.type,
        titre: params.titre,
        corps: params.corps,
        urgency,
      }).catch((e) => console.error('[Notification] envoyerAuRole user', u.id, e));
    }
  }

  async marquerLue(notificationId: string, userId?: string, schoolId?: string): Promise<void> {
    if (userId && schoolId) {
      await this.poseHorodatageSiNull(notificationId, userId, schoolId, 'readAt');
      return;
    }
    try {
      await prisma.notification.update({ where: { id: notificationId }, data: { readAt: new Date() } });
    } catch (err) {
      console.error('[Notification] Échec marquerLue:', err);
    }
  }

  async marquerDelivree(params: { notificationId: string; userId: string; schoolId: string }): Promise<boolean> {
    return this.poseHorodatageSiNull(params.notificationId, params.userId, params.schoolId, 'deliveredAt');
  }

  async marquerConfirmee(params: { notificationId: string; userId: string; schoolId: string }): Promise<boolean> {
    return this.poseHorodatageSiNull(params.notificationId, params.userId, params.schoolId, 'confirmedAt');
  }

  async notifierParents(opts: {
    schoolId: string;
    studentId: string;
    type: DomainNotificationType;
    titre: string;
    corps: string;
  }): Promise<void> {
    try {
      const parents = await getParentContacts(opts.studentId);
      for (const parent of parents) {
        // notifierParents utilise resoudreCanal via envoyer (urgency = HIGH pour alertes parents)
        await this.envoyer({ schoolId: opts.schoolId, userId: parent.userId, type: opts.type, titre: opts.titre, corps: opts.corps, urgency: 'HIGH' }).catch((err) => console.error('[PushFirst] parent:', messageErreur(err)));
        await notifierUtilisateurPushAvecResultat({ userId: parent.userId, title: opts.titre, body: opts.corps }).catch(() => ({ delivered: false }));
      }
    } catch (err) {
      console.error('[Notification] notifierParents error:', err);
    }
  }
}
