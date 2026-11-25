/**
 * DOMAIN LAYER — Port Service Notification
 * Push (FCM), SMS, Email, In-App — selon les préférences utilisateur et l'urgence.
 */
import type { NotificationType, NotificationChannel, NotificationUrgency } from '@domain/types/enums';

export interface EnvoiNotificationOptions {
  schoolId: string;
  userId: string;
  type: NotificationType;
  titre: string;
  corps: string;
  /** @deprecated Préférer urgency. Si urgency est fourni, canal est ignoré pour le routage. */
  canal?: NotificationChannel;
  /** Source de vérité du routage. Défaut NORMAL si absent (rétrocompat). */
  urgency?: NotificationUrgency;
  metadata?: Record<string, unknown>;
}

export interface NotificationService {
  envoyer(options: EnvoiNotificationOptions): Promise<void>;
  envoyerAuRole(params: {
    schoolId: string;
    role: string;
    type: NotificationType;
    titre: string;
    corps: string;
    canal?: NotificationChannel;
    urgency?: NotificationUrgency;
  }): Promise<void>;
  marquerLue(notificationId: string, userId?: string, schoolId?: string): Promise<void>;
  /** Pose deliveredAt si encore null. Retourne false si introuvable / pas propriétaire. */
  marquerDelivree(params: { notificationId: string; userId: string; schoolId: string }): Promise<boolean>;
  /** Pose confirmedAt si encore null. Même garde d’appartenance. */
  marquerConfirmee(params: { notificationId: string; userId: string; schoolId: string }): Promise<boolean>;
  notifierParents?(opts: {
    schoolId: string;
    studentId: string;
    type: NotificationType;
    titre: string;
    corps: string;
  }): Promise<void>;
}
