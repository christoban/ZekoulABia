/**
 * APPLICATION LAYER — Helpers purs d'enrichissement des snapshots de bulletins
 *
 * Rassemble le mapping curriculum (groupes + coefficients), le calcul des heures de conduite J/NJ,
 * les mentions par template/langue, le hachage SHA-256 et la conversion vers LigneMatiereProps.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { MatiereProps, CoefficientMatiere } from '@domain/ports/repositories/MatiereRepository';
import type { ClassSubjectOverrideRecord, SubjectCoefficientRecord } from '@domain/ports/repositories/ClasseCoefficientRepository';
import type { DisciplineRecordData } from '@domain/ports/repositories/DisciplineRepository';
import type { Note } from '@domain/entities/Note';
import type { Presence } from '@domain/entities/Presence';
import type { LigneMatiereProps } from '@domain/entities/Bulletin';
import type { BulletinTemplate, CouncilDecision } from '@domain/types/enums';
import type {
  BulletinConductSnapshot,
  BulletinCouncilDecisionSnapshot,
  SnapshotNoteInput,
  SnapshotSubjectInput,
  StudentBulletinSnapshot,
} from '@domain/types/bulletinSnapshot';
import { resolveCurriculumSubjectConfig } from '@domain/services/bulletin/bulletinSnapshotMath';
import type { BulletinGroupingScheme } from '@domain/services/bulletin/bulletinGroupingSchemes';

export function sanitizePhotoReferenceForSnapshot(
  photoUrl: string | null | undefined,
  studentId: string,
): string | null {
  if (!photoUrl) return null;
  const trimmed = photoUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:')) {
    return `ref:student-photo:${studentId}`;
  }
  return trimmed;
}

export function decodeBase64PhotoUrl(photoUrl: string | null | undefined): Buffer | null {
  if (!photoUrl || !photoUrl.startsWith('data:image/')) return null;
  const commaIdx = photoUrl.indexOf(',');
  if (commaIdx === -1) return null;
  const b64 = photoUrl.slice(commaIdx + 1).trim();
  if (!b64) return null;
  try {
    return Buffer.from(b64, 'base64');
  } catch {
    return null;
  }
}

export function resoudreVerifyBaseUrl(): string {
  return (process.env.FRONTEND_URL || process.env.CLIENT_URL || process.env.APP_URL || 'http://localhost:3000')
    .trim()
    .replace(/\/+$/, '');
}

export function genererVerifyToken(): string {
  return randomBytes(24).toString('hex');
}

export function canonicalHashSnapshot(snapshot: StudentBulletinSnapshot): string {
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

export function calculerMentionBulletin(moyenne: number, template: BulletinTemplate, langue: 'fr' | 'en'): string {
  const mentionEn = (m: number): string =>
    m >= 18 ? 'Excellent' : m >= 16 ? 'Very Good' : m >= 14 ? 'Good' : m >= 12 ? 'Fair' : m >= 10 ? 'Pass' : 'Poor';
  const mentionApc = (m: number): string =>
    m >= 18 ? 'Expert' : m >= 15 ? 'Acquis' : m >= 11 ? 'ECA' : 'NA';
  const mentionFr = (m: number): string =>
    m >= 18 ? 'Excellent' : m >= 16 ? 'Très Bien' : m >= 14 ? 'Bien' : m >= 12 ? 'Assez Bien'
      : m >= 10 ? 'Passable' : m >= 8 ? 'Insuffisant' : m >= 6 ? 'Très Insuffisant' : 'Médiocre';

  if (template === 'EN_SECONDARY') return mentionEn(moyenne);
  if (template === 'MONTHLY') return mentionApc(moyenne);
  if (template === 'PRIMARY') return langue === 'en' ? mentionEn(moyenne) : mentionApc(moyenne);
  if (template === 'ANNUAL') return langue === 'en' ? mentionEn(moyenne) : mentionFr(moyenne);
  return mentionFr(moyenne);
}

export function snapshotToLignesMatiere(snapshot: StudentBulletinSnapshot): LigneMatiereProps[] {
  return snapshot.subjectLines.map((l) => ({
    id: crypto.randomUUID(),
    subjectId: l.subjectId,
    subjectName: l.subjectName,
    coefficient: l.coefficient,
    seq1Score: l.seq1Score,
    seq2Score: l.seq2Score,
    seq3Score: l.seq3Score,
    seq4Score: l.seq4Score,
    seq5Score: l.seq5Score,
    seq6Score: l.seq6Score,
    classTestScore: l.classTestScore,
    terminalExamScore: l.terminalExamScore,
    theoreticalScore: l.theoreticalScore,
    practicalScore: l.practicalScore,
    professionalAttitude: l.professionalAttitude,
    oralScore: l.oralScore,
    selfDevelopmentScore: l.selfDevelopmentScore,
    subjectAverage: l.subjectAverage,
    weightedScore: l.weightedScore,
    subjectRank: l.subjectRank,
    groupKey: l.groupKey,
    groupLabel: l.groupLabel,
    groupOrder: l.groupOrder,
    teacherName: l.teacherName,
    classSubjectAverage: l.classSubjectAverage,
    minSubjectAverage: l.minSubjectAverage,
    maxSubjectAverage: l.maxSubjectAverage,
    teacherComment: l.teacherComment,
    competenceLabel: l.competenceLabel,
  }));
}

export function formatAbsenceHoursDisplay(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || Number.isNaN(hours)) return '—';
  return `${hours} h`;
}

export function buildConductForStudent(
  presences: Presence[],
  sanctions: DisciplineRecordData[],
  fallbackAbsenceDays: number,
): BulletinConductSnapshot {
  let lateCount = 0;

  for (const p of presences) {
    if (p.toObject().status === 'LATE') {
      lateCount++;
    }
  }

  const warningsCount = sanctions.filter((s) => s.type === 'WARNING_ORAL' || s.type === 'WARNING_WRITTEN').length;
  const blamesCount = sanctions.filter((s) => s.type.toUpperCase().includes('BLAME')).length;
  const exclusionsCount = sanctions.filter(
    (s) => s.type === 'TEMP_EXCLUSION' || s.type === 'PERMANENT_EXCLUSION',
  ).length;

  // Attendance ne porte ni horaire ni lien fiable vers TimetableSlot :
  // ne jamais inventer de durée estimée (1h/4h) sur un document officiel.
  return {
    justifiedAbsenceHours: null,
    unjustifiedAbsenceHours: null,
    totalAbsenceHours: null,
    totalAbsenceDays: fallbackAbsenceDays,
    lateCount,
    warningsCount,
    blamesCount,
    exclusionsCount,
    sanctions: sanctions.map((s) => ({
      id: s.id,
      type: s.type,
      reason: s.reason,
      createdAt: s.createdAt.toISOString(),
    })),
  };
}

export function buildCouncilDecisionSnapshot(
  dec: { decision: CouncilDecision; observations: string | null } | undefined,
  generalAverage: number,
  exclusionsCount: number,
): BulletinCouncilDecisionSnapshot | undefined {
  if (!dec) return undefined;
  const obsLower = (dec.observations ?? '').toLowerCase();
  return {
    decision: dec.decision,
    observations: dec.observations,
    honorRoll: obsLower.includes('tableau') || (generalAverage >= 12 && exclusionsCount === 0),
    encouragements: obsLower.includes('encouragement') || (generalAverage >= 14 && exclusionsCount === 0),
    congratulations:
      obsLower.includes('félicitation') ||
      obsLower.includes('felicitation') ||
      (generalAverage >= 16 && exclusionsCount === 0),
  };
}

export function buildSubjectInputsWithCurriculum(params: {
  matieres: MatiereProps[];
  notesDeClasse: Note[];
  lv2SubjectIds: Set<string>;
  overrideMap: Map<string, ClassSubjectOverrideRecord>;
  levelCoeffMap: Map<string, SubjectCoefficientRecord | CoefficientMatiere>;
  teacherBySubject: Map<string, string>;
  educationType: string | null | undefined;
  groupingScheme?: BulletinGroupingScheme | null;
}): SnapshotSubjectInput[] {
  const matiereParId = new Map(params.matieres.map((m) => [m.id, m]));
  const gradedSubjectIds = new Set(params.notesDeClasse.map((n) => n.subjectId));

  const subjectsInput: SnapshotSubjectInput[] = params.matieres.map((m) => {
    const schemeForSubject = gradedSubjectIds.has(m.id) ? params.groupingScheme : 'FLAT';
    const cfg = resolveCurriculumSubjectConfig({
      subject: m,
      levelCoeff: params.levelCoeffMap.get(m.id),
      classOverride: params.overrideMap.get(m.id),
      educationType: params.educationType,
      groupingScheme: schemeForSubject,
    });
    return {
      id: m.id,
      name: m.name,
      coefficient: cfg.coefficient,
      isLV2: params.lv2SubjectIds.has(m.id),
      subjectType: m.subjectType,
      groupKey: cfg.groupKey,
      groupLabel: cfg.groupLabel,
      groupOrder: cfg.groupOrder,
      teacherName: params.teacherBySubject.get(m.id),
    };
  });

  const knownIds = new Set(subjectsInput.map((s) => s.id));
  for (const n of params.notesDeClasse) {
    if (knownIds.has(n.subjectId)) continue;
    knownIds.add(n.subjectId);
    const mat = matiereParId.get(n.subjectId);
    const fallbackCfg = resolveCurriculumSubjectConfig({
      subject: {
        id: n.subjectId,
        name: mat?.name ?? `Matière (${n.subjectId.slice(0, 6)})`,
        code: mat?.code ?? null,
        coefficient: n.coefficient,
      },
      educationType: params.educationType,
      groupingScheme: params.groupingScheme,
    });
    subjectsInput.push({
      id: n.subjectId,
      name: mat?.name ?? `Matière (${n.subjectId.slice(0, 6)})`,
      coefficient: fallbackCfg.coefficient,
      isLV2: params.lv2SubjectIds.has(n.subjectId),
      groupKey: fallbackCfg.groupKey,
      groupLabel: fallbackCfg.groupLabel,
      groupOrder: fallbackCfg.groupOrder,
      teacherName: params.teacherBySubject.get(n.subjectId),
    });
  }
  return subjectsInput;
}

export function mapNotesToSnapshotInputs(notesDeClasse: Note[]): SnapshotNoteInput[] {
  return notesDeClasse.map((n) => {
    const obj = n.toObject();
    return {
      id: obj.id,
      studentId: obj.studentId,
      subjectId: obj.subjectId,
      sequenceId: obj.sequenceId,
      coefficient: obj.coefficient,
      maxValue: obj.maxValue,
      sequenceScore: obj.sequenceScore,
      classTestScore: obj.classTestScore,
      terminalExamScore: obj.terminalExamScore,
      theoreticalScore: obj.theoreticalScore,
      practicalScore: obj.practicalScore,
      professionalAttitude: obj.professionalAttitude,
      oralScore: obj.oralScore,
      selfDevelopmentScore: obj.selfDevelopmentScore,
      sequenceAverage: obj.sequenceAverage,
      validationStatus: obj.validationStatus,
      isAbsentGrade: obj.isAbsentGrade,
      observation: obj.observation,
    };
  });
}

