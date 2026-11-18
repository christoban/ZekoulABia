/**
 * DOMAIN LAYER — Constructeur pur et déterministe de Snapshots de Bulletins
 *
 * Source unique de vérité mathématique pour les bulletins scolaires (période et annuel).
 * S'appuie exclusivement sur GradingEngine — ne lit jamais d'anciens ReportCard,
 * ne fait aucun appel réseau ou base de données.
 */
import type {
  BulletinClassProfile,
  BulletinGroupSummary,
  BulletinSnapshotBuildInput,
  BulletinSubjectSnapshotLine,
  ClassBulletinSnapshotsResult,
  SnapshotSubjectInput,
  StudentBulletinSnapshot,
} from '@domain/types/bulletinSnapshot';
import { calculateAverageScoreOn20 } from '@domain/rules/GradingEngine';
import {
  assignCompetitionRanks,
  buildGroupSummariesForStudent,
  buildStudentSubjectLines,
  computeStudentSequenceAndTermAverages,
  isSubjectAllowedForStudent,
  resolveAnnualGeneralAverage,
  round2,
} from './bulletinSnapshotMath';

export class BulletinSnapshotBuilder {
  static buildClassSnapshots(input: BulletinSnapshotBuildInput): ClassBulletinSnapshotsResult {
    const requireLocked = input.requireLockedGrades ?? true;
    const excludeAbsent = input.excludeAbsentGrades ?? true;
    const seqMode = input.sequenceCalculationMode ?? 'single';
    const passThreshold = input.passThresholdOn20 ?? 10;
    const annualPolicy = input.annualPolicy ?? 'SIX_SEQUENCES_ARITHMETIC';

    const orderedSequences = [...input.sequences].sort((a, b) => a.orderIndex - b.orderIndex);
    const seqSlotById = new Map<string, number>();
    orderedSequences.forEach((seq, idx) => seqSlotById.set(seq.id, idx));

    const subjectOrderById = new Map<string, number>();
    const subjectById = new Map<string, SnapshotSubjectInput>();
    input.subjects.forEach((sub, idx) => {
      subjectOrderById.set(sub.id, idx);
      subjectById.set(sub.id, sub);
    });

    const validNotes = input.notes.filter((n) => {
      if (requireLocked && n.validationStatus !== 'LOCKED') return false;
      return seqSlotById.has(n.sequenceId) && subjectById.has(n.subjectId);
    });

    const linesByStudent = new Map<string, BulletinSubjectSnapshotLine[]>();
    const seqAvgsByStudent = new Map<string, Array<{ sequenceId: string; name: string; orderIndex: number; average: number | null }>>();
    const termAvgsByStudent = new Map<string, { trim1?: number; trim2?: number; trim3?: number }>();
    const generalAvgByStudent = new Map<string, number>();

    for (const student of input.students) {
      const studentNotes = validNotes.filter((n) => {
        if (n.studentId !== student.id) return false;
        const sub = subjectById.get(n.subjectId);
        return sub ? isSubjectAllowedForStudent(student, sub) : false;
      });

      const lines = buildStudentSubjectLines({
        student,
        studentNotes,
        subjectById,
        subjectOrderById,
        seqSlotById,
        hasCoefficientBySubject: input.hasCoefficientBySubject,
        excludeAbsent,
        seqMode,
      });
      linesByStudent.set(student.id, lines);

      const weightedAvg = calculateAverageScoreOn20(
        lines.map((l) => ({ scoreOn20: l.subjectAverage, percentage: l.subjectAverage * 5, coefficient: l.coefficient })),
        input.hasCoefficientBySubject,
        false,
      );

      const { sequenceAverages, termAverages } = computeStudentSequenceAndTermAverages({
        studentNotes,
        orderedSequences,
        subjectById,
        hasCoefficientBySubject: input.hasCoefficientBySubject,
        excludeAbsent,
        seqMode,
      });
      seqAvgsByStudent.set(student.id, sequenceAverages);
      termAvgsByStudent.set(student.id, termAverages);

      const generalAvg = input.isAnnual
        ? resolveAnnualGeneralAverage({ annualPolicy, weightedSubjectAvg: weightedAvg, sequenceAverages, termAverages })
        : weightedAvg;
      generalAvgByStudent.set(student.id, generalAvg);
    }

    // Statistiques et rangs par matière sur la classe (avec ex æquo)
    const scoresBySubject = new Map<string, Array<{ id: string; value: number }>>();
    for (const student of input.students) {
      for (const line of linesByStudent.get(student.id) ?? []) {
        const list = scoresBySubject.get(line.subjectId) ?? [];
        list.push({ id: student.id, value: line.subjectAverage });
        scoresBySubject.set(line.subjectId, list);
      }
    }
    const subjectStats = new Map<string, { ranks: Map<string, number>; avg: number; min: number; max: number; total: number }>();
    for (const [subjectId, entries] of scoresBySubject.entries()) {
      const vals = entries.map((e) => e.value);
      subjectStats.set(subjectId, {
        ranks: assignCompetitionRanks(entries),
        avg: round2(vals.reduce((a, b) => a + b, 0) / vals.length),
        min: Math.min(...vals),
        max: Math.max(...vals),
        total: entries.length,
      });
    }

    // Groupes et rangs par groupe
    const groupsByStudent = new Map<string, BulletinGroupSummary[]>();
    const groupScoresByKey = new Map<string, Array<{ id: string; value: number }>>();
    for (const student of input.students) {
      const lines = linesByStudent.get(student.id) ?? [];
      for (const line of lines) {
        const stat = subjectStats.get(line.subjectId);
        if (stat) {
          line.subjectRank = stat.ranks.get(student.id) ?? 1;
          line.subjectTotalStudents = stat.total;
          line.classSubjectAverage = stat.avg;
          line.minSubjectAverage = stat.min;
          line.maxSubjectAverage = stat.max;
        }
      }
      const groups = buildGroupSummariesForStudent(lines, input.hasCoefficientBySubject);
      groupsByStudent.set(student.id, groups);
      for (const grp of groups) {
        const list = groupScoresByKey.get(grp.groupKey) ?? [];
        list.push({ id: student.id, value: grp.groupAverage });
        groupScoresByKey.set(grp.groupKey, list);
      }
    }

    const groupRanks = new Map<string, { ranks: Map<string, number>; total: number }>();
    for (const [key, entries] of groupScoresByKey.entries()) {
      groupRanks.set(key, { ranks: assignCompetitionRanks(entries), total: entries.length });
    }

    const generalRanks = assignCompetitionRanks(
      input.students.map((s) => ({ id: s.id, value: generalAvgByStudent.get(s.id) ?? 0 })),
    );
    const t1Ranks = assignCompetitionRanks(
      input.students.filter((s) => termAvgsByStudent.get(s.id)?.trim1 !== undefined).map((s) => ({ id: s.id, value: termAvgsByStudent.get(s.id)!.trim1! })),
    );
    const t2Ranks = assignCompetitionRanks(
      input.students.filter((s) => termAvgsByStudent.get(s.id)?.trim2 !== undefined).map((s) => ({ id: s.id, value: termAvgsByStudent.get(s.id)!.trim2! })),
    );
    const t3Ranks = assignCompetitionRanks(
      input.students.filter((s) => termAvgsByStudent.get(s.id)?.trim3 !== undefined).map((s) => ({ id: s.id, value: termAvgsByStudent.get(s.id)!.trim3! })),
    );

    const snapshotsByStudentId = new Map<string, StudentBulletinSnapshot>();
    const allAvgs = input.students.map((s) => generalAvgByStudent.get(s.id) ?? 0);

    const passCount = allAvgs.filter((a) => a >= passThreshold).length;
    const classProfile: BulletinClassProfile = {
      classSize: allAvgs.length,
      classAverage: allAvgs.length > 0 ? round2(allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length) : 0,
      topAverage: allAvgs.length > 0 ? Math.max(...allAvgs) : 0,
      lowAverage: allAvgs.length > 0 ? Math.min(...allAvgs) : 0,
      passCount,
      passRate: allAvgs.length > 0 ? round2((passCount / allAvgs.length) * 100) : 0,
    };

    for (const student of input.students) {
      const lines = linesByStudent.get(student.id) ?? [];
      const groups = groupsByStudent.get(student.id) ?? [];
      for (const grp of groups) {
        const gr = groupRanks.get(grp.groupKey);
        if (gr) {
          grp.groupRank = gr.ranks.get(student.id) ?? 1;
          grp.groupTotalStudents = gr.total;
        }
      }
      const genAvg = generalAvgByStudent.get(student.id) ?? 0;

      snapshotsByStudentId.set(student.id, {
        studentId: student.id,
        computationVersion: 2,
        templateVersion: 1,
        generalAverage: genAvg,
        totalCoefficient: round2(lines.reduce((s, l) => s + (input.hasCoefficientBySubject ? l.coefficient : 1), 0)),
        totalWeightedScore: round2(lines.reduce((s, l) => s + l.weightedScore, 0)),
        rank: generalRanks.get(student.id) ?? input.students.length,
        totalStudents: input.students.length,
        sequenceAverages: input.isAnnual ? seqAvgsByStudent.get(student.id) : undefined,
        termAverages: input.isAnnual ? termAvgsByStudent.get(student.id) : undefined,
        rankTrimestre1: input.isAnnual ? t1Ranks.get(student.id) : undefined,
        rankTrimestre2: input.isAnnual ? t2Ranks.get(student.id) : undefined,
        rankTrimestre3: input.isAnnual ? t3Ranks.get(student.id) : undefined,
        classProfile,
        subjectLines: lines,
        groupSummaries: groups,
      });
    }

    return { snapshotsByStudentId, classProfile };
  }
}
