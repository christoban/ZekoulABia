/**
 * DOMAIN LAYER — Fonctions pures de calcul pour BulletinSnapshotBuilder
 * Rangs, filtrage LV2/A-Level, calculs de séquences/trimestres/groupes via GradingEngine.
 */
import type {
  AnnualAveragePolicyMode,
  BulletinClassProfile,
  BulletinGroupPeriodBreakdown,
  BulletinGroupSummary,
  BulletinSubjectSnapshotLine,
  SnapshotNoteInput,
  SnapshotSequenceInput,
  SnapshotStudentInput,
  SnapshotSubjectInput,
} from '@domain/types/bulletinSnapshot';
import type { SubjectType } from '@domain/types/enums';
import { MatiereSansGroupeError } from '@domain/errors/MatiereSansGroupeError';
import {
  resolveGroupBySubjectCode,
  type BulletinGroupingScheme,
} from './bulletinGroupingSchemes';
import {
  calculateAverageScoreOn20,
  calculerMoyenneSequence,
  normalizeScoreOn20,
} from '@domain/rules/GradingEngine';

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export function resolveCurriculumSubjectConfig(params: {
  subject: {
    id?: string;
    name?: string;
    code?: string | null;
    coefficient: number;
    subjectType?: SubjectType;
    groupKey?: string | null;
    groupLabel?: string | null;
    groupOrder?: number | null;
  };
  levelCoeff?: { coefficient: number; groupKey?: string | null; groupLabel?: string | null; groupOrder?: number | null };
  classOverride?: { coefficient: number; groupKey?: string | null; groupLabel?: string | null; groupOrder?: number | null };
  educationType?: string | null;
  groupingScheme?: BulletinGroupingScheme | null;
}): { coefficient: number; groupKey: string; groupLabel: string; groupOrder: number } {
  const coefficient = params.classOverride?.coefficient ?? params.levelCoeff?.coefficient ?? params.subject.coefficient;
  const customKey = params.classOverride?.groupKey ?? params.levelCoeff?.groupKey ?? params.subject.groupKey;
  const customLabel = params.classOverride?.groupLabel ?? params.levelCoeff?.groupLabel ?? params.subject.groupLabel;
  const customOrder = params.classOverride?.groupOrder ?? params.levelCoeff?.groupOrder ?? params.subject.groupOrder;

  // Priorité 1..3 : surcharge établissement (ClassSubjectOverride -> SubjectCoefficient -> Subject)
  if (customKey) {
    return {
      coefficient,
      groupKey: customKey,
      groupLabel: customLabel ?? customKey,
      groupOrder: customOrder ?? 99,
    };
  }

  // Priorité 4 : schéma de regroupement explicite (mapping par code matière ; blocage si absent)
  const scheme = params.groupingScheme;
  if (scheme && scheme !== 'FLAT') {
    if (scheme !== 'CUSTOM') {
      const resolved = resolveGroupBySubjectCode(scheme, params.subject.code);
      if (resolved) {
        return { coefficient, ...resolved };
      }
    }
    throw new MatiereSansGroupeError({
      subjectId: params.subject.id ?? 'unknown',
      subjectName: params.subject.name ?? 'Matière inconnue',
      subjectCode: params.subject.code,
      groupingScheme: scheme,
    });
  }

  // Défaut FLAT / sans schéma : aucune devinette pour le secondaire général
  const isTech = params.educationType === 'TECHNICAL' || params.educationType === 'PROFESSIONAL';
  if (isTech) {
    if (params.subject.subjectType === 'PRACTICAL' || params.subject.subjectType === 'MIXED') {
      return { coefficient, groupKey: 'PROFESSIONNEL', groupLabel: 'Enseignement Professionnel', groupOrder: 2 };
    }
    return { coefficient, groupKey: 'GENERAL', groupLabel: 'Enseignement Général', groupOrder: 1 };
  }

  return { coefficient, groupKey: 'DEFAULT', groupLabel: 'Matières', groupOrder: 99 };
}

