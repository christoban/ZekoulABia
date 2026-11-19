/**
 * APPLICATION LAYER — Génération d'aperçu PDF sur élève fictif pour l'Atelier Master & l'aperçu Admin.
 */
import type { SchoolAssetStoragePort } from '@domain/ports/services/SchoolAssetStoragePort';
import type { SchoolIdentityKitRecord } from '@domain/ports/repositories/SchoolIdentityKitRepository';
import type { BulletinRendererPort } from '@domain/ports/services/BulletinRendererPort';
import type { BulletinTemplateSpec } from '@domain/types/bulletinTemplateSpec';
import type { StudentBulletinSnapshot } from '@domain/types/bulletinSnapshot';
import { BulletinSnapshotBuilder } from '@domain/services/bulletin/BulletinSnapshotBuilder';
import { buildLongTokenVerifyUrl, deriveShortVerifyCode } from '@domain/policies/BulletinVerifyCrypto';
import { createBatchSchoolIdentityContextCache } from './bulletinIdentityContext';
import { resoudreVerifyBaseUrl } from './bulletinEnrichmentHelpers';

const PREVIEW_VERIFY_TOKEN = 'aabbccddeeff00112233445566778899aabbccddeeff0011';

function buildPreviewInputsForFamily(spec: BulletinTemplateSpec) {
  const isAnnual = spec.layoutVariant === 'ANNUAL_BILINGUAL' || spec.familyKey === 'D';
  const isTech = spec.layoutVariant === 'TECHNICAL_GROUPED' || spec.familyKey === 'B';
  const isPrimaryRatio = spec.layoutVariant === 'PRIMARY_POINTS_RATIO' || spec.familyKey === 'F';
  const isEn = spec.language === 'en';

  if (isPrimaryRatio) {
    const subs = [
      { id: 'f1', name: isEn ? 'Grammar & Usage' : 'Grammaire & Orthographe', coefficient: 1, maxMark: 40, learningDomain: isEn ? 'ENGLISH LANGUAGE' : 'FRANÇAIS', learningUnit: 'Unit 1' },
      { id: 'f2', name: isEn ? 'Reading Comprehension' : 'Lecture Compréhension', coefficient: 1, maxMark: 20, learningDomain: isEn ? 'ENGLISH LANGUAGE' : 'FRANÇAIS', learningUnit: 'Unit 1' },
      { id: 'f3', name: isEn ? 'Number & Operations' : 'Nombres & Calculs', coefficient: 1, maxMark: 40, learningDomain: isEn ? 'MATHEMATICS' : 'MATHÉMATIQUES', learningUnit: 'Unit 2' },
      { id: 'f4', name: isEn ? 'Problem Solving' : 'Résolution de problèmes', coefficient: 1, maxMark: 20, learningDomain: isEn ? 'MATHEMATICS' : 'MATHÉMATIQUES', learningUnit: 'Unit 2' },
      { id: 'f5', name: isEn ? 'Human Body & Health' : 'Sciences de la vie', coefficient: 1, maxMark: 20, learningDomain: isEn ? 'SCIENCES AND TECHNOLOGY' : 'SCIENCES', learningUnit: 'Unit 1' },
      { id: 'f6', name: isEn ? 'Digital Literacy' : 'TIC & Outils', coefficient: 1, maxMark: 20, learningDomain: 'ICT', learningUnit: 'Unit 1' },
    ];
    const res = BulletinSnapshotBuilder.buildClassSnapshots({
      students: [{ id: 'stu-prev' }, { id: 'stu-prev-2' }],
      subjects: subs,
      sequences: [{ id: 's1', name: 'M1', orderIndex: 1 }],
      notes: [
        ...[28, 15, 30, 14, 15, 16].map((sc, i) => ({
          studentId: 'stu-prev', subjectId: `f${i + 1}`, sequenceId: 's1', coefficient: 1, maxValue: subs[i]!.maxMark, sequenceScore: sc, observation: isEn ? 'Good progress' : 'Bon travail', validationStatus: 'LOCKED' as const,
        })),
        ...[20, 12, 22, 11, 12, 13].map((sc, i) => ({
          studentId: 'stu-prev-2', subjectId: `f${i + 1}`, sequenceId: 's1', coefficient: 1, maxValue: subs[i]!.maxMark, sequenceScore: sc, validationStatus: 'LOCKED' as const,
        })),
      ],
      hasCoefficientBySubject: false,
      calculationMode: 'POINTS_RATIO',
    });
    return {
      snapshot: res.snapshotsByStudentId.get('stu-prev')!,
      className: isEn ? 'Class V (Preview)' : 'CM2 (Aperçu)',
      periodName: isEn ? 'Month 1 — Term 1' : 'Mois 1 — Trimestre 1',
      yearName: '2026-2027',
      mention: isEn ? 'Very Good' : 'Bien',
    };
  }

  const subjects = isTech
    ? [
        { id: 't1', name: 'Français Technique', coefficient: 2, groupKey: 'GENERAL', groupLabel: 'Enseignement Général', groupOrder: 1, teacherName: 'M. ALIOU' },
        { id: 't2', name: 'Mathématiques Appliquées', coefficient: 3, groupKey: 'GENERAL', groupLabel: 'Enseignement Général', groupOrder: 1, teacherName: 'M. HAMADOU' },
        { id: 't3', name: 'Dessin Industriel', coefficient: 4, groupKey: 'PROFESSIONNEL', groupLabel: 'Enseignement Professionnel', groupOrder: 2, teacherName: 'M. BOUBA' },
        { id: 't4', name: 'Atelier Pratique', coefficient: 5, groupKey: 'PROFESSIONNEL', groupLabel: 'Enseignement Professionnel', groupOrder: 2, teacherName: 'M. OUMAROU' },
        { id: 't5', name: 'EPS', coefficient: 1, groupKey: 'DIVERS', groupLabel: 'Enseignements Divers', groupOrder: 3, teacherName: 'Mme SALI' },
      ]
    : [
        { id: 's1', name: isEn ? 'English Language' : 'Français', coefficient: 4, groupKey: 'G1', groupLabel: isEn ? 'Arts & Languages' : '1er Groupe (Littéraire)', groupOrder: 1, competenceLabel: spec.layoutVariant === 'BILINGUAL_APC' || isAnnual ? 'Expression écrite et orale' : undefined, teacherName: 'Mme ESSOMBA' },
        { id: 's2', name: isEn ? 'French' : 'Anglais', coefficient: 3, groupKey: 'G1', groupLabel: isEn ? 'Arts & Languages' : '1er Groupe (Littéraire)', groupOrder: 1, teacherName: 'Mr CHE' },
        { id: 's3', name: isEn ? 'Mathematics' : 'Mathématiques', coefficient: 4, groupKey: 'G2', groupLabel: isEn ? 'Sciences' : '2ème Groupe (Scientifique)', groupOrder: 2, competenceLabel: spec.layoutVariant === 'BILINGUAL_APC' || isAnnual ? 'Résolution algébrique' : undefined, teacherName: 'M. FOKOU' },
        { id: 's4', name: isEn ? 'Physics & Chemistry' : 'Physique-Chimie', coefficient: 3, groupKey: 'G2', groupLabel: isEn ? 'Sciences' : '2ème Groupe (Scientifique)', groupOrder: 2, teacherName: 'Dr NANA' },
        { id: 's5', name: isEn ? 'Physical Education' : 'EPS', coefficient: 2, groupKey: 'G3', groupLabel: isEn ? 'Other' : '3ème Groupe', groupOrder: 3, teacherName: 'M. EBOA' },
      ];

  const seqs = isAnnual
    ? Array.from({ length: 6 }, (_, i) => ({ id: `q${i + 1}`, name: `Eval ${i + 1}`, orderIndex: i + 1, termIndex: (Math.floor(i / 2) + 1) as 1 | 2 | 3 }))
    : [{ id: 'q1', name: 'Eval 1', orderIndex: 1 }, { id: 'q2', name: 'Eval 2', orderIndex: 2 }];

  const notes = subjects.flatMap((sub, si) =>
    seqs.flatMap((seq, qi) => [
      { studentId: 'stu-prev', subjectId: sub.id, sequenceId: seq.id, coefficient: sub.coefficient, sequenceScore: 13 + ((si + qi) % 5), observation: isEn ? 'Steady work' : 'Travail sérieux', validationStatus: 'LOCKED' as const },
      { studentId: 'stu-prev-2', subjectId: sub.id, sequenceId: seq.id, coefficient: sub.coefficient, sequenceScore: 10 + ((si + qi) % 4), validationStatus: 'LOCKED' as const },
    ]),
  );

  const res = BulletinSnapshotBuilder.buildClassSnapshots({
    students: [{ id: 'stu-prev' }, { id: 'stu-prev-2' }],
    subjects,
    sequences: seqs,
    notes,
    hasCoefficientBySubject: true,
    isAnnual,
    classSizeOverride: 42,
  });

  return {
    snapshot: res.snapshotsByStudentId.get('stu-prev')!,
    className: isEn ? 'Form 4 Science (Preview)' : isTech ? '2nde F3 (Aperçu)' : isAnnual ? '1ère A4 (Aperçu)' : '3ème Bilingue (Aperçu)',
    periodName: isAnnual ? 'Annuel' : isEn ? 'Term 1' : 'Trimestre 1',
    yearName: '2026-2027',
    mention: isEn ? 'Very Good' : 'Bien',
  };
}

