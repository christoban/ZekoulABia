/**
 * APPLICATION LAYER — RepondreEntreeCarnetUseCase
 * Permet à un parent de confirmer (Oui/Non) et/ou répondre, ou à l'école de répondre en retour.
 */
import type {
  CarnetLiaisonRepository,
  LiaisonResponseItem,
} from '@domain/ports/repositories/CarnetLiaisonRepository';
import type { ParentRepository } from '@domain/ports/repositories/ParentRepository';
import type { PresenceRepository } from '@domain/ports/repositories/PresenceRepository';
import type { NotificationService } from '@domain/ports/services/NotificationService';

export interface RepondreEntreeCarnetCommande {
  entryId: string;
  schoolId: string;
  authorId: string;
  authorRole: string;
  confirmed?: boolean | null;
  replyText?: string | null;
  clientRecordedAt?: Date | string | null;
}

export class RepondreEntreeCarnetUseCase {
  constructor(
    private readonly carnetRepo: CarnetLiaisonRepository,
    private readonly parentRepo: ParentRepository,
    private readonly notificationService: NotificationService,
    private readonly presenceRepo?: PresenceRepository,
  ) {}

  async execute(cmd: RepondreEntreeCarnetCommande): Promise<{
    response: LiaisonResponseItem;
    clockSkewWarning: boolean;
  }> {
    const entry = await this.carnetRepo.trouverParId(cmd.entryId, cmd.schoolId);
    if (!entry) {
      throw new Error('NOT_FOUND_CARNET_ENTRY');
    }

    const role = cmd.authorRole.toUpperCase();
    if (role === 'PARENT') {
      const ok = await this.parentRepo.aAccesEleve(cmd.authorId, entry.studentId);
      if (!ok) {
        throw new Error('FORBIDDEN_PARENT_STUDENT');
      }
    } else if (role === 'STUDENT') {
      throw new Error('FORBIDDEN_STUDENT_CARNET');
    }

    const replyText = typeof cmd.replyText === 'string' ? cmd.replyText.trim() : null;
    if (cmd.confirmed === undefined && (!replyText || replyText.length === 0)) {
      throw new Error('Confirmation ou texte de réponse requis');
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

    const response = await this.carnetRepo.ajouterReponse({
      schoolId: cmd.schoolId,
      entryId: entry.id,
      authorId: cmd.authorId,
      confirmed: cmd.confirmed ?? null,
      replyText: replyText || null,
      clientRecordedAt,
      clockSkewSeconds,
    });

    // Répondre vaut accusé de lecture
    await this.carnetRepo.marquerLue(entry.id, cmd.authorId, cmd.schoolId).catch(() => {});

    // Si c'est une réponse parent à une absence liée et que du texte est fourni, soumettre le justificatif en attente
    if (role === 'PARENT' && entry.category === 'ABSENCE' && entry.attendanceId && replyText && this.presenceRepo) {
      await this.presenceRepo.submitParentJustification(cmd.schoolId, entry.attendanceId, {
        parentUserId: cmd.authorId,
        justification: replyText,
      }).catch(() => {});
    }

    // Notifier l'autre partie
    if (role === 'PARENT') {
      if (entry.authorId !== cmd.authorId) {
        await this.notificationService.envoyer({
          schoolId: cmd.schoolId,
          userId: entry.authorId,
          type: 'COMMUNICATION',
          titre: `Réponse parent — ${entry.title}`,
          corps: replyText || (cmd.confirmed === true ? 'Confirmé : Oui' : 'Réponse : Non'),
          urgency: 'NORMAL',
        }).catch(() => {});
      }
    } else if (this.notificationService.notifierParents) {
      await this.notificationService.notifierParents({
        schoolId: cmd.schoolId,
        studentId: entry.studentId,
        type: 'COMMUNICATION',
        titre: `Réponse de l'école — ${entry.title}`,
        corps: replyText ?? 'Nouvelle réponse dans le carnet de liaison.',
      }).catch(() => {});
    }

    return {
      response,
      clockSkewWarning: clockSkewSeconds !== null && Math.abs(clockSkewSeconds) > 900,
    };
  }
}