export function assignCompetitionRanks(items: Array<{ id: string; value: number }>): Map<string, number> {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const ranks = new Map<string, number>();
  let currentRank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i]!.value < sorted[i - 1]!.value) {
      currentRank = i + 1;
    }
    ranks.set(sorted[i]!.id, currentRank);
  }
  return ranks;
}

export function resolveApcCote(average: number): 'A+' | 'A' | 'ECA' | 'NA' {
  if (average >= 18) return 'A+';
  if (average >= 15) return 'A';
  if (average >= 11) return 'ECA';
  return 'NA';
}

export function resolveApcCompetenceLevel(average: number): string {
  if (average >= 18) return 'Niveau Expert / High Profile';
  if (average >= 15) return 'Compétence Acquise / Acquired';
  if (average >= 11) return "En cours d'acquisition / Ongoing";
  return 'Non acquis / Not Acquired';
}

export function resolveGroupCompetenceLabel(average: number): string {
  if (average >= 10) return 'Compétence acquise';
  if (average >= 8) return "Compétence en cours d'acquisition";
  return 'Compétence non acquise';
}

function meanOfDefined(values: Array<number | undefined>): number | undefined {
  const valid = values.filter((v): v is number => v !== undefined);
  if (valid.length === 0) return undefined;
  return round2(valid.reduce((s, v) => s + v, 0) / valid.length);
}

export function resolveNoteRawScore(
  note: SnapshotNoteInput,
  mode: 'single' | 'triple' | 'weighted',
): number {
  const maxVal = note.maxValue ?? 20;
  const raw =
    note.sequenceAverage != null
      ? Number(note.sequenceAverage)
      : calculerMoyenneSequence(
          {
            sequenceScore: note.sequenceScore,
            classTestScore: note.classTestScore,
            terminalExamScore: note.terminalExamScore,
            theoreticalScore: note.theoreticalScore,
            practicalScore: note.practicalScore,
            seq1Score: note.sequenceScore,
            maxValue: maxVal,
          },
          mode,
        );
  return round2(raw);
}

export function resolveNoteScoreOn20(
  note: SnapshotNoteInput,
  mode: 'single' | 'triple' | 'weighted',
): number {
  const maxVal = note.maxValue ?? 20;
  const raw = resolveNoteRawScore(note, mode);
  return maxVal === 20 ? raw : normalizeScoreOn20({ rawScore: raw, maxScore: maxVal });
}

export function isSubjectAllowedForStudent(
  student: SnapshotStudentInput,
  subject: SnapshotSubjectInput,
): boolean {
  if (student.alevelSubjectIds && student.alevelSubjectIds.length > 0) {
    if (!student.alevelSubjectIds.includes(subject.id)) return false;
  }
  if (subject.isLV2 && student.lv2SubjectId !== subject.id) {
    return false;
  }
  return true;
}

function resolveTermIndex(seq: SnapshotSequenceInput, sortedIndex: number): 1 | 2 | 3 {
  if (seq.termIndex === 1 || seq.termIndex === 2 || seq.termIndex === 3) return seq.termIndex;
  if (sortedIndex < 2) return 1;
  if (sortedIndex < 4) return 2;
  return 3;
}

