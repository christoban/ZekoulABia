/**
 * APPLICATION LAYER — Orchestration partagée des snapshots de bulletins
 *
 * Appelé par GenererBulletinUseCase (synchrone) et GenererBulletinsInngestUseCase (batch).
 * Garantit la parité totale des calculs, du chargement des 6 séquences (ANNUAL),
 * des groupes de curriculum, de l'identité élève, du PP et des heures de conduite.
 */
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { NoteRepository, NoteNonValideeInfo } from '@domain/ports/repositories/NoteRepository';
import type { MatiereRepository, CoefficientMatiere } from '@domain/ports/repositories/MatiereRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { PresenceRepository } from '@domain/ports/repositories/PresenceRepository';
import type { ClassCouncilRepository } from '@domain/ports/repositories/ClassCouncilRepository';
import type { StudentProfileRepository, StudentBulletinOptions } from '@domain/ports/repositories/StudentProfileRepository';
import type { ClasseCoefficientRepository, ClassSubjectOverrideRecord, SubjectCoefficientRecord } from '@domain/ports/repositories/ClasseCoefficientRepository';
import type { TeachingAssignmentRepository } from '@domain/ports/repositories/TeachingAssignmentRepository';
import type { DisciplineRepository, DisciplineRecordData } from '@domain/ports/repositories/DisciplineRepository';
import type {
  SequenceAbsenceSummaryRecord,
  SequenceAbsenceSummaryRepository,
} from '@domain/ports/repositories/SequenceAbsenceSummaryRepository';
import type { Classe } from '@domain/entities/Classe';
import type { School } from '@domain/entities/School';
import type { Note } from '@domain/entities/Note';
import type { Presence } from '@domain/entities/Presence';
import type { BulletinTemplate, CouncilDecision } from '@domain/types/enums';
import type { BulletinGroupingScheme } from '@domain/services/bulletin/bulletinGroupingSchemes';
import type {
  BulletinClassProfile,
  SnapshotSequenceInput,
  StudentBulletinSnapshot,
} from '@domain/types/bulletinSnapshot';
import { BulletinSnapshotBuilder } from '@domain/services/bulletin/BulletinSnapshotBuilder';
import {
  buildConductForStudent,
  buildCouncilDecisionSnapshot,
  buildSubjectInputsWithCurriculum,
  calculerMentionBulletin,
  canonicalHashSnapshot,
  decodeBase64PhotoUrl,
  deriveShortVerifyCode,
  formatAbsenceHoursDisplay,
  genererVerifyToken,
  mapNotesToSnapshotInputs,
  resoudreVerifyBaseUrl,
  sanitizePhotoReferenceForSnapshot,
  snapshotToLignesMatiere,
} from './bulletinEnrichmentHelpers';

export {
  calculerMentionBulletin,
  decodeBase64PhotoUrl,
  formatAbsenceHoursDisplay,
  resoudreVerifyBaseUrl,
  sanitizePhotoReferenceForSnapshot,
  snapshotToLignesMatiere,
};

export interface LoadedClassPeriodContext {
  periodIds: string[];
  sequences: SnapshotSequenceInput[];
  rawSeqNames: [string, string];
  notesDeClasse: Note[];
  notesNonValidees: NoteNonValideeInfo[];
}

export interface EnrichedSnapshotEntry {
  snapshot: StudentBulletinSnapshot;
  mention: string;
  absenceCount: number;
  contentHash: string;
  verifyToken: string;
  shortVerifyCode: string;
}

export interface ClassSnapshotsBundle {
  entriesByStudentId: Map<string, EnrichedSnapshotEntry>;
  classProfile: BulletinClassProfile;
  mainTeacherName: string | null;
}

export async function chargerNotesEtSequencesClasse(params: {
  classId: string;
  academicYearId: string;
  academicPeriodId: string;
  isAnnual: boolean;
  anneeRepository: AnneeAcademiqueRepository;
  noteRepository: NoteRepository;
}): Promise<LoadedClassPeriodContext> {
  const targetPeriods = params.isAnnual
    ? (await params.anneeRepository.findPeriodesByAnnee(params.academicYearId))
        .slice()
        .sort((a, b) => a.orderIndex - b.orderIndex || a.startDate.getTime() - b.startDate.getTime())
    : [];

  const periodIds = targetPeriods.length > 0 ? targetPeriods.map((p) => p.id) : [params.academicPeriodId];
  const notesNonValidees: NoteNonValideeInfo[] = [];
  const rawSeqs: SnapshotSequenceInput[] = [];

  for (let pIdx = 0; pIdx < periodIds.length; pIdx++) {
    const pid = periodIds[pIdx]!;
    notesNonValidees.push(...(await params.noteRepository.findNotesNonValideesParClasse(params.classId, pid)));

    const seqs = (await params.anneeRepository.findSequencesByPeriode(pid))
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const termIndex = Math.min(3, Math.max(1, pIdx + 1)) as 1 | 2 | 3;
    for (const seq of seqs) {
      rawSeqs.push({ id: seq.id, name: seq.name, orderIndex: rawSeqs.length + 1, termIndex });
    }
  }

  const notesDeClasse: Note[] = [];
  for (const seq of rawSeqs) {
    notesDeClasse.push(...(await params.noteRepository.findByClasse(params.classId, seq.id)));
  }

  return {
    periodIds,
    sequences: rawSeqs,
    rawSeqNames: [rawSeqs[0]?.name || 'SÉQ 1', rawSeqs[1]?.name || 'SÉQ 2'],
    notesDeClasse,
    notesNonValidees,
  };
}

