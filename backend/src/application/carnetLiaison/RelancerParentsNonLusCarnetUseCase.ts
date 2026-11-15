/**
 * APPLICATION LAYER — RelancerParentsNonLusCarnetUseCase
 * Relance les parents qui n'ont pas encore lu (ou confirmé) une note du carnet.
 */
import type { CarnetLiaisonRepository } from '@domain/ports/repositories/CarnetLiaisonRepository';
import type { NotificationService } from '@domain/ports/services/NotificationService';
import type { SmsNotificationPort } from '@domain/ports/services/SmsNotificationPort';

export class RelancerParentsNonLusCarnetUseCase {
  constructor(
    private readonly carnetRepo: CarnetLiaisonRepository,
    private readonly notificationService: NotificationService,
    private readonly smsNotification?: SmsNotificationPort,
  ) {}

  async execute(params: {
    entryId: string;
    schoolId: string;
    role: string;
  }): Promise<{ notifiedCount: number; smsCount: number }> {
    const role = params.role.toUpperCase();
    if (role !== 'ADMIN' && role !== 'STAFF' && role !== 'TEACHER') {
      throw new Error('FORBIDDEN_REMIND_CARNET');
    }

    const entry = await this.carnetRepo.trouverParId(params.entryId, params.schoolId);
    if (!entry) {
      throw new Error('NOT_FOUND_CARNET_ENTRY');
    }

    const parents = await this.carnetRepo.trouverParentsEleve(entry.studentId, params.schoolId);
    const readIds = new Set(entry.readReceipts.map((r) => r.userId));
    const confirmedIds = new Set(
      entry.responses.filter((r) => r.confirmed !== null).map((r) => r.authorId),
    );

    const pendingParents = parents.filter((p) =>
      entry.requiresConfirmation ? !confirmedIds.has(p.userId) : !readIds.has(p.userId),
    );

    const titre = `Rappel Carnet de liaison : ${entry.title}`;
    const corps = entry.requiresConfirmation
      ? `Merci de consulter et confirmer la note concernant ${entry.studentName ?? 'votre enfant'}.`
      : `Une note non lue vous attend concernant ${entry.studentName ?? 'votre enfant'}.`;

    const smsPhones: string[] = [];
    for (const parent of pendingParents) {
      await this.notificationService.envoyer({
        schoolId: params.schoolId,
        userId: parent.userId,
        type: 'COMMUNICATION',
        titre,
        corps,
        urgency: 'HIGH',
      }).catch(() => {});
      if (parent.phone) {
        smsPhones.push(parent.phone);
      }
    }

    if (smsPhones.length > 0 && this.smsNotification?.notifyGenericAlertSms) {
      await this.smsNotification.notifyGenericAlertSms({
        schoolId: params.schoolId,
        phones: smsPhones,
        message: `ZekoulABia Rappel Carnet (${entry.studentName ?? 'Élève'}): ${entry.title}`,
      }).catch(() => {});
    }

    return {
      notifiedCount: pendingParents.length,
      smsCount: smsPhones.length,
    };
  }
}

