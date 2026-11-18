import { describe, it, expect } from 'bun:test';
import { BulletinSnapshotBuilder } from '@domain/services/bulletin/BulletinSnapshotBuilder';
import type {
  BulletinSnapshotBuildInput,
  SnapshotNoteInput,
  SnapshotSequenceInput,
  SnapshotSubjectInput,
} from '@domain/types/bulletinSnapshot';

/**
 * TESTS DE VÉRITÉ MATHÉMATIQUE — Atelier de Bulletins (Étape 1)
 *
 * Chaque jeu de données ci-dessous a été calculé intégralement à la main.
 * Aucun écart n'est toléré.
 */

describe('BulletinSnapshotBuilder — Jeux de vérité calculés à la main', () => {
  // =========================================================================
  // JEU 1 — SECONDAIRE GÉNÉRAL AVEC LV2, SÉQUENCES ASYMÉTRIQUES ET EX ÆQUO
  // =========================================================================
  describe('Jeu 1 : Secondaire général (LV2 filtrée, séquences asymétriques, groupes, ex æquo)', () => {
    const sequences: SnapshotSequenceInput[] = [
      { id: 'seq-1', name: 'SÉQ 1', orderIndex: 1 },
      { id: 'seq-2', name: 'SÉQ 2', orderIndex: 2 },
    ];

    const subjects: SnapshotSubjectInput[] = [
      { id: 'fran', name: 'Français', coefficient: 4, groupKey: 'GRP1', groupLabel: '1er Groupe', groupOrder: 1 },
      { id: 'esp', name: 'Espagnol', coefficient: 2, isLV2: true, groupKey: 'GRP1', groupLabel: '1er Groupe', groupOrder: 1 },
      { id: 'all', name: 'Allemand', coefficient: 2, isLV2: true, groupKey: 'GRP1', groupLabel: '1er Groupe', groupOrder: 1 },
      { id: 'math', name: 'Mathématiques', coefficient: 4, groupKey: 'GRP2', groupLabel: '2e Groupe', groupOrder: 2 },
      { id: 'eps', name: 'Éducation Physique', coefficient: 2, groupKey: 'GRP3', groupLabel: '3e Groupe', groupOrder: 3 },
    ];

    const notes: SnapshotNoteInput[] = [
      // E1 (LV2 = ESP). A une note parasite 02/20 en ALL qui doit être exclue !
      // EPS n'a qu'une seule séquence saisie (seq-1 = 18).
      { studentId: 'E1', subjectId: 'fran', sequenceId: 'seq-1', coefficient: 4, sequenceScore: 10, sequenceAverage: 10, validationStatus: 'LOCKED' },
      { studentId: 'E1', subjectId: 'fran', sequenceId: 'seq-2', coefficient: 4, sequenceScore: 14, sequenceAverage: 14, validationStatus: 'LOCKED' },
      { studentId: 'E1', subjectId: 'esp', sequenceId: 'seq-1', coefficient: 2, sequenceScore: 12, sequenceAverage: 12, validationStatus: 'LOCKED' },
      { studentId: 'E1', subjectId: 'esp', sequenceId: 'seq-2', coefficient: 2, sequenceScore: 12, sequenceAverage: 12, validationStatus: 'LOCKED' },
      { studentId: 'E1', subjectId: 'all', sequenceId: 'seq-1', coefficient: 2, sequenceScore: 2, sequenceAverage: 2, validationStatus: 'LOCKED' },
      { studentId: 'E1', subjectId: 'all', sequenceId: 'seq-2', coefficient: 2, sequenceScore: 2, sequenceAverage: 2, validationStatus: 'LOCKED' },
      { studentId: 'E1', subjectId: 'math', sequenceId: 'seq-1', coefficient: 4, sequenceScore: 15, sequenceAverage: 15, validationStatus: 'LOCKED' },
      { studentId: 'E1', subjectId: 'math', sequenceId: 'seq-2', coefficient: 4, sequenceScore: 15, sequenceAverage: 15, validationStatus: 'LOCKED' },
      { studentId: 'E1', subjectId: 'eps', sequenceId: 'seq-1', coefficient: 2, sequenceScore: 18, sequenceAverage: 18, validationStatus: 'LOCKED' },

      // E2 (LV2 = ALL). Ex æquo avec E1 en Français (12.00) et ex æquo avec E3 en EPS (10.00).
      { studentId: 'E2', subjectId: 'fran', sequenceId: 'seq-1', coefficient: 4, sequenceScore: 12, sequenceAverage: 12, validationStatus: 'LOCKED' },
      { studentId: 'E2', subjectId: 'fran', sequenceId: 'seq-2', coefficient: 4, sequenceScore: 12, sequenceAverage: 12, validationStatus: 'LOCKED' },
      { studentId: 'E2', subjectId: 'all', sequenceId: 'seq-1', coefficient: 2, sequenceScore: 10, sequenceAverage: 10, validationStatus: 'LOCKED' },
      { studentId: 'E2', subjectId: 'all', sequenceId: 'seq-2', coefficient: 2, sequenceScore: 14, sequenceAverage: 14, validationStatus: 'LOCKED' },
      { studentId: 'E2', subjectId: 'math', sequenceId: 'seq-1', coefficient: 4, sequenceScore: 9, sequenceAverage: 9, validationStatus: 'LOCKED' },
      { studentId: 'E2', subjectId: 'math', sequenceId: 'seq-2', coefficient: 4, sequenceScore: 11, sequenceAverage: 11, validationStatus: 'LOCKED' },
      { studentId: 'E2', subjectId: 'eps', sequenceId: 'seq-1', coefficient: 2, sequenceScore: 10, sequenceAverage: 10, validationStatus: 'LOCKED' },
      { studentId: 'E2', subjectId: 'eps', sequenceId: 'seq-2', coefficient: 2, sequenceScore: 10, sequenceAverage: 10, validationStatus: 'LOCKED' },

      // E3 (LV2 = ESP). Moyenne < 10 -> non admis.
      { studentId: 'E3', subjectId: 'fran', sequenceId: 'seq-1', coefficient: 4, sequenceScore: 8, sequenceAverage: 8, validationStatus: 'LOCKED' },
      { studentId: 'E3', subjectId: 'fran', sequenceId: 'seq-2', coefficient: 4, sequenceScore: 8, sequenceAverage: 8, validationStatus: 'LOCKED' },
      { studentId: 'E3', subjectId: 'esp', sequenceId: 'seq-1', coefficient: 2, sequenceScore: 10, sequenceAverage: 10, validationStatus: 'LOCKED' },
      { studentId: 'E3', subjectId: 'esp', sequenceId: 'seq-2', coefficient: 2, sequenceScore: 10, sequenceAverage: 10, validationStatus: 'LOCKED' },
      { studentId: 'E3', subjectId: 'math', sequenceId: 'seq-1', coefficient: 4, sequenceScore: 9, sequenceAverage: 9, validationStatus: 'LOCKED' },
      { studentId: 'E3', subjectId: 'math', sequenceId: 'seq-2', coefficient: 4, sequenceScore: 9, sequenceAverage: 9, validationStatus: 'LOCKED' },
      { studentId: 'E3', subjectId: 'eps', sequenceId: 'seq-1', coefficient: 2, sequenceScore: 10, sequenceAverage: 10, validationStatus: 'LOCKED' },
      { studentId: 'E3', subjectId: 'eps', sequenceId: 'seq-2', coefficient: 2, sequenceScore: 10, sequenceAverage: 10, validationStatus: 'LOCKED' },
    ];

    const input: BulletinSnapshotBuildInput = {
      students: [
        { id: 'E1', lv2SubjectId: 'esp' },
        { id: 'E2', lv2SubjectId: 'all' },
        { id: 'E3', lv2SubjectId: 'esp' },
      ],
      subjects,
      sequences,
      notes,
      hasCoefficientBySubject: true,
      passThresholdOn20: 10,
    };

    it('calcule les moyennes pondérées exactes (et non la moyenne à plat buggée)', () => {
      const res = BulletinSnapshotBuilder.buildClassSnapshots(input);

      // E1 : (12*4 + 12*2 + 15*4 + 18*2) / (4+2+4+2) = 168 / 12 = 14.00
      // (L'ancien calcul à plat donnait 11.85 à cause de ALL parasite + EPS sur 1 note)
      const s1 = res.snapshotsByStudentId.get('E1')!;
      expect(s1.generalAverage).toBe(14);
      expect(s1.totalCoefficient).toBe(12);
      expect(s1.totalWeightedScore).toBe(168);
      expect(s1.rank).toBe(1);
      expect(s1.totalStudents).toBe(3);

      // La note parasite ALL ne doit PAS figurer sur le bulletin de E1
      expect(s1.subjectLines.find((l) => l.subjectId === 'all')).toBeUndefined();
      expect(s1.subjectLines.find((l) => l.subjectId === 'esp')?.subjectName).toBe('Espagnol (LV2)');

      // E2 : (12*4 + 12*2 + 10*4 + 10*2) / 12 = 132 / 12 = 11.00
      const s2 = res.snapshotsByStudentId.get('E2')!;
      expect(s2.generalAverage).toBe(11);
      expect(s2.rank).toBe(2);

      // E3 : (8*4 + 10*2 + 9*4 + 10*2) / 12 = 108 / 12 = 9.00
      const s3 = res.snapshotsByStudentId.get('E3')!;
      expect(s3.generalAverage).toBe(9);
      expect(s3.rank).toBe(3);
    });

    it('remplit weightedScore, les rangs par matière (avec ex æquo) et moyennes de classe par matière', () => {
      const res = BulletinSnapshotBuilder.buildClassSnapshots(input);
      const s1 = res.snapshotsByStudentId.get('E1')!;
      const s2 = res.snapshotsByStudentId.get('E2')!;
      const s3 = res.snapshotsByStudentId.get('E3')!;

      // Totaux pondérés (weightedScore) jamais vides
      const fran1 = s1.subjectLines.find((l) => l.subjectId === 'fran')!;
      expect(fran1.subjectAverage).toBe(12);
      expect(fran1.weightedScore).toBe(48);
      expect(fran1.subjectRank).toBe(1);
      expect(fran1.classSubjectAverage).toBe(10.67); // (12 + 12 + 8) / 3

      // Ex æquo en Français : E1=12 (1er), E2=12 (1er), E3=8 (3ème)
      const fran2 = s2.subjectLines.find((l) => l.subjectId === 'fran')!;
      const fran3 = s3.subjectLines.find((l) => l.subjectId === 'fran')!;
      expect(fran2.subjectRank).toBe(1);
      expect(fran3.subjectRank).toBe(3);

      // Ex æquo en EPS : E1=18 (1er), E2=10 (2ème), E3=10 (2ème)
      expect(s1.subjectLines.find((l) => l.subjectId === 'eps')!.subjectRank).toBe(1);
      expect(s2.subjectLines.find((l) => l.subjectId === 'eps')!.subjectRank).toBe(2);
      expect(s3.subjectLines.find((l) => l.subjectId === 'eps')!.subjectRank).toBe(2);

      // Moyenne classe en ALL : seul E2 fait ALL (E1 exclu malgré note parasite) → moy = 12.00 sur 1 élève
      const all2 = s2.subjectLines.find((l) => l.subjectId === 'all')!;
      expect(all2.classSubjectAverage).toBe(12);
      expect(all2.subjectTotalStudents).toBe(1);
    });

    it('calcule les sous-totaux de groupes et le profil de classe exact', () => {
      const res = BulletinSnapshotBuilder.buildClassSnapshots(input);
      const s1 = res.snapshotsByStudentId.get('E1')!;

      expect(s1.groupSummaries).toHaveLength(3);
      expect(s1.groupSummaries[0]).toMatchObject({
        groupKey: 'GRP1',
        totalCoefficient: 6,
        totalWeightedScore: 72,
        groupAverage: 12,
        groupRank: 1,
      });
      expect(s1.groupSummaries[1]).toMatchObject({
        groupKey: 'GRP2',
        totalCoefficient: 4,
        totalWeightedScore: 60,
        groupAverage: 15,
        groupRank: 1,
      });
      expect(s1.groupSummaries[2]).toMatchObject({
        groupKey: 'GRP3',
        totalCoefficient: 2,
        totalWeightedScore: 36,
        groupAverage: 18,
        groupRank: 1,
      });

      // Profil de classe : (14 + 11 + 9)/3 = 11.33, top=14, low=9, admis=2/3 (66.67%)
      expect(res.classProfile).toEqual({
        classSize: 3,
        classAverage: 11.33,
        topAverage: 14,
        lowAverage: 9,
        passCount: 2,
        passRate: 66.67,
      });
    });
  });

  // =========================================================================
  // JEU 2 — ENSEIGNEMENT TECHNIQUE (GÉNÉRAL / PROFESSIONNEL / DIVERS)
  // =========================================================================
  describe('Jeu 2 : Enseignement Technique (Général / Professionnel / Divers)', () => {
    const sequences: SnapshotSequenceInput[] = [
      { id: 's1', name: 'EVAL 1', orderIndex: 1 },
      { id: 's2', name: 'EVAL 2', orderIndex: 2 },
    ];

    const subjects: SnapshotSubjectInput[] = [
      { id: 'math', name: 'Mathématiques Appliquées', coefficient: 3, groupKey: 'GENERAL', groupLabel: 'Enseignement Général', groupOrder: 1 },
      { id: 'atelier', name: 'Travaux Pratiques Atelier', coefficient: 5, groupKey: 'PROFESSIONNEL', groupLabel: 'Enseignement Professionnel', groupOrder: 2 },
      { id: 'dessin', name: 'Dessin Industriel', coefficient: 4, groupKey: 'PROFESSIONNEL', groupLabel: 'Enseignement Professionnel', groupOrder: 2 },
      { id: 'eps', name: 'EPS', coefficient: 1, groupKey: 'DIVERS', groupLabel: 'Divers', groupOrder: 3 },
    ];

    // Note : pour 'atelier', sequenceAverage est volontairement null pour vérifier le calcul
    // via GradingEngine.calculerMoyenneSequence((theoretical + practical) / 2) !
    const notes: SnapshotNoteInput[] = [
      // T1
      { studentId: 'T1', subjectId: 'math', sequenceId: 's1', coefficient: 3, sequenceScore: 14, sequenceAverage: 14, validationStatus: 'LOCKED' },
      { studentId: 'T1', subjectId: 'math', sequenceId: 's2', coefficient: 3, sequenceScore: 16, sequenceAverage: 16, validationStatus: 'LOCKED' },
      { studentId: 'T1', subjectId: 'atelier', sequenceId: 's1', coefficient: 5, theoreticalScore: 12, practicalScore: 16, professionalAttitude: 17, validationStatus: 'LOCKED' },
      { studentId: 'T1', subjectId: 'atelier', sequenceId: 's2', coefficient: 5, theoreticalScore: 14, practicalScore: 18, professionalAttitude: 18, validationStatus: 'LOCKED' },
      { studentId: 'T1', subjectId: 'dessin', sequenceId: 's1', coefficient: 4, sequenceScore: 12, sequenceAverage: 12, validationStatus: 'LOCKED' },
      { studentId: 'T1', subjectId: 'dessin', sequenceId: 's2', coefficient: 4, sequenceScore: 12, sequenceAverage: 12, validationStatus: 'LOCKED' },
      { studentId: 'T1', subjectId: 'eps', sequenceId: 's1', coefficient: 1, sequenceScore: 13, sequenceAverage: 13, validationStatus: 'LOCKED' },

      // T2
      { studentId: 'T2', subjectId: 'math', sequenceId: 's1', coefficient: 3, sequenceScore: 10, sequenceAverage: 10, validationStatus: 'LOCKED' },
      { studentId: 'T2', subjectId: 'math', sequenceId: 's2', coefficient: 3, sequenceScore: 12, sequenceAverage: 12, validationStatus: 'LOCKED' },
      { studentId: 'T2', subjectId: 'atelier', sequenceId: 's1', coefficient: 5, theoreticalScore: 8, practicalScore: 10, professionalAttitude: 12, validationStatus: 'LOCKED' },
      { studentId: 'T2', subjectId: 'atelier', sequenceId: 's2', coefficient: 5, theoreticalScore: 10, practicalScore: 12, professionalAttitude: 13, validationStatus: 'LOCKED' },
      { studentId: 'T2', subjectId: 'dessin', sequenceId: 's1', coefficient: 4, sequenceScore: 12, sequenceAverage: 12, validationStatus: 'LOCKED' },
      { studentId: 'T2', subjectId: 'dessin', sequenceId: 's2', coefficient: 4, sequenceScore: 12, sequenceAverage: 12, validationStatus: 'LOCKED' },
      { studentId: 'T2', subjectId: 'eps', sequenceId: 's1', coefficient: 1, sequenceScore: 15, sequenceAverage: 15, validationStatus: 'LOCKED' },
    ];

    it('calcule correctement les 3 blocs techniques (Général / Professionnel / Divers) et leurs rangs', () => {
      const res = BulletinSnapshotBuilder.buildClassSnapshots({
        students: [{ id: 'T1' }, { id: 'T2' }],
        subjects,
        sequences,
        notes,
        hasCoefficientBySubject: true,
      });

      const t1 = res.snapshotsByStudentId.get('T1')!;
      const t2 = res.snapshotsByStudentId.get('T2')!;

      // T1 Atelier : ((12+16)/2 = 14) et ((14+18)/2 = 16) → moy 15.00 × 5 = 75.00
      const t1Atelier = t1.subjectLines.find((l) => l.subjectId === 'atelier')!;
      expect(t1Atelier.subjectAverage).toBe(15);
      expect(t1Atelier.weightedScore).toBe(75);
      expect(t1Atelier.theoreticalScore).toBe(14);
      expect(t1Atelier.practicalScore).toBe(18);
      expect(t1Atelier.professionalAttitude).toBe(18);

      // T1 moyenne générale : (15*3 + 15*5 + 12*4 + 13*1) / 13 = 181 / 13 = 13.92
      expect(t1.generalAverage).toBe(13.92);
      expect(t1.rank).toBe(1);
      expect(t1.groupSummaries).toEqual([
        { groupKey: 'GENERAL', groupLabel: 'Enseignement Général', groupOrder: 1, totalCoefficient: 3, totalWeightedScore: 45, groupAverage: 15, groupRank: 1, groupTotalStudents: 2 },
        { groupKey: 'PROFESSIONNEL', groupLabel: 'Enseignement Professionnel', groupOrder: 2, totalCoefficient: 9, totalWeightedScore: 123, groupAverage: 13.67, groupRank: 1, groupTotalStudents: 2 },
        { groupKey: 'DIVERS', groupLabel: 'Divers', groupOrder: 3, totalCoefficient: 1, totalWeightedScore: 13, groupAverage: 13, groupRank: 2, groupTotalStudents: 2 },
      ]);

      // T2 moyenne générale : (11*3 + 10*5 + 12*4 + 15*1) / 13 = 146 / 13 = 11.23
      expect(t2.generalAverage).toBe(11.23);
      expect(t2.rank).toBe(2);
      expect(t2.groupSummaries[2].groupRank).toBe(1); // T2 est 1er en Divers (15 vs 13)
    });
  });

  // =========================================================================
  // JEU 3 — BULLETIN ANNUEL (6 SÉQUENCES SUR 3 TRIMESTRES DEPUIS NOTES SOURCES)
  // =========================================================================
  describe('Jeu 3 : Bulletin Annuel (6 séquences, politique configurable, rangs trimestriels)', () => {
    const sequences: SnapshotSequenceInput[] = [
      { id: 'q1', name: 'SÉQ 1', orderIndex: 1, termIndex: 1 },
      { id: 'q2', name: 'SÉQ 2', orderIndex: 2, termIndex: 1 },
      { id: 'q3', name: 'SÉQ 3', orderIndex: 3, termIndex: 2 },
      { id: 'q4', name: 'SÉQ 4', orderIndex: 4, termIndex: 2 },
      { id: 'q5', name: 'SÉQ 5', orderIndex: 5, termIndex: 3 },
      { id: 'q6', name: 'SÉQ 6', orderIndex: 6, termIndex: 3 },
    ];

    const subjects: SnapshotSubjectInput[] = [
      { id: 'fran', name: 'Français', coefficient: 3, groupKey: 'GRP1', groupLabel: 'Littéraire', groupOrder: 1 },
      { id: 'math', name: 'Mathématiques', coefficient: 5, groupKey: 'GRP2', groupLabel: 'Scientifique', groupOrder: 2 },
    ];

    const notes: SnapshotNoteInput[] = [
      // A1 : séquences -> 10, 12, 14, 15, 16, 11 -> somme 78 / 6 = 13.00
      { studentId: 'A1', subjectId: 'fran', sequenceId: 'q1', coefficient: 3, sequenceScore: 10, sequenceAverage: 10, validationStatus: 'LOCKED' },
      { studentId: 'A1', subjectId: 'math', sequenceId: 'q1', coefficient: 5, sequenceScore: 10, sequenceAverage: 10, validationStatus: 'LOCKED' },
      { studentId: 'A1', subjectId: 'fran', sequenceId: 'q2', coefficient: 3, sequenceScore: 12, sequenceAverage: 12, validationStatus: 'LOCKED' },
      { studentId: 'A1', subjectId: 'math', sequenceId: 'q2', coefficient: 5, sequenceScore: 12, sequenceAverage: 12, validationStatus: 'LOCKED' },
      { studentId: 'A1', subjectId: 'fran', sequenceId: 'q3', coefficient: 3, sequenceScore: 14, sequenceAverage: 14, validationStatus: 'LOCKED' },
      { studentId: 'A1', subjectId: 'math', sequenceId: 'q3', coefficient: 5, sequenceScore: 14, sequenceAverage: 14, validationStatus: 'LOCKED' },
      { studentId: 'A1', subjectId: 'fran', sequenceId: 'q4', coefficient: 3, sequenceScore: 10, sequenceAverage: 10, validationStatus: 'LOCKED' },
      { studentId: 'A1', subjectId: 'math', sequenceId: 'q4', coefficient: 5, sequenceScore: 18, sequenceAverage: 18, validationStatus: 'LOCKED' },
      { studentId: 'A1', subjectId: 'fran', sequenceId: 'q5', coefficient: 3, sequenceScore: 16, sequenceAverage: 16, validationStatus: 'LOCKED' },
      { studentId: 'A1', subjectId: 'math', sequenceId: 'q5', coefficient: 5, sequenceScore: 16, sequenceAverage: 16, validationStatus: 'LOCKED' },
      { studentId: 'A1', subjectId: 'fran', sequenceId: 'q6', coefficient: 3, sequenceScore: 11, sequenceAverage: 11, validationStatus: 'LOCKED' },
      { studentId: 'A1', subjectId: 'math', sequenceId: 'q6', coefficient: 5, sequenceScore: 11, sequenceAverage: 11, validationStatus: 'LOCKED' },

      // A2 : séquences -> 13, 12 (car Math absent en q2!), 10, 10, 14, 15 -> (13+12+10+10+14+15)/6 = 12.33
      // Alors que par moyennes matières pondérées : FRAN=10.67, MATH=13.60 -> (10.67*3 + 13.60*5)/8 = 12.50
      { studentId: 'A2', subjectId: 'fran', sequenceId: 'q1', coefficient: 3, sequenceScore: 8, sequenceAverage: 8, validationStatus: 'LOCKED' },
      { studentId: 'A2', subjectId: 'math', sequenceId: 'q1', coefficient: 5, sequenceScore: 16, sequenceAverage: 16, validationStatus: 'LOCKED' },
      { studentId: 'A2', subjectId: 'fran', sequenceId: 'q2', coefficient: 3, sequenceScore: 12, sequenceAverage: 12, validationStatus: 'LOCKED' },
      { studentId: 'A2', subjectId: 'math', sequenceId: 'q2', coefficient: 5, sequenceScore: 19, sequenceAverage: 19, validationStatus: 'LOCKED', isAbsentGrade: true },
      { studentId: 'A2', subjectId: 'fran', sequenceId: 'q3', coefficient: 3, sequenceScore: 10, sequenceAverage: 10, validationStatus: 'LOCKED' },
      { studentId: 'A2', subjectId: 'math', sequenceId: 'q3', coefficient: 5, sequenceScore: 10, sequenceAverage: 10, validationStatus: 'LOCKED' },
      { studentId: 'A2', subjectId: 'fran', sequenceId: 'q4', coefficient: 3, sequenceScore: 10, sequenceAverage: 10, validationStatus: 'LOCKED' },
      { studentId: 'A2', subjectId: 'math', sequenceId: 'q4', coefficient: 5, sequenceScore: 10, sequenceAverage: 10, validationStatus: 'LOCKED' },
      { studentId: 'A2', subjectId: 'fran', sequenceId: 'q5', coefficient: 3, sequenceScore: 14, sequenceAverage: 14, validationStatus: 'LOCKED' },
      { studentId: 'A2', subjectId: 'math', sequenceId: 'q5', coefficient: 5, sequenceScore: 14, sequenceAverage: 14, validationStatus: 'LOCKED' },
      { studentId: 'A2', subjectId: 'fran', sequenceId: 'q6', coefficient: 3, sequenceScore: 10, sequenceAverage: 10, validationStatus: 'LOCKED' },
      { studentId: 'A2', subjectId: 'math', sequenceId: 'q6', coefficient: 5, sequenceScore: 18, sequenceAverage: 18, validationStatus: 'LOCKED' },
    ];

    it('reconstruit seq1..seq6 depuis les notes sources et applique la politique SIX_SEQUENCES_ARITHMETIC par défaut', () => {
      const res = BulletinSnapshotBuilder.buildClassSnapshots({
        students: [{ id: 'A1' }, { id: 'A2' }],
        subjects,
        sequences,
        notes,
        hasCoefficientBySubject: true,
        isAnnual: true,
      });

      const a1 = res.snapshotsByStudentId.get('A1')!;
      const a2 = res.snapshotsByStudentId.get('A2')!;

      // Séquences 1..6 bien renseignées sur la ligne matière (ne perd jamais seq3..seq6)
      const a1Fran = a1.subjectLines.find((l) => l.subjectId === 'fran')!;
      expect([a1Fran.seq1Score, a1Fran.seq2Score, a1Fran.seq3Score, a1Fran.seq4Score, a1Fran.seq5Score, a1Fran.seq6Score])
        .toEqual([10, 12, 14, 10, 16, 11]);
      expect(a1Fran.subjectAverage).toBe(12.17);
      expect(a1Fran.weightedScore).toBe(36.51); // 12.17 * 3

      // A1 : (10+12+14+15+16+11)/6 = 13.00
      expect(a1.generalAverage).toBe(13);
      expect(a1.rank).toBe(1);

      // A2 : (13+12+10+10+14+15)/6 = 74/6 = 12.33 (politique 6 séquences par défaut)
      expect(a2.generalAverage).toBe(12.33);
      expect(a2.rank).toBe(2);

      // Rangs trimestriels exacts
      // T1 : A1=11.00, A2=13.75 -> A2 1er, A1 2e
      expect(a1.rankTrimestre1).toBe(2);
      expect(a2.rankTrimestre1).toBe(1);
      // T2 : A1=14.50, A2=10.00 -> A1 1er, A2 2e
      expect(a1.rankTrimestre2).toBe(1);
      expect(a2.rankTrimestre2).toBe(2);
      // T3 : A1=13.50, A2=14.50 -> A2 1er, A1 2e
      expect(a1.rankTrimestre3).toBe(2);
      expect(a2.rankTrimestre3).toBe(1);
    });

    it('supporte la politique configurable WEIGHTED_SUBJECT_AVERAGES pour l’annuel', () => {
      const res = BulletinSnapshotBuilder.buildClassSnapshots({
        students: [{ id: 'A1' }, { id: 'A2' }],
        subjects,
        sequences,
        notes,
        hasCoefficientBySubject: true,
        isAnnual: true,
        annualPolicy: 'WEIGHTED_SUBJECT_AVERAGES',
      });

      const a2 = res.snapshotsByStudentId.get('A2')!;
      // FRAN=10.67*3 (32.01) + MATH=13.60*5 (68.00) = 100.01 / 8 = 12.50
      expect(a2.generalAverage).toBe(12.5);
    });

    it('supporte THREE_TERMS_ARITHMETIC et le filtrage A-Level exclusif', () => {
      const resTerms = BulletinSnapshotBuilder.buildClassSnapshots({
        students: [{ id: 'A1' }, { id: 'A2' }],
        subjects,
        sequences,
        notes,
        hasCoefficientBySubject: true,
        isAnnual: true,
        annualPolicy: 'THREE_TERMS_ARITHMETIC',
      });
      // A2 : Trim1=13.75, Trim2=10.00, Trim3=14.50 → (13.75 + 10 + 14.50) / 3 = 38.25 / 3 = 12.75
      expect(resTerms.snapshotsByStudentId.get('A2')!.generalAverage).toBe(12.75);

      // A-Level : élève qui n'a choisi que MATH → la note FRAN est exclue des lignes ET de la moyenne
      const resALevel = BulletinSnapshotBuilder.buildClassSnapshots({
        students: [{ id: 'A1', alevelSubjectIds: ['math'] }],
        subjects,
        sequences: [sequences[0]!, sequences[1]!],
        notes: [
          { studentId: 'A1', subjectId: 'fran', sequenceId: 'q1', coefficient: 3, sequenceScore: 4, sequenceAverage: 4, validationStatus: 'LOCKED' },
          { studentId: 'A1', subjectId: 'math', sequenceId: 'q1', coefficient: 5, sequenceScore: 16, sequenceAverage: 16, validationStatus: 'LOCKED' },
          { studentId: 'A1', subjectId: 'math', sequenceId: 'q2', coefficient: 5, sequenceScore: 18, sequenceAverage: 18, validationStatus: 'LOCKED' },
        ],
        hasCoefficientBySubject: true,
      });
      const aLevelSnap = resALevel.snapshotsByStudentId.get('A1')!;
      expect(aLevelSnap.subjectLines).toHaveLength(1);
      expect(aLevelSnap.subjectLines[0]!.subjectId).toBe('math');
      expect(aLevelSnap.generalAverage).toBe(17);
    });
  });
});