export function buildStudentSubjectLines(params: {
  student: SnapshotStudentInput;
  studentNotes: SnapshotNoteInput[];
  subjectById: Map<string, SnapshotSubjectInput>;
  subjectOrderById: Map<string, number>;
  seqSlotById: Map<string, number>;
  hasCoefficientBySubject: boolean;
  excludeAbsent: boolean;
  seqMode: 'single' | 'triple' | 'weighted';
}): BulletinSubjectSnapshotLine[] {
  const notesBySubject = new Map<string, SnapshotNoteInput[]>();
  for (const n of params.studentNotes) {
    const arr = notesBySubject.get(n.subjectId) ?? [];
    arr.push(n);
    notesBySubject.set(n.subjectId, arr);
  }

  const lines: BulletinSubjectSnapshotLine[] = [];
  for (const [subjectId, subNotes] of notesBySubject.entries()) {
    const subject = params.subjectById.get(subjectId)!;
    const scoredEntries = subNotes
      .filter((n) => !(params.excludeAbsent && n.isAbsentGrade))
      .map((n) => ({
        note: n,
        slot: params.seqSlotById.get(n.sequenceId)!,
        score: resolveNoteScoreOn20(n, params.seqMode),
      }))
      .sort((a, b) => a.slot - b.slot);

    if (scoredEntries.length === 0) continue;

    const seqScores: Array<number | undefined> = [undefined, undefined, undefined, undefined, undefined, undefined];
    for (const entry of scoredEntries) {
      if (entry.slot >= 0 && entry.slot < 6) seqScores[entry.slot] = entry.score;
    }

    const subjectAvg = round2(scoredEntries.reduce((sum, e) => sum + e.score, 0) / scoredEntries.length);
    const lastNote = scoredEntries[scoredEntries.length - 1]!.note;
    const rawMark = round2(
      scoredEntries.reduce((sum, e) => sum + resolveNoteRawScore(e.note, params.seqMode), 0) / scoredEntries.length,
    );
    const maxMark = subject.maxMark ?? lastNote.maxValue ?? 20;
    const effCoeff = params.hasCoefficientBySubject ? (subject.coefficient ?? 1) : 1;
    const weightedScore = round2(subjectAvg * effCoeff);
    const trim1Average = meanOfDefined([seqScores[0], seqScores[1]]);
    const trim2Average = meanOfDefined([seqScores[2], seqScores[3]]);
    const trim3Average = meanOfDefined([seqScores[4], seqScores[5]]);
    const observation =
      [...scoredEntries].reverse().find((e) => e.note.observation && e.note.observation.trim().length > 0)?.note.observation ?? undefined;
    const isLv2Display = subject.isLV2 && params.student.lv2SubjectId === subject.id && !subject.name.includes('(LV2)');

    lines.push({
      subjectId,
      subjectName: isLv2Display ? `${subject.name} (LV2)` : subject.name,
      coefficient: subject.coefficient ?? 1,
      rawMark,
      maxMark,
      learningDomain: subject.learningDomain,
      learningUnit: subject.learningUnit,
      groupKey: subject.groupKey ?? 'DEFAULT',
      groupLabel: subject.groupLabel ?? 'Matières',
      groupOrder: subject.groupOrder ?? 99,
      seq1Score: seqScores[0],
      seq2Score: seqScores[1],
      seq3Score: seqScores[2],
      seq4Score: seqScores[3],
      seq5Score: seqScores[4],
      seq6Score: seqScores[5],
      trim1Average,
      trim2Average,
      trim3Average,
      classTestScore: lastNote.classTestScore ?? undefined,
      terminalExamScore: lastNote.terminalExamScore ?? undefined,
      theoreticalScore: lastNote.theoreticalScore ?? undefined,
      practicalScore: lastNote.practicalScore ?? undefined,
      professionalAttitude: lastNote.professionalAttitude ?? undefined,
      oralScore: lastNote.oralScore ?? undefined,
      selfDevelopmentScore: lastNote.selfDevelopmentScore ?? undefined,
      subjectAverage: subjectAvg,
      weightedScore,
      subjectRank: 1,
      subjectTotalStudents: 1,
      classSubjectAverage: subjectAvg,
      minSubjectAverage: subjectAvg,
      maxSubjectAverage: subjectAvg,
      teacherComment: observation,
      teacherName: subject.teacherName,
      competenceLabel: subject.competenceLabel,
      competenceCote: resolveApcCote(subjectAvg),
      competenceLevelLabel: resolveApcCompetenceLevel(subjectAvg),
    });
  }

  return lines.sort((a, b) => {
    if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;
    return (params.subjectOrderById.get(a.subjectId) ?? 0) - (params.subjectOrderById.get(b.subjectId) ?? 0);
  });
}

