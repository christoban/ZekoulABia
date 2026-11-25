import type { NotificationService, EnvoiNotificationOptions } from '@domain/ports/services/NotificationService';

export class InMemoryNotificationService implements NotificationService {
  appels: EnvoiNotificationOptions[] = [];

  async envoyer(options: EnvoiNotificationOptions): Promise<void> {
    this.appels.push(options);
  }

  async envoyerAuRole(_params: Parameters<NotificationService['envoyerAuRole']>[0]): Promise<void> {}

  async marquerLue(_notificationId: string): Promise<void> {}
  async marquerDelivree(_params: { notificationId: string; userId: string; schoolId: string }): Promise<boolean> { return true; }
  async marquerConfirmee(_params: { notificationId: string; userId: string; schoolId: string }): Promise<boolean> { return true; }
}
