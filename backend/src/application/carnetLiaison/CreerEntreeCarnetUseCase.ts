/**
 * APPLICATION LAYER — CreerEntreeCarnetUseCase
 * Crée une entrée dans le carnet de liaison numérique (École → Parent ou Parent → École).
 * Gère le horodatage hors-ligne (clockSkewSeconds), l'anti-doublon absence/paiement et les notifications.
 */
import type {
  CarnetLiaisonRepository,
  LiaisonEntryItem,
} from '@domain/ports/repositories/CarnetLiaisonRepository';
import type { ParentRepository } from '@domain/ports/repositories/ParentRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { NotificationService } from '@domain/ports/services/NotificationService';
import type { SmsNotificationPort } from '@domain/ports/services/SmsNotificationPort';
import type { LiaisonCategory } from '@domain/types/enums';

export interface CreerEntreeCarnetCommande {
  schoolId: string;
  authorId: string;
  authorRole: string;
  studentId?: string;
  studentIds?: string[];
  classId?: string;
  academicYearId?: string;
  category: LiaisonCategory;
  title: string;
  content: string;
  requiresConfirmation?: boolean;
  confirmationPrompt?: string;
  attendanceId?: string;
  paymentId?: string;
  isUrgent?: boolean;
  clientRecordedAt?: Date | string | null;
}

export class CreerEntreeCarnetUseCase {
  constructor(
    private readonly carnetRepo: CarnetLiaisonRepository,
    private readonly parentRepo: ParentRepository,
    private readonly userRepo: UserRepository,
    private readonly notificationService: NotificationService,
    private readonly smsNotification?: SmsNotificationPort,
  ) {}

  async execute(cmd: CreerEntreeCarnetCommande): Promise<{ entries: LiaisonEntryItem[]; clockSkewWarning: boolean }> {
    const role = cmd.authorRole.toUpperCase();
    const title = cmd.title.trim();
    const content = cmd.content.trim();
    if (!title || !content) {
      throw new Error('Titre et contenu requis pour le carnet de liaison');
    }

    let targets: string[] = [];
    if (cmd.studentIds && cmd.studentIds.length > 0) {
      targets = [...new Set(cmd.studentIds)];
    } else if (cmd.studentId) {
      targets = [cmd.studentId];
    } else if (cmd.classId && role !== 'PARENT') {
      const students = await this.userRepo.findByClass(cmd.classId, cmd.schoolId);
      targets = students.map((s) => s.id);
    }

    if (targets.length === 0) {
      throw new Error('Aucun élève cible trouvé pour le carnet de liaison');
    }

    if (role === 'PARENT') {
      if (targets.length > 1) {
        throw new Error('Un parent ne peut écrire que pour un enfant à la fois');
      }
      const allowed = await this.parentRepo.aAccesEleve(cmd.authorId, targets[0]);
      if (!allowed) {
        throw new Error('FORBIDDEN_PARENT_STUDENT');
      }
    }

    let clientRecordedAt: Date | null = null;
    let clockSkewSeconds: number | null = null;
    if (cmd.clientRecordedAt) {
      const parsed = cmd.clientRecordedAt instanceof Date
        ? cmd.clientRecordedAt
        : new Date(cmd.clientRecordedAt);
      if (!Number.isNaN(parsed.getTime())) {
        clientRecordedAt = parsed;
        clockSkewSeconds = Math.round((Date.now() - parsed.getTime()) / 1000);
      }
    }

    const entries: LiaisonEntryItem[] = [];
    for (const studentId of targets) {
      if (cmd.attendanceId) {
        const existingAtt = await this.carnetRepo.trouverParAttendanceId(cmd.attendanceId, cmd.schoolId);
        if (existingAtt) {
          entries.push(existingAtt);
          continue;
        }
      }
      if (cmd.paymentId) {
        const existingPay = await this.carnetRepo.trouverParPaymentId(cmd.paymentId, cmd.schoolId);
        if (existingPay) {
          entries.push(existingPay);
          continue;
        }
      }

      const category: LiaisonCategory = role === 'PARENT' ? 'PARENT_NOTE' : cmd.category;
      const entry = await this.carnetRepo.creer({
        schoolId: cmd.schoolId,
        academicYearId: cmd.academicYearId ?? null,
        studentId,
        classId: cmd.classId ?? null,
        authorId: cmd.authorId,
        authorRole: role,
        category,
        title,
        content,
        requiresConfirmation: role === 'PARENT' ? false : Boolean(cmd.requiresConfirmation),
        confirmationPrompt: role === 'PARENT' ? null : (cmd.confirmationPrompt ?? null),
        attendanceId: cmd.attendanceId ?? null,
        paymentId: cmd.paymentId ?? null,
        isUrgent: Boolean(cmd.isUrgent),
        clientRecordedAt,
        clockSkewSeconds,
      });

      // L'auteur a implicitement lu son propre message
      await this.carnetRepo.marquerLue(entry.id, cmd.authorId, cmd.schoolId).catch(() => {});
      entries.push(entry);

      // Notifications
      if (role === 'PARENT') {
        await this.notificationService.envoyerAuRole({
          schoolId: cmd.schoolId,
          role: 'ADMIN',
          type: 'COMMUNICATION',
          titre: `Carnet de liaison — Message parent (${entry.studentName ?? 'Élève'})`,
          corps: title,
          urgency: entry.isUrgent ? 'HIGH' : 'NORMAL',
        }).catch(() => {});
      } else {
        await this.notifierParentsEntree(entry);
      }
    }

    return {
      entries,
      clockSkewWarning: clockSkewSeconds !== null && Math.abs(clockSkewSeconds) > 900,
    };
  }

  private async notifierParentsEntree(entry: LiaisonEntryItem): Promise<void> {
    const parents = await this.carnetRepo.trouverParentsEleve(entry.studentId, entry.schoolId);
    if (parents.length === 0) return;

    const notifTitle = `Carnet de liaison : ${entry.title}`;
    const notifBody = `${entry.studentName ? entry.studentName + ' — ' : ''}${entry.content.slice(0, 140)}`;

    if (this.notificationService.notifierParents) {
      await this.notificationService.notifierParents({
        schoolId: entry.schoolId,
        studentId: entry.studentId,
        type: 'COMMUNICATION',
        titre: notifTitle,
        corps: notifBody,
      }).catch(() => {});
    } else {
      for (const p of parents) {
        await this.notificationService.envoyer({
          schoolId: entry.schoolId,
          userId: p.userId,
          type: 'COMMUNICATION',
          titre: notifTitle,
          corps: notifBody,
          urgency: entry.isUrgent ? 'HIGH' : 'NORMAL',
        }).catch(() => {});
      }
    }

    // Repli SMS systématique pour parents SMS_ONLY ou messages urgents / absences / convocations
    const smsOnlyOrUrgent = entry.isUrgent || entry.category === 'CONVOCATION' || entry.category === 'AUTHORIZATION';
    const smsPhones = parents
      .filter((p) => p.phone && (p.accessMode === 'SMS_ONLY' || smsOnlyOrUrgent))
      .map((p) => p.phone as string);

    if (smsPhones.length > 0 && this.smsNotification?.notifyGenericAlertSms) {
      await this.smsNotification.notifyGenericAlertSms({
        schoolId: entry.schoolId,
        phones: smsPhones,
        message: `ZekoulABia Carnet (${entry.studentName ?? 'Élève'}): ${entry.title} — ${entry.content.slice(0, 120)}`,
      }).catch(() => {});
    }
  }
}

