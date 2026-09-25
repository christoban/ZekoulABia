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

  it('accepte des groupes LV2 sémantiquement identiques avec un ordre JSON différent', async () => {
    const groupe = {
      subjectId: 's1', teacherId: 't2', roomId: 'r2', dayOfWeek: 1, startTime: '08:00', endTime: '09:00',
      groupId: 'g1', groupName: 'LV2', participantsCount: 5, isLV2Slot: true as const,
    };
    proposer = {
      async chargerContexte() {
        return {
          classId: 'class-1', academicYearId: 'year-1',
          exigences: [{ subjectId: 's1', subjectName: 'Math', nbOccurrencesHebdomadaires: 1, teacherIds: ['t1'], roomTypeIds: [], dureeCases: 1 }],
          grille: [{ dayOfWeek: 1, startTime: '08:00', endTime: '09:00', type: 'COURS' }],
          sallesDisponibles: [], occupationExistante: [], indisponibilitesEnseignants: [], groupesLV2: [{}],
        } as unknown as ContexteEmploiDuTemps;
      },
      async calculerSeancesGroupes() { return [groupe]; },
    } as unknown as ProposerEmploiDuTempsUseCase;
    useCase = new AppliquerLotEmploiDuTempsUseCase(timetableRepo, proposer);

    const resultat = await useCase.execute({
      schoolId: 'school-1',
       propositions: [{
         timetableId: 'tt1',
         statut: 'SUCCESS',
         seances: [{ subjectId: 's1', teacherId: 't1', roomId: 'r1', dayOfWeek: 1, startTime: '08:00', endTime: '09:00' }],
        seancesGroupes: [{ roomId: 'r2', endTime: '09:00', groupId: 'g1', dayOfWeek: 1, groupName: 'LV2', isLV2Slot: true, startTime: '08:00', subjectId: 's1', teacherId: 't2', participantsCount: 5 }],
      }],
    });

    expect(resultat.creneauxCrees).toBe(2);
  });

  it('valide les groupes avec l’occupation des propositions précédentes', async () => {
    const grille = [
      { dayOfWeek: 0, startTime: '08:00', endTime: '09:00', type: 'COURS' as const },
      { dayOfWeek: 0, startTime: '14:15', endTime: '15:15', type: 'COURS' as const },
      { dayOfWeek: 1, startTime: '08:00', endTime: '09:00', type: 'COURS' as const },
      { dayOfWeek: 1, startTime: '14:15', endTime: '15:15', type: 'COURS' as const },
    ];
    proposer = {
      async chargerContexte(commande) {
        return {
          classId: 'class-1', academicYearId: 'year-1',
          exigences: [{ subjectId: 's1', subjectName: 'Math', nbOccurrencesHebdomadaires: 1, teacherIds: ['t1'], roomTypeIds: [], dureeCases: 1 }],
          grille,
          sallesDisponibles: [{ roomId: 'r1', type: 'NORMAL', capacity: 40 }], salleHabituelleId: 'r1', salleIdsHabituelles: ['r1'],
          occupationExistante: commande.occupationSupplementaire ?? [], occupationLocale: [], groupesLV2: [{ groupId: 'g1', groupSetId: 'lv2', groupName: 'Arabe', subjectId: 'arabe', teacherId: 'karim-abaa', participantsCount: 5 }], indisponibilitesEnseignants: [],
        } as unknown as ContexteEmploiDuTemps;
      },
      async calculerSeancesGroupes(contexte) {
        const day = contexte.occupationExistante.some(occupe => occupe.teacherId === 'karim-abaa' && occupe.dayOfWeek === 0) ? 1 : 0;
        return [{ subjectId: 'arabe', teacherId: 'karim-abaa', roomId: 'r1', dayOfWeek: day, startTime: '14:15', endTime: '15:15', groupId: 'g1', groupName: 'Arabe', participantsCount: 5, isLV2Slot: true }];
      },
    } as unknown as ProposerEmploiDuTempsUseCase;
    useCase = new AppliquerLotEmploiDuTempsUseCase(timetableRepo, proposer);

    const resultat = await useCase.execute({
      schoolId: 'school-1',
      propositions: [
        { timetableId: 'tt1', statut: 'SUCCESS' as const, seances: [{ subjectId: 's1', teacherId: 't1', roomId: 'r1', dayOfWeek: 0, startTime: '08:00', endTime: '09:00' }], seancesGroupes: [{ subjectId: 'arabe', teacherId: 'karim-abaa', roomId: 'r1', dayOfWeek: 0, startTime: '14:15', endTime: '15:15', groupId: 'g1', groupName: 'Arabe', participantsCount: 5, isLV2Slot: true }] },
        { timetableId: 'tt2', statut: 'SUCCESS' as const, seances: [{ subjectId: 's1', teacherId: 't1', roomId: 'r1', dayOfWeek: 1, startTime: '08:00', endTime: '09:00' }], seancesGroupes: [{ subjectId: 'arabe', teacherId: 'karim-abaa', roomId: 'r1', dayOfWeek: 1, startTime: '14:15', endTime: '15:15', groupId: 'g1', groupName: 'Arabe', participantsCount: 5, isLV2Slot: true }] },
      ],
    });

    expect(resultat.creneauxCrees).toBe(8);
  });

  it('refuse une proposition PARTIEL sans confirmation explicite', async () => {
    await expect(useCase.execute({
      schoolId: 'school-1',
      propositions: [{ timetableId: 'tt1', statut: 'PARTIEL', seances: [{ subjectId: 's1', teacherId: 't1', roomId: 'r1', dayOfWeek: 1, startTime: '08:00', endTime: '09:00' }] }],
    })).rejects.toThrow('confirmation explicite requise');
  });

  it('applique une proposition PARTIEL explicitement confirmée', async () => {
    const resultat = await useCase.execute({
      schoolId: 'school-1',
      propositions: [{ timetableId: 'tt1', statut: 'PARTIEL', confirmationPartiel: true, seances: [{ subjectId: 's1', teacherId: 't1', roomId: 'r1', dayOfWeek: 1, startTime: '08:00', endTime: '09:00' }] }],
    });
    expect(resultat.creneauxCrees).toBe(2);
  });

  it('applique plusieurs propositions en un seul lot atomique', async () => {
    const resultat = await useCase.execute({
      schoolId: 'school-1',
      propositions: [
        { timetableId: 'tt1', statut: 'SUCCESS' as const, seances: [{ subjectId: 's1', teacherId: 't1', roomId: 'r1', dayOfWeek: 1, startTime: '08:00', endTime: '09:00' }] },
        { timetableId: 'tt2', statut: 'SUCCESS' as const, seances: [{ subjectId: 's1', teacherId: 't1', roomId: 'r1', dayOfWeek: 2, startTime: '08:00', endTime: '09:00' }] },
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