export function computeStudentSequenceAndTermAverages(params: {
  studentNotes: SnapshotNoteInput[];
  orderedSequences: SnapshotSequenceInput[];
  subjectById: Map<string, SnapshotSubjectInput>;
  hasCoefficientBySubject: boolean;
  excludeAbsent: boolean;
  seqMode: 'single' | 'triple' | 'weighted';
}): {
  sequenceAverages: Array<{ sequenceId: string; name: string; orderIndex: number; average: number | null }>;
  termAverages: { trim1?: number; trim2?: number; trim3?: number };
} {
  const sequenceAverages = params.orderedSequences.map((seq) => {
    const seqNotes = params.studentNotes.filter((n) => n.sequenceId === seq.id && !(params.excludeAbsent && n.isAbsentGrade));
    if (seqNotes.length === 0) {
      return { sequenceId: seq.id, name: seq.name, orderIndex: seq.orderIndex, average: null };
    }
    const avg = calculateAverageScoreOn20(
      seqNotes.map((n) => {
        const sub = params.subjectById.get(n.subjectId)!;
        const s = resolveNoteScoreOn20(n, params.seqMode);
        return { scoreOn20: s, percentage: s * 5, coefficient: sub.coefficient, isAbsentGrade: false };
      }),
      params.hasCoefficientBySubject,
      false,
    );
    return { sequenceId: seq.id, name: seq.name, orderIndex: seq.orderIndex, average: avg };
  });

  const termAverages: { trim1?: number; trim2?: number; trim3?: number } = {};
  for (const termIdx of [1, 2, 3] as const) {
    const termSeqIds = new Set(
      params.orderedSequences.filter((s, idx) => resolveTermIndex(s, idx) === termIdx).map((s) => s.id),
    );
    if (termSeqIds.size === 0) continue;
    const termNotesBySub = new Map<string, number[]>();
    for (const n of params.studentNotes) {
      if (!termSeqIds.has(n.sequenceId) || (params.excludeAbsent && n.isAbsentGrade)) continue;
      const arr = termNotesBySub.get(n.subjectId) ?? [];
      arr.push(resolveNoteScoreOn20(n, params.seqMode));
      termNotesBySub.set(n.subjectId, arr);
    }
    if (termNotesBySub.size === 0) continue;
    const termSubAvgs = Array.from(termNotesBySub.entries()).map(([subId, scores]) => {
      const avg = round2(scores.reduce((a, b) => a + b, 0) / scores.length);
      const sub = params.subjectById.get(subId)!;
      return { scoreOn20: avg, percentage: avg * 5, coefficient: sub.coefficient, isAbsentGrade: false };
    });
    const termAvg = calculateAverageScoreOn20(termSubAvgs, params.hasCoefficientBySubject, false);
    if (termIdx === 1) termAverages.trim1 = termAvg;
    else if (termIdx === 2) termAverages.trim2 = termAvg;
    else termAverages.trim3 = termAvg;
  }

  return { sequenceAverages, termAverages };
}

function computeGroupFieldAverage(
  groupLines: BulletinSubjectSnapshotLine[],
  getter: (line: BulletinSubjectSnapshotLine) => number | undefined,
  hasCoefficientBySubject: boolean,
): number | undefined {
  const valid = groupLines
    .map((l) => ({ score: getter(l), coeff: hasCoefficientBySubject ? l.coefficient : 1 }))
    .filter((x): x is { score: number; coeff: number } => x.score !== undefined);
  if (valid.length === 0) return undefined;
  return calculateAverageScoreOn20(
    valid.map((v) => ({ scoreOn20: v.score, percentage: v.score * 5, coefficient: v.coeff })),
    hasCoefficientBySubject,
    false,
  );
}

export function buildGroupSummariesForStudent(
  lines: BulletinSubjectSnapshotLine[],
  hasCoefficientBySubject: boolean,
): BulletinGroupSummary[] {
  const linesByGroup = new Map<string, BulletinSubjectSnapshotLine[]>();
  for (const line of lines) {
    const list = linesByGroup.get(line.groupKey) ?? [];
    list.push(line);
    linesByGroup.set(line.groupKey, list);
  }
  const groups: BulletinGroupSummary[] = [];
  for (const [groupKey, groupLines] of linesByGroup.entries()) {
    const first = groupLines[0]!;
    const groupAverage = calculateAverageScoreOn20(
      groupLines.map((l) => ({ scoreOn20: l.subjectAverage, percentage: l.subjectAverage * 5, coefficient: l.coefficient })),
      hasCoefficientBySubject,
      false,
    );
    groups.push({
      groupKey,
      groupLabel: first.groupLabel,
      groupOrder: first.groupOrder,
      totalCoefficient: round2(groupLines.reduce((s, l) => s + (hasCoefficientBySubject ? l.coefficient : 1), 0)),
      totalWeightedScore: round2(groupLines.reduce((s, l) => s + l.weightedScore, 0)),
      groupAverage,
      groupRank: 1,
      groupTotalStudents: 1,
    });
  }
  return groups.sort((a, b) => a.groupOrder - b.groupOrder);
}

