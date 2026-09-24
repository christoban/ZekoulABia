import { describe, expect, it } from 'bun:test';
import { AppliquerPropositionEmploiDuTempsUseCase } from '../../../../src/application/timetable/AppliquerPropositionEmploiDuTempsUseCase.ts';
import type { ContexteEmploiDuTemps } from '../../../../src/application/timetable/ProposerEmploiDuTempsUseCase.ts';
import { InMemoryTimetableRepository } from '../../../helpers/repositories/InMemoryTimetableRepository.ts';
import { CreneauHoraire } from '@domain/entities/CreneauHoraire.ts';

it('rejette une proposition apply EPS avec deux occurrences le même jour', async () => {
  const repository = new InMemoryTimetableRepository();
  const contexte: ContexteEmploiDuTemps = {
    classId: 'classe-1',
    academicYearId: 'annee-1',
    exigences: Array.from({ length: 2 }, () => ({
      subjectId: 'eps',
      subjectType: 'PRACTICAL' as const,
      teacherId: 'prof-1',
      durationMinutes: 60,
      subjectName: 'Éducation Physique et Sportive',
      volumeHebdomadaire: 2,
      nbOccurrencesHebdomadaires: 2,
      categorieJoursDistincts: 'EPS_TM' as const,
      blocDureeCases: 2,
    })),
    grille: [
      { dayOfWeek: 0, startTime: '08:00', endTime: '09:00' },
      { dayOfWeek: 0, startTime: '09:00', endTime: '10:00' },
      { dayOfWeek: 1, startTime: '08:00', endTime: '09:00' },
    ],
    sallesDisponibles: [],
    occupationExistante: [],
    indisponibilitesEnseignants: [],
  };
  const useCase = new AppliquerPropositionEmploiDuTempsUseCase(repository, {
    chargerContexte: async () => contexte,
  });

  await expect(useCase.execute({
    timetableId: 'edt-1',
    schoolId: 'school-1',
    seances: [
      { subjectId: 'eps', teacherId: 'prof-1', roomId: 'terrain', dayOfWeek: 0, startTime: '08:00', endTime: '09:00' },
      { subjectId: 'eps', teacherId: 'prof-1', roomId: 'terrain', dayOfWeek: 0, startTime: '09:00', endTime: '10:00' },
    ],
  })).rejects.toThrow('doit être répartie sur deux jours différents');

  expect(await repository.countCreneaux('edt-1')).toBe(0);
});

it('accepte trois occurrences d’une matière réparties sur deux jours', async () => {
  const repository = new InMemoryTimetableRepository();
  const contexte: ContexteEmploiDuTemps = {
    classId: 'classe-1',
    academicYearId: 'annee-1',
    exigences: Array.from({ length: 3 }, () => ({
      subjectId: 'maths',
      subjectType: 'THEORETICAL' as const,
      teacherId: 'prof-1',
      durationMinutes: 60,
      subjectName: 'Mathématiques',
      volumeHebdomadaire: 3,
      nbOccurrencesHebdomadaires: 3,
    })),
    grille: [
      { dayOfWeek: 0, startTime: '08:00', endTime: '09:00' },
      { dayOfWeek: 0, startTime: '09:00', endTime: '10:00' },
      { dayOfWeek: 1, startTime: '08:00', endTime: '09:00' },
    ],
    sallesDisponibles: [],
    occupationExistante: [],
    indisponibilitesEnseignants: [],
  };
  const useCase = new AppliquerPropositionEmploiDuTempsUseCase(repository, {
    chargerContexte: async () => contexte,
  });

  await useCase.execute({
    timetableId: 'edt-1',
    schoolId: 'school-1',
    seances: [
      { subjectId: 'maths', teacherId: 'prof-1', roomId: 'salle-1', dayOfWeek: 0, startTime: '08:00', endTime: '09:00' },
      { subjectId: 'maths', teacherId: 'prof-1', roomId: 'salle-1', dayOfWeek: 0, startTime: '09:00', endTime: '10:00' },
      { subjectId: 'maths', teacherId: 'prof-1', roomId: 'salle-1', dayOfWeek: 1, startTime: '08:00', endTime: '09:00' },
    ],
  });

  expect(await repository.countCreneaux('edt-1')).toBe(3);
});

it('remplace atomiquement les lignes gérées sans effacer une ligne manuelle hors proposition', async () => {
  const repository = new InMemoryTimetableRepository();
  repository.definirSalle('salle-1', 'Salle 1');
  repository.ajouterCreneau(CreneauHoraire.create({
    timetableId: 'edt-1', roomId: 'salle-1', dayOfWeek: 0, startTime: '08:00', endTime: '09:00',
  }));
  repository.ajouterCreneau(CreneauHoraire.create({
    timetableId: 'edt-1', subjectId: 'manuel', dayOfWeek: 1, startTime: '10:00', endTime: '11:00',
  }));
  const contexte: ContexteEmploiDuTemps = {
    classId: 'classe-1',
    academicYearId: 'annee-1',
    exigences: [{
      subjectId: 'maths', subjectType: 'THEORETICAL', teacherId: 'prof-1', durationMinutes: 60,
      subjectName: 'Mathématiques', volumeHebdomadaire: 1, nbOccurrencesHebdomadaires: 1,
    }],
    grille: [{ dayOfWeek: 0, startTime: '08:00', endTime: '09:00' }],
    sallesDisponibles: [], occupationExistante: [], indisponibilitesEnseignants: [],
  };
  const useCase = new AppliquerPropositionEmploiDuTempsUseCase(repository, { chargerContexte: async () => contexte });

  await useCase.execute({
    timetableId: 'edt-1', schoolId: 'school-1',
    seances: [{ subjectId: 'maths', teacherId: 'prof-1', roomId: 'salle-1', dayOfWeek: 0, startTime: '08:00', endTime: '09:00' }],
  });

  const slots = await repository.findCreneauxByTimetable('edt-1');
  expect(slots).toHaveLength(2);
  expect(slots.some(slot => slot.roomId === 'salle-1' && !slot.subjectId)).toBe(false);
  expect(slots.some(slot => slot.subjectId === 'manuel')).toBe(true);
});