export function buildFictitiousPreviewSnapshot(spec: BulletinTemplateSpec): {
  snapshot: StudentBulletinSnapshot;
  className: string;
  periodName: string;
  yearName: string;
  mention: string;
} {
  const base = buildPreviewInputsForFamily(spec);
  const enriched: StudentBulletinSnapshot = {
    ...base.snapshot,
    mainTeacherName: spec.language === 'en' ? 'Mr CHE Emmanuel (Sample)' : 'Mme ESSOMBA Claire (Fictif)',
    studentIdentity: {
      studentId: 'stu-prev',
      fullName: spec.language === 'en' ? 'NDAMUKONG Grace (Sample)' : 'KAMGA Élodie (Élève Fictif)',
      firstName: spec.language === 'en' ? 'Grace' : 'Élodie',
      lastName: spec.language === 'en' ? 'NDAMUKONG' : 'KAMGA',
      matricule: '26-PREVIEW-001',
      dateOfBirth: '2010-05-14T00:00:00.000Z',
      placeOfBirth: 'Garoua',
      gender: 'F',
      isRepeater: false,
      photoUrl: null,
    },
    conduct: {
      justifiedAbsenceHours: 2,
      unjustifiedAbsenceHours: 0,
      totalAbsenceHours: 2,
      trimesterAbsences: { t1: { j: 2, nj: 0 }, t2: { j: 0, nj: 0 }, t3: { j: 0, nj: 0 } },
      workDayPenaltyDays: 0,
      totalAbsenceDays: 0,
      lateCount: 0,
      warningsCount: 0,
      blamesCount: 0,
      exclusionsCount: 0,
      consignesCount: 0,
      sanctions: [],
    },
    councilDecision: {
      decision: 'PASS',
      observations: spec.language === 'en' ? 'Commendable specimen term.' : 'Aperçu spécimen du modèle configuré.',
      honorRoll: true,
      encouragements: true,
      congratulations: false,
      promotedToClass: 'Terminale A4',
    },
  };
  return { ...base, snapshot: enriched };
}