export function buildGroupBreakdownsForStudent(
  lines: BulletinSubjectSnapshotLine[],
  groups: BulletinGroupSummary[],
  hasCoefficientBySubject: boolean,
): Record<string, BulletinGroupPeriodBreakdown> {
  const out: Record<string, BulletinGroupPeriodBreakdown> = {};
  for (const grp of groups) {
    const groupLines = lines.filter((l) => l.groupKey === grp.groupKey);
    out[grp.groupKey] = {
      seq1Average: computeGroupFieldAverage(groupLines, (l) => l.seq1Score, hasCoefficientBySubject),
      seq2Average: computeGroupFieldAverage(groupLines, (l) => l.seq2Score, hasCoefficientBySubject),
      seq3Average: computeGroupFieldAverage(groupLines, (l) => l.seq3Score, hasCoefficientBySubject),
      seq4Average: computeGroupFieldAverage(groupLines, (l) => l.seq4Score, hasCoefficientBySubject),
      seq5Average: computeGroupFieldAverage(groupLines, (l) => l.seq5Score, hasCoefficientBySubject),
      seq6Average: computeGroupFieldAverage(groupLines, (l) => l.seq6Score, hasCoefficientBySubject),
      trim1Average: computeGroupFieldAverage(groupLines, (l) => l.trim1Average, hasCoefficientBySubject),
      trim2Average: computeGroupFieldAverage(groupLines, (l) => l.trim2Average, hasCoefficientBySubject),
      trim3Average: computeGroupFieldAverage(groupLines, (l) => l.trim3Average, hasCoefficientBySubject),
      groupCompetenceLabel: resolveGroupCompetenceLabel(grp.groupAverage),
    };
  }
  return out;
}

export function resolveAnnualGeneralAverage(params: {
  annualPolicy: AnnualAveragePolicyMode;
  weightedSubjectAvg: number;
  sequenceAverages: Array<{ average: number | null }>;
  termAverages: { trim1?: number; trim2?: number; trim3?: number };
}): number {
  if (params.annualPolicy === 'SIX_SEQUENCES_ARITHMETIC') {
    const valid = params.sequenceAverages.map((s) => s.average).filter((a): a is number => a !== null);
    return valid.length > 0 ? round2(valid.reduce((a, b) => a + b, 0) / valid.length) : 0;
  }
  if (params.annualPolicy === 'THREE_TERMS_ARITHMETIC') {
    const vals = [params.termAverages.trim1, params.termAverages.trim2, params.termAverages.trim3].filter(
      (v): v is number => v !== undefined,
    );
    return vals.length > 0 ? round2(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  }
  return params.weightedSubjectAvg;
}

export function computeClassProfile(
  generalAverages: number[],
  passThresholdOn20: number,
): BulletinClassProfile {
  // Effectif = nombre réel d'élèves classés : aucune surcharge manuelle (cohérence admis/effectif/taux)
  const effectiveSize = generalAverages.length;
  const passCount = generalAverages.filter((a) => a >= passThresholdOn20).length;
  return {
    classSize: effectiveSize,
    classAverage:
      generalAverages.length > 0 ? round2(generalAverages.reduce((a, b) => a + b, 0) / generalAverages.length) : 0,
    topAverage: generalAverages.length > 0 ? Math.max(...generalAverages) : 0,
    lowAverage: generalAverages.length > 0 ? Math.min(...generalAverages) : 0,
    passCount,
    passRate: effectiveSize > 0 ? round2((passCount / effectiveSize) * 100) : 0,
  };
}

