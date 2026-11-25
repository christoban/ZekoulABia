import type { Request, Response, NextFunction } from 'express';
import { generateWithGroq } from '../../services/ai/GroqClient.ts';
import { resolveLanguage } from '../../../domain/policies/LanguagePolicy';
import { instructionLangue } from '../../services/ai/prompts/LanguagePrompt';
import type { ModifierCreneauUseCase } from '@application/timetable/ModifierCreneauUseCase';
import type { TimetableRepository } from '@domain/ports/repositories/TimetableRepository';
import { NOMS_JOURS } from '@domain/types/joursSemaine';
import { ConflitHoraireError } from '@domain/errors/ConflitHoraireError';
import { ConflitSalleError } from '@domain/errors/ConflitSalleError';

export class TimetableAutoController {
  constructor(
    private readonly timetableRepository: TimetableRepository,
    private readonly modifierCreneau: ModifierCreneauUseCase,
  ) {}

  adjust = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user.schoolId as string;
      const timetableId = req.params['id'] as string;
      const { instruction } = req.body as { instruction?: string };

      if (!instruction?.trim()) {
        res.status(400).json({ success: false, message: 'instruction requise' });
        return;
      }

      const timetable = await this.timetableRepository.findContexteAdjustIA(timetableId, schoolId);

      if (!timetable) {
        res.status(404).json({ success: false, message: 'Emploi du temps introuvable.' });
        return;
      }
      if (timetable.status === 'PUBLISHED') {
        res.status(422).json({ success: false, message: 'Impossible de modifier un emploi du temps publié.' });
        return;
      }

      const slotsContext = timetable.slots
        .filter(s => s.subject && s.teacher)
        .map(s => `ID:${s.id} | ${NOMS_JOURS[s.dayOfWeek] ?? s.dayOfWeek} ${s.startTime}-${s.endTime} | ${s.subject!.name} | ${s.teacher!.firstName} ${s.teacher!.lastName}`)
        .join('\n');

      const prompt = `Tu gères l'emploi du temps de la classe ${timetable.class.name}.\n\nCréneaux actuels :\n${slotsContext || '(aucun créneau)'}\n\nInstruction : "${instruction}"\n\nRetourne UNIQUEMENT un JSON array des modifications, format strict :\n[{"slotId":"...","newDayOfWeek":0,"newStartTime":"HH:MM","newEndTime":"HH:MM"}]\nnewDayOfWeek est un entier : 0=Lundi, 1=Mardi, 2=Mercredi, 3=Jeudi, 4=Vendredi, 5=Samedi. Aucune autre valeur n'est acceptée.\nSi impossible ou ambigu, retourne []. Ne retourne QUE le JSON.`;

      const response = await generateWithGroq(
        prompt,
        'Tu es assistant emploi du temps. Réponds uniquement en JSON valide, sans explication ni Markdown.',
      );

      let changes: Array<{ slotId: string; newDayOfWeek: number; newStartTime: string; newEndTime: string }> = [];
      try {
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) changes = JSON.parse(jsonMatch[0]) as typeof changes;
      } catch {
        res.status(422).json({ success: false, message: "L'IA n'a pas pu interpréter cette instruction. Reformulez-la." });
        return;
      }

      if (!changes.length) {
        res.json({ success: true, data: { applied: [], errors: [], message: 'Aucune modification applicable pour cette instruction.' } });
        return;
      }

      const applied: string[] = [];
      const errors: string[] = [];

      // Chaque changement passe par ModifierCreneauUseCase : il applique les VRAIES règles du
      // domaine (chevauchement horaire réel — et non une égalité exacte de startTime qui laissait
      // passer 08:00-10:00 contre 09:00-10:00 —, conflit de salle, volume horaire AP, et
      // validation de plage du jour produit par le LLM). Le try/catch par changement préserve la
      // sémantique de succès partiel attendue par le front (applied[] / errors[]).
      for (const change of changes) {
        const slot = timetable.slots.find(s => s.id === change.slotId);
        if (!slot) { errors.push(`Créneau ${change.slotId} introuvable`); continue; }

        try {
          await this.modifierCreneau.execute({
            creneauId: slot.id,
            timetableId: timetable.id,
            schoolId,
            dayOfWeek: change.newDayOfWeek,
            startTime: change.newStartTime,
            endTime: change.newEndTime,
          });
          applied.push(`${slot.subject?.name ?? '?'} → ${NOMS_JOURS[change.newDayOfWeek] ?? change.newDayOfWeek} ${change.newStartTime}`);
        } catch (err) {
          if (err instanceof ConflitHoraireError || err instanceof ConflitSalleError) {
            errors.push(err.message);
          } else {
            errors.push(
              `${slot.subject?.name ?? 'Créneau'} : ${err instanceof Error ? err.message : 'modification impossible'}`,
            );
          }
        }
      }

      res.json({
        success: true,
        data: {
          applied,
          errors,
          message: applied.length
            ? `${applied.length} modification(s) appliquée(s).`
            : 'Aucune modification appliquée (conflits ou erreurs).',
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
