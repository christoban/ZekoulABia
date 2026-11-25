import { describe, expect, it } from 'bun:test';
import { SupprimerCreneauUseCase } from '../../../../src/application/timetable/SupprimerCreneauUseCase.ts';
import { CreneauHoraire } from '@domain/entities/CreneauHoraire.ts';
import { EmploiDuTemps } from '@domain/entities/EmploiDuTemps.ts';
import { InMemoryTimetableRepository } from '../../../helpers/repositories/InMemoryTimetableRepository.ts';

const journal = { log: async () => {} };

describe('SupprimerCreneauUseCase', () => {
  it('supprime un créneau d’un EDT brouillon de la même école', async () => {
    const repository = new InMemoryTimetableRepository();
    const edt = EmploiDuTemps.create({ schoolId: 'school-1', classId: 'class-1', academicYearId: 'year-1' });
    const slot = CreneauHoraire.create({ timetableId: edt.id, roomId: 'room-1', dayOfWeek: 0, startTime: '08:00', endTime: '09:00' });
    repository.ajouterEDT(edt);
    repository.ajouterCreneau(slot);

    await new SupprimerCreneauUseCase(repository, journal).execute({
      creneauId: slot.id,
      schoolId: 'school-1',
      demandeurId: 'user-1',
    });

    expect(await repository.findCreneauById(slot.id)).toBeNull();
  });

  it('refuse la suppression depuis une autre école', async () => {
    const repository = new InMemoryTimetableRepository();
    const edt = EmploiDuTemps.create({ schoolId: 'school-1', classId: 'class-1', academicYearId: 'year-1' });
    const slot = CreneauHoraire.create({ timetableId: edt.id, dayOfWeek: 0, startTime: '08:00', endTime: '09:00' });
    repository.ajouterEDT(edt);
    repository.ajouterCreneau(slot);

    await expect(new SupprimerCreneauUseCase(repository, journal).execute({
      creneauId: slot.id,
      schoolId: 'school-2',
      demandeurId: 'user-1',
    })).rejects.toThrow('Accès refusé');
    expect(await repository.findCreneauById(slot.id)).not.toBeNull();
  });
});