export async function renderAtelierPreviewPdf(params: {
  schoolName: string;
  fallbackMotto?: string | null;
  fallbackCity?: string | null;
  fallbackPhone?: string | null;
  fallbackLogoUrl?: string | null;
  kit: SchoolIdentityKitRecord | null;
  spec: BulletinTemplateSpec;
  renderer: BulletinRendererPort;
  schoolAssetStorage?: SchoolAssetStoragePort;
}): Promise<Buffer> {
  const language: 'fr' | 'en' = params.spec.language === 'en' ? 'en' : 'fr';
  const preview = buildFictitiousPreviewSnapshot(params.spec);
  const schoolIdentity = await createBatchSchoolIdentityContextCache({
    schoolName: params.schoolName,
    fallbackMotto: params.fallbackMotto,
    fallbackCity: params.fallbackCity,
    fallbackPhone: params.fallbackPhone,
    fallbackLogoUrl: params.fallbackLogoUrl,
    kit: params.kit,
    schoolAssetStorage: params.schoolAssetStorage,
  }).getForLanguage(language);

  const verifyBaseUrl = resoudreVerifyBaseUrl();
  return params.renderer.render(preview.snapshot, params.spec, {
    className: preview.className,
    periodName: preview.periodName,
    yearName: preview.yearName,
    isAnnual: params.spec.layoutVariant === 'ANNUAL_BILINGUAL' || params.spec.targetTemplate === 'ANNUAL',
    mention: preview.mention,
    language,
    isOfficial: true,
    verifyToken: PREVIEW_VERIFY_TOKEN,
    shortVerifyCode: deriveShortVerifyCode(PREVIEW_VERIFY_TOKEN),
    verifyUrl: buildLongTokenVerifyUrl(verifyBaseUrl, PREVIEW_VERIFY_TOKEN),
    school: schoolIdentity,
  });
}

