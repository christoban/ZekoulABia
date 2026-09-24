import { describe, expect, it } from 'bun:test';
import { AppliquerPropositionEmploiDuTempsUseCase } from '../../../../src/application/timetable/AppliquerPropositionEmploiDuTempsUseCase.ts';
import type { ContexteEmploiDuTemps } from '../../../../src/application/timetable/ProposerEmploiDuTempsUseCase.ts';
import { InMemoryTimetableRepository } from '../../../helpers/repositories/InMemoryTimetableRepository.ts';

describe('Créneaux Temps libre', () => {
  it('remplace chaque case inutilisée par un créneau FREE explicite', async () => {
    const repository = new InMemoryTimetableRepository();
    const contexte: ContexteEmploiDuTemps = {
      classId: 'classe-1', academicYearId: 'annee-1', exigences: [{
        subjectId: 'maths', subjectType: 'THEORETICAL', teacherId: 'prof-1', durationMinutes: 60,
        subjectName: 'Mathématiques', volumeHebdomadaire: 1, nbOccurrencesHebdomadaires: 1,
      }],
      grille: [
        { dayOfWeek: 0, startTime: '08:00', endTime: '09:00' },
        { dayOfWeek: 0, startTime: '09:00', endTime: '10:00' },
      ],
      sallesDisponibles: [], occupationExistante: [], indisponibilitesEnseignants: [],
    };
    const useCase = new AppliquerPropositionEmploiDuTempsUseCase(repository, { chargerContexte: async () => contexte });

    const resultat = await useCase.execute({
      timetableId: 'edt-1', schoolId: 'school-1',
      seances: [{ subjectId: 'maths', teacherId: 'prof-1', roomId: 'salle-1', dayOfWeek: 0, startTime: '08:00', endTime: '09:00' }],
    });

    expect(resultat.creneauxCrees).toBe(2);
    const slots = await repository.findCreneauxByTimetable('edt-1');
    expect(slots.find(slot => slot.startTime === '09:00')?.kind).toBe('FREE');
  });
});
