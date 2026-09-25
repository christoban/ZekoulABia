import { describe, it, expect, beforeEach } from 'bun:test';
import { AppliquerLotEmploiDuTempsUseCase } from '../../../../src/application/timetable/AppliquerLotEmploiDuTempsUseCase.ts';
import { InMemoryTimetableRepository } from '../../../helpers/repositories/InMemoryTimetableRepository.ts';
import type { ProposerEmploiDuTempsUseCase } from '../../../../src/application/timetable/ProposerEmploiDuTempsUseCase.ts';
import type { ContexteEmploiDuTemps } from '../../../../src/application/timetable/ProposerEmploiDuTempsUseCase.ts';

describe('AppliquerLotEmploiDuTempsUseCase', () => {
  let timetableRepo: InMemoryTimetableRepository;
  let proposer: ProposerEmploiDuTempsUseCase;
  let useCase: AppliquerLotEmploiDuTempsUseCase;
  let applyCalls: unknown[];

  beforeEach(() => {
    timetableRepo = new InMemoryTimetableRepository();
    applyCalls = [];
    const original = timetableRepo.appliquerCreneauxLotsEnAtomique.bind(timetableRepo);
    timetableRepo.appliquerCreneauxLotsEnAtomique = async (schoolId, lots) => {
      applyCalls.push({ schoolId, lots });
      return original(schoolId, lots);
    };
    proposer = {
      async chargerContexte() {
        return {
          classId: 'class-1',
          academicYearId: 'year-1',
          exigences: [{ subjectId: 's1', subjectName: 'Math', nbOccurrencesHebdomadaires: 1, teacherIds: ['t1'], roomTypeIds: [], dureeCases: 1 }],
          grille: [
            { dayOfWeek: 1, startTime: '08:00', endTime: '09:00', type: 'COURS' },
            { dayOfWeek: 2, startTime: '08:00', endTime: '09:00', type: 'COURS' },
          ],
          sallesDisponibles: [],
          occupationExistante: [],
          indisponibilitesEnseignants: [],
          groupesLV2: [],
        } as unknown as ContexteEmploiDuTemps;
      },
      async calculerSeancesGroupes() { return []; },
    } as unknown as ProposerEmploiDuTempsUseCase;
    useCase = new AppliquerLotEmploiDuTempsUseCase(timetableRepo, proposer);
  });

  it('applique plusieurs propositions en un seul lot atomique', async () => {
    const resultat = await useCase.execute({
      schoolId: 'school-1',
      propositions: [
        { timetableId: 'tt1', seances: [{ subjectId: 's1', teacherId: 't1', roomId: 'r1', dayOfWeek: 1, startTime: '08:00', endTime: '09:00' }] },
        { timetableId: 'tt2', seances: [{ subjectId: 's1', teacherId: 't1', roomId: 'r1', dayOfWeek: 2, startTime: '08:00', endTime: '09:00' }] },
      ],
    });
    expect(resultat.creneauxCrees).toBe(4);
    expect(applyCalls).toHaveLength(1);
    const call = applyCalls[0] as { lots: Array<{ timetableId: string; creneaux: unknown[] }> };
    expect(call.lots).toHaveLength(2);
    expect(call.lots[0].creneaux).toHaveLength(2);
    expect(call.lots[1].creneaux).toHaveLength(2);
  });
});