export async function construireEtEnrichirSnapshotsClasse(params: {
  school: School;
  classe: Classe;
  academicPeriodId: string;
  periodIds: string[];
  sequences: SnapshotSequenceInput[];
  notesDeClasse: Note[];
  elevesClasse: Array<{ id: string; firstName: string; lastName: string; nomComplet: string }>;
  hasCoefficientBySubject: boolean;
  template: BulletinTemplate;
  langue: 'fr' | 'en';
  matiereRepository: MatiereRepository;
  userRepository: UserRepository;
  presenceRepository: PresenceRepository;
  classCouncilRepository: ClassCouncilRepository;
  studentProfileRepository?: StudentProfileRepository;
  classeCoefficientRepository?: ClasseCoefficientRepository;
  teachingAssignmentRepository?: TeachingAssignmentRepository;
  disciplineRepository?: DisciplineRepository;
  sequenceAbsenceRepository?: SequenceAbsenceSummaryRepository;
  groupingScheme?: BulletinGroupingScheme | null;
  passThresholdOn20?: number;
  sequenceCalculationMode?: 'single' | 'triple' | 'weighted';
}): Promise<ClassSnapshotsBundle> {
  const matieres = await params.matiereRepository.findBySchool(params.school.id);
  const overrideMap = new Map<string, ClassSubjectOverrideRecord>();
  const levelCoeffMap = new Map<string, SubjectCoefficientRecord | CoefficientMatiere>();

  if (params.classeCoefficientRepository) {
    const cfgs = await params.classeCoefficientRepository.findCurriculumConfigsForClass({
      schoolId: params.school.id,
      classId: params.classe.id,
      classLevel: params.classe.level ?? null,
      serieCode: params.classe.serie ?? null,
    });
    for (const o of cfgs.overrides) overrideMap.set(o.subjectId, o);
    for (const c of cfgs.levelCoefficients) levelCoeffMap.set(c.subjectId, c);
  } else if (params.classe.level) {
    for (const m of matieres) {
      const list = await params.matiereRepository.getCoefficients(params.school.id, m.id);
      const matched = list.find(
        (c) => c.classLevel === params.classe.level && (c.serieCode ?? null) === (params.classe.serie ?? null),
      );
      if (matched) levelCoeffMap.set(m.id, matched);
    }
  }

  const teacherBySubject = new Map<string, string>();
  if (params.teachingAssignmentRepository) {
    const assignments = await params.teachingAssignmentRepository.findByClassAndSchool(params.classe.id, params.school.id);
    for (const a of assignments) {
      if (a.teacherName) teacherBySubject.set(a.subjectId, a.teacherName);
    }
  }

  const lv2SubjectIds = new Set<string>(await params.matiereRepository.findIdsLV2BySchool(params.school.id));
  const subjectsInput = buildSubjectInputsWithCurriculum({
    matieres,
    notesDeClasse: params.notesDeClasse,
    lv2SubjectIds,
    overrideMap,
    levelCoeffMap,
    teacherBySubject,
    educationType: params.school.toObject().educationType,
    groupingScheme: params.groupingScheme,
  });

  const profilesMap = new Map<string, StudentBulletinOptions>();
  if (params.studentProfileRepository) {
    const profiles = await params.studentProfileRepository.findBulletinOptionsByStudentIds(
      params.elevesClasse.map((e) => e.id),
    );
    for (const p of profiles) profilesMap.set(p.studentId, p);
  }

  const { snapshotsByStudentId, classProfile } = BulletinSnapshotBuilder.buildClassSnapshots({
    students: params.elevesClasse.map((e) => {
      const opt = profilesMap.get(e.id);
      return {
        id: e.id,
        lv2SubjectId: opt?.lv2SubjectId ?? null,
        alevelSubjectIds: opt && opt.alevelSubjectIds.length > 0 ? opt.alevelSubjectIds : null,
      };
    }),
    subjects: subjectsInput,
    sequences: params.sequences,
    notes: mapNotesToSnapshotInputs(params.notesDeClasse),
    hasCoefficientBySubject: params.hasCoefficientBySubject,
    excludeAbsentGrades: true,
    passThresholdOn20: params.passThresholdOn20 ?? 10,
    isAnnual: params.template === 'ANNUAL',
    sequenceCalculationMode: params.sequenceCalculationMode,
  });

  const professorPrincipal = params.classe.professorPrincipalId
    ? await params.userRepository.findById(params.classe.professorPrincipalId)
    : null;
  const mainTeacherName = professorPrincipal?.nomComplet ?? null;

  const presencesByStudent = new Map<string, Presence[]>();
  for (const pid of params.periodIds) {
    for (const p of await params.presenceRepository.findByClasseEtPeriode(params.classe.id, pid)) {
      const arr = presencesByStudent.get(p.studentId) ?? [];
      arr.push(p);
      presencesByStudent.set(p.studentId, arr);
    }
  }

  const sanctionsByStudent = new Map<string, DisciplineRecordData[]>();
  if (params.disciplineRepository) {
    const records = await params.disciplineRepository.findRecordsBySchool(params.school.id, { status: 'ACTIVE', page: 1, limit: 200 });
    for (const r of records) {
      const arr = sanctionsByStudent.get(r.studentId) ?? [];
      arr.push(r);
      sanctionsByStudent.set(r.studentId, arr);
    }
  }

  const sequenceAbsencesByStudent = new Map<string, SequenceAbsenceSummaryRecord[]>();
  if (params.sequenceAbsenceRepository) {
    const seqAbsRows = await params.sequenceAbsenceRepository.findByClassAndPeriods(
      params.school.id,
      params.classe.id,
      params.periodIds,
    );
    for (const r of seqAbsRows) {
      const arr = sequenceAbsencesByStudent.get(r.studentId) ?? [];
      arr.push(r);
      sequenceAbsencesByStudent.set(r.studentId, arr);
    }
  }

  const councilSession = await params.classCouncilRepository.sessionExistente(params.classe.id, params.academicPeriodId);
  const councilByStudent = new Map<string, { decision: CouncilDecision; observations: string | null }>();
  for (const d of councilSession?.decisions ?? []) {
    councilByStudent.set(d.studentId, { decision: d.decision, observations: d.observations ?? null });
  }

  const entriesByStudentId = new Map<string, EnrichedSnapshotEntry>();
  for (const eleve of params.elevesClasse) {
    const baseSnapshot = snapshotsByStudentId.get(eleve.id);
    if (!baseSnapshot || baseSnapshot.subjectLines.length === 0) continue;

    const opt = profilesMap.get(eleve.id);
    let absenceCount = 0;
    for (const pid of params.periodIds) {
      absenceCount += (await params.presenceRepository.getStatistiquesEleve(eleve.id, pid)).joursAbsent;
    }

    const conduct = buildConductForStudent(
      presencesByStudent.get(eleve.id) ?? [],
      sanctionsByStudent.get(eleve.id) ?? [],
      absenceCount,
      sequenceAbsencesByStudent.get(eleve.id) ?? [],
    );
    const enriched: StudentBulletinSnapshot = {
      ...baseSnapshot,
      computationVersion: 2,
      templateVersion: 1,
      mainTeacherName,
      studentIdentity: {
        studentId: eleve.id,
        fullName: eleve.nomComplet,
        firstName: eleve.firstName,
        lastName: eleve.lastName,
        matricule: opt?.matricule ?? null,
        dateOfBirth: opt?.dateOfBirth ? opt.dateOfBirth.toISOString() : null,
        placeOfBirth: opt?.placeOfBirth ?? null,
        gender: opt?.gender ?? null,
        isRepeater: opt?.isRepeater ?? false,
        photoUrl: sanitizePhotoReferenceForSnapshot(opt?.photoUrl, eleve.id),
      },
      conduct,
      councilDecision: buildCouncilDecisionSnapshot(councilByStudent.get(eleve.id), baseSnapshot.generalAverage, conduct.exclusionsCount),
      classProfile,
    };

    const verifyToken = genererVerifyToken();
    entriesByStudentId.set(eleve.id, {
      snapshot: enriched,
      mention: calculerMentionBulletin(enriched.generalAverage, params.template, params.langue),
      absenceCount,
      contentHash: canonicalHashSnapshot(enriched),
      verifyToken,
      shortVerifyCode: deriveShortVerifyCode(verifyToken),
    });
  }

  return { entriesByStudentId, classProfile, mainTeacherName };
}
