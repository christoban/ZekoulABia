import { describe, expect, it } from 'bun:test';
import { ViderCreneauxClasseUseCase } from '../../../../src/application/timetable/ViderCreneauxClasseUseCase.ts';
import { CreneauHoraire } from '@domain/entities/CreneauHoraire.ts';
import { EmploiDuTemps } from '@domain/entities/EmploiDuTemps.ts';
import { InMemoryTimetableRepository } from '../../../helpers/repositories/InMemoryTimetableRepository.ts';

const journal = { log: async () => {} };

describe('ViderCreneauxClasseUseCase', () => {
  it('supprime tous les créneaux d’un EDT brouillon de la même école', async () => {
    const repository = new InMemoryTimetableRepository();
    const edt = EmploiDuTemps.create({ schoolId: 'school-1', classId: 'class-1', academicYearId: 'year-1' });
    const slots = [
      CreneauHoraire.create({ timetableId: edt.id, dayOfWeek: 0, startTime: '08:00', endTime: '09:00' }),
      CreneauHoraire.create({ timetableId: edt.id, dayOfWeek: 1, startTime: '08:00', endTime: '09:00' }),
    ];
    repository.ajouterEDT(edt);
    for (const slot of slots) repository.ajouterCreneau(slot);

    const nombreSupprimes = await new ViderCreneauxClasseUseCase(repository, journal).execute({
      timetableId: edt.id,
      schoolId: 'school-1',
      demandeurId: 'user-1',
    });

    expect(nombreSupprimes).toBe(2);
    expect(await repository.findCreneauxByTimetable(edt.id)).toHaveLength(0);
  });

  it('refuse un EDT publié', async () => {
    const repository = new InMemoryTimetableRepository();
    const edt = EmploiDuTemps.reconstituer({
      id: 'edt-1', schoolId: 'school-1', classId: 'class-1', academicYearId: 'year-1',
      status: 'PUBLISHED', generatedByAI: false, createdAt: new Date(),
    });
    repository.ajouterEDT(edt);

    await expect(new ViderCreneauxClasseUseCase(repository, journal).execute({
      timetableId: edt.id,
      schoolId: 'school-1',
      demandeurId: 'user-1',
    })).rejects.toThrow('publié');
  });
});
