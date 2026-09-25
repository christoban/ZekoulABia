import { describe, expect, it } from 'bun:test';
import { ProposerEmploiDuTempsUseCase } from '../../../../src/application/timetable/ProposerEmploiDuTempsUseCase.ts';
import type { ContexteEmploiDuTemps } from '../../../../src/application/timetable/ProposerEmploiDuTempsUseCase.ts';
import { InMemoryTimetableRepository } from '../../../helpers/repositories/InMemoryTimetableRepository.ts';
import type { RoomRepository } from '@domain/ports/repositories/RoomRepository.ts';
import type { ClassRoomAssignmentRepository } from '@domain/ports/repositories/ClassRoomAssignmentRepository.ts';
import type { TeacherUnavailabilityRepository } from '@domain/ports/repositories/TeacherUnavailabilityRepository.ts';
import type { SchedulingSolverPort } from '@domain/ports/services/SchedulingSolverPort.ts';
import type { SchedulingGridPort } from '@domain/ports/services/SchedulingGridPort.ts';

const contexte: ContexteEmploiDuTemps = {
  classId: '4e-c',
  academicYearId: '2026-2027',
  salleHabituelleId: 'salle-4e-c',
  exigences: [],
  grille: [{ dayOfWeek: 0, startTime: '08:00', endTime: '09:00' }],
  sallesDisponibles: [
    { roomId: 'salle-4e-c', type: 'NORMAL', capacity: 40 },
    { roomId: 'salle-secours-1', type: 'NORMAL', capacity: 20 },
  ],
  occupationExistante: [],
  occupationLocale: [],
  salleIdsHabituelles: ['salle-4e-c'],
  groupesLV2: [
    { groupId: 'groupe-arabe', groupSetId: 'lv2', groupName: 'Arabe', subjectId: 'arabe', teacherId: 'prof-arabe', participantsCount: 5 },
    { groupId: 'groupe-chinois', groupSetId: 'lv2', groupName: 'Chinois', subjectId: 'chinois', teacherId: 'prof-chinois', participantsCount: 5 },
  ],
  indisponibilitesEnseignants: [],
};

const useCase = new ProposerEmploiDuTempsUseCase(
  new InMemoryTimetableRepository(),
  {} as RoomRepository,
  {} as ClassRoomAssignmentRepository,
  {} as TeacherUnavailabilityRepository,
  {} as SchedulingSolverPort,
  {} as SchedulingGridPort,
);

describe('Proposition des séances LV2', () => {
  it('refuse deux groupes LV2 qui partagent le même enseignant au même horaire', async () => {
    const contextePartage = {
      ...contexte,
      groupesLV2: contexte.groupesLV2?.map(groupe => ({ ...groupe, teacherId: 'prof-arabe' })),
    };

    await expect(useCase.calculerSeancesGroupes(contextePartage, [])).rejects.toThrow('Aucune case de la grille');
  });

  it('place les langues au même horaire et réserve la salle principale au groupe majoritaire', async () => {
    const seances = await useCase.calculerSeancesGroupes(contexte, []);

    expect(seances).toHaveLength(2);
    expect(seances[0]!.groupId).toBe('groupe-arabe');
    expect(seances[1]!.groupId).toBe('groupe-chinois');
    expect(seances[0]!.roomId).toBe('salle-4e-c');
    expect(seances[1]!.roomId).toBe('salle-secours-1');
    expect(seances[0]!.dayOfWeek).toBe(seances[1]!.dayOfWeek);
     expect(seances[0]!.startTime).toBe(seances[1]!.startTime);
     expect(seances[0]!.endTime).toBe(seances[1]!.endTime);
    expect(seances.every(seance => seance.isLV2Slot)).toBe(true);
  });
});
