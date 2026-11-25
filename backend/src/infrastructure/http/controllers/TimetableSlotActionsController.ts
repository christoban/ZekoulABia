import type { Request, Response, NextFunction } from 'express';
import type { GenererSqueletteEmploiDuTempsUseCase } from '@application/timetable/GenererSqueletteEmploiDuTempsUseCase';
import type { TimetableSlotActionsRepository } from '@domain/ports/repositories/TimetableSlotActionsRepository';
import { LIMITE_AP_HEURES } from '@domain/rules/CapaciteEmploiDuTemps';

export class TimetableSlotActionsController {
  constructor(
    private readonly genererSquelette: GenererSqueletteEmploiDuTempsUseCase,
    private readonly repo: TimetableSlotActionsRepository,
  ) {}

  generateSkeleton = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { classId } = req.body as { classId?: string };
      if (!classId) {
        res.status(400).json({ success: false, message: 'classId requis' });
        return;
      }
      const { timetableId } = await this.genererSquelette.execute({ schoolId, classId });
      const timetable = await this.repo.findTimetableDetailsForSkeleton(timetableId);
      res.status(201).json({ success: true, data: timetable });
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('existe déjà')) {
        const classId = (req.body as { classId?: string }).classId;
        const existingId = classId
          ? await this.repo.findExistingTimetableIdForCurrentYear(req.user!.schoolId, classId)
          : null;
        res.status(409).json({ success: false, message, data: { timetableId: existingId ?? undefined } });
        return;
      }
      if (message.includes('Classe introuvable')) {
        res.status(404).json({ success: false, message });
        return;
      }
      if (message.includes('grille horaire') || message.includes('année scolaire')) {
        res.status(422).json({ success: false, message });
        return;
      }
      next(err);
    }
  };

  checkConflict = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { teacherId, dayOfWeek, startTime, excludeSlotId } = req.query as Record<string, string>;
      if (!teacherId || !dayOfWeek || !startTime) {
        res.status(400).json({ success: false, message: 'teacherId, dayOfWeek et startTime requis' });
        return;
      }
      const conflict = await this.repo.findTeacherSlotConflict({
        schoolId,
        teacherId,
        dayOfWeek: parseInt(dayOfWeek),
        startTime,
        excludeSlotId,
      });
      if (conflict.hasConflict) {
        res.json({
          success: true,
          data: { hasConflict: true, conflictClass: conflict.conflictClassName ?? 'inconnue' },
        });
      } else {
        res.json({ success: true, data: { hasConflict: false } });
      }
    } catch (err) {
      next(err);
    }
  };

  updateSlot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const slotId = String(req.params['slotId']);
      const { subjectId, teacherId, isLV2Slot } = req.body as {
        subjectId?: string | null;
        teacherId?: string | null;
        isLV2Slot?: boolean;
      };
      const slot = await this.repo.findSlotWithTimetable(slotId);
      if (!slot || slot.timetable.schoolId !== schoolId) {
        res.status(404).json({ success: false, message: 'Créneau introuvable.' });
        return;
      }
      if (slot.timetable.status === 'PUBLISHED') {
        res.status(422).json({ success: false, message: 'Impossible de modifier un créneau d’un EDT publié.' });
        return;
      }
      if (teacherId && subjectId) {
        const assignment = await this.repo.findTeachingAssignment(slot.timetable.classId, subjectId);
        if (!assignment || assignment.teacherId !== teacherId) {
          const msg = assignment
            ? 'Cette matière est assignée à un autre enseignant pour cette classe.'
            : 'Aucune affectation n\'existe pour cette matière dans cette classe. Assignez d\'abord l\'enseignant à la matière via la gestion des classes.';
          res.status(400).json({ success: false, code: 'ENSEIGNANT_NON_ASSIGNE', message: msg });
          return;
        }
      }
      if (teacherId) {
        const conflict = await this.repo.findTeacherSlotConflict({
          schoolId,
          teacherId,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          excludeSlotId: slotId,
        });
        if (conflict.hasConflict) {
          res.status(409).json({
            success: false,
            code: 'CONFLIT_HORAIRE',
            message: `Conflit : cet enseignant est déjà affecté à la classe ${conflict.conflictClassName ?? 'inconnue'} à ce créneau.`,
          });
          return;
        }
        const isAP = await this.repo.isAnimateurPedagogique(schoolId, teacherId);
        if (isAP) {
          const [slotsAP, dureePeriode] = await Promise.all([
            this.repo.countTeacherSlotsExcluding(schoolId, teacherId, slotId),
            this.repo.getGridPeriodDuration(schoolId),
          ]);
          const heuresTotal = (slotsAP + 1) * dureePeriode / 60;
          if (heuresTotal > LIMITE_AP_HEURES) {
            res.status(409).json({
              success: false,
              code: 'VOLUME_AP_DEPASSE',
              message: `Cet Animateur Pédagogique aurait ${heuresTotal.toFixed(1)}h/semaine, dépassant la limite légale de 14h.`,
            });
            return;
          }
        }
      }
      const updated = await this.repo.updateSlot(slotId, {
        subjectId: subjectId ?? null,
        teacherId: teacherId ?? null,
        kind: subjectId ? 'CLASS' : 'FREE',
        ...(typeof isLV2Slot === 'boolean' ? { isLV2Slot } : {}),
      });
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  };
}
