import { describe, expect, it } from 'bun:test';
import { AppliquerPropositionEmploiDuTempsUseCase } from '../../../../src/application/timetable/AppliquerPropositionEmploiDuTempsUseCase.ts';
import type { ContexteEmploiDuTemps } from '../../../../src/application/timetable/ProposerEmploiDuTempsUseCase.ts';
import { InMemoryTimetableRepository } from '../../../helpers/repositories/InMemoryTimetableRepository.ts';
import type { SeanceGroupeProposee } from '@domain/ports/services/SchedulingSolverPort.ts';

const seancesGroupes: SeanceGroupeProposee[] = [
  {
    subjectId: 'arabe', teacherId: 'prof-arabe', roomId: 'salle-4e-c', dayOfWeek: 0, startTime: '08:00', endTime: '09:00',
    groupId: 'groupe-arabe', groupName: 'Arabe', participantsCount: 5, isLV2Slot: true,
  },
  {
    subjectId: 'chinois', teacherId: 'prof-chinois', roomId: 'salle-secours-1', dayOfWeek: 0, startTime: '08:00', endTime: '09:00',
    groupId: 'groupe-chinois', groupName: 'Chinois', participantsCount: 5, isLV2Slot: true,
  },
];

const contexte: ContexteEmploiDuTemps = {
  classId: '4e-c', academicYearId: '2026-2027', salleHabituelleId: 'salle-4e-c', exigences: [],
  grille: [{ dayOfWeek: 0, startTime: '08:00', endTime: '09:00' }],
  sallesDisponibles: [{ roomId: 'salle-4e-c', type: 'NORMAL', capacity: 40 }, { roomId: 'salle-secours-1', type: 'NORMAL', capacity: 20 }],
  occupationExistante: [], occupationLocale: [], salleIdsHabituelles: ['salle-4e-c'], groupesLV2: [], indisponibilitesEnseignants: [],
};

describe('Application atomique des séances LV2', () => {
  it('applique les deux langues dans le même lot que les autres séances', async () => {
    const repository = new InMemoryTimetableRepository();
    const useCase = new AppliquerPropositionEmploiDuTempsUseCase(repository, {
      chargerContexte: async () => ({ ...contexte, groupesLV2: seancesGroupes.map(seance => ({ groupId: seance.groupId, groupSetId: 'lv2', groupName: seance.groupName, subjectId: seance.subjectId, teacherId: seance.teacherId, participantsCount: seance.participantsCount })) }),
      calculerSeancesGroupes: async () => seancesGroupes,
    });

    const resultat = await useCase.execute({ timetableId: 'edt-1', schoolId: 'school-1', seances: [], seancesGroupes });

    expect(resultat.creneauxCrees).toBe(2);
    const slots = await repository.findCreneauxByTimetable('edt-1');
    expect(slots).toHaveLength(2);
    expect(slots.every(slot => slot.groupId && slot.isLV2Slot)).toBe(true);
  });
});
