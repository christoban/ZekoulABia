import { describe, expect, it } from 'bun:test';
import { ORToolsWasmAdapter } from '../../../src/infrastructure/scheduling/ORToolsWasmAdapter.ts';

const adapter = new ORToolsWasmAdapter();

describe('placement PARTIEL', () => {
  it('maximise les heures placées et expose les heures non placées', async () => {
    const resultat = await adapter.proposer({
      classId: 'classe-partiel',
      exigences: [
        { subjectId: 'maths', subjectType: 'THEORETICAL', teacherId: 'gaelle', durationMinutes: 60, subjectName: 'Mathématiques', teacherName: 'Gaelle', seanceId: 'maths-1', nbOccurrencesHebdomadaires: 1 },
        { subjectId: 'informatique', subjectType: 'THEORETICAL', teacherId: 'gaelle', durationMinutes: 60, subjectName: 'Informatique', teacherName: 'Gaelle', seanceId: 'informatique-1', nbOccurrencesHebdomadaires: 1 },
      ],
      grille: [{ dayOfWeek: 0, startTime: '08:00', endTime: '09:00' }],
      sallesDisponibles: [{ roomId: 'salle-1', type: 'NORMAL', capacity: 40 }],
      occupationExistante: [],
      contraintes: { reglesPedagogiques: false },
      placementPartiel: true,
      maxDeterministicTime: 1,
    });
    expect(resultat.statut).toBe('PARTIEL');
    expect(resultat.seances).toHaveLength(1);
    expect(resultat.heuresNonPlacees).toHaveLength(1);
    expect(resultat.heuresNonPlacees![0]).toMatchObject({ teacherId: 'gaelle', teacherName: 'Gaelle', nbHeures: 1, cause: 'Aucune case libre compatible après maximisation des séances placées.' });
    expect(['maths', 'informatique']).toContain(resultat.heuresNonPlacees![0]!.subjectId);
  });
});
