/**
 * APPLICATION LAYER — Classe fictive déterministe pour l'aperçu des modèles de bulletins.
 *
 * Génère une vraie classe de 34 élèves fictifs (moyennes variées, ex æquo, notes manquantes)
 * et délègue TOUS les calculs (rangs, effectif, admis, taux, premier, dernier, moyenne de classe)
 * au BulletinSnapshotBuilder. Aucune statistique n'est saisie à la main.
 * Les libellés de groupes proviennent exclusivement du schéma de regroupement configuré.
 */
import type { BulletinTemplateSpec } from '@domain/types/bulletinTemplateSpec';
import type {
  ClassBulletinSnapshotsResult,
  SnapshotNoteInput,
  SnapshotSequenceInput,
  SnapshotSubjectInput,
} from '@domain/types/bulletinSnapshot';
import { BulletinSnapshotBuilder } from '@domain/services/bulletin/BulletinSnapshotBuilder';
import { resolveGroupBySubjectCode } from '@domain/services/bulletin/bulletinGroupingSchemes';

export const PREVIEW_CLASS_SIZE = 34;
export const PREVIEW_FOCUS_STUDENT_ID = 'stu-prev';

export type PreviewFamilyKind = 'GENERAL' | 'TECH' | 'APC' | 'ANNUAL' | 'EN' | 'PRIMARY';

interface PreviewSubjectSeed {
  id: string;
  code: string;
  nameFr: string;
  nameEn: string;
  coefficient: number;
  bias: number;
  teacherName: string;
  competenceLabel?: string;
  maxMark?: number;
  learningDomainFr?: string;
  learningDomainEn?: string;
  learningUnit?: string;
}

const SECONDARY_SUBJECTS: readonly PreviewSubjectSeed[] = [
  { id: 'fr', code: 'FR', nameFr: 'Français', nameEn: 'French', coefficient: 4, bias: 0.4, teacherName: 'Mme ESSOMBA', competenceLabel: 'Produire des textes argumentés' },
  { id: 'ang', code: 'ANG', nameFr: 'Anglais', nameEn: 'English Language', coefficient: 3, bias: 0.8, teacherName: 'Mr CHE' },
  { id: 'philo', code: 'PHILO', nameFr: 'Philosophie', nameEn: 'Philosophy', coefficient: 2, bias: -0.9, teacherName: 'M. ABENA', competenceLabel: 'Argumenter une position' },
  { id: 'esp', code: 'ESP', nameFr: 'Espagnol', nameEn: 'Spanish', coefficient: 2, bias: 0.2, teacherName: 'Mme NGO BALLA' },
  { id: 'math', code: 'MATH', nameFr: 'Mathématiques', nameEn: 'Mathematics', coefficient: 4, bias: -1.2, teacherName: 'M. FOKOU', competenceLabel: 'Résoudre des problèmes algébriques' },
  { id: 'pc', code: 'PC', nameFr: 'Physique-Chimie', nameEn: 'Physics & Chemistry', coefficient: 3, bias: -0.6, teacherName: 'Dr NANA' },
  { id: 'svt', code: 'SVT', nameFr: 'SVT', nameEn: 'Biology', coefficient: 2, bias: 0.3, teacherName: 'Mme BELLO' },
  { id: 'hg', code: 'HG', nameFr: 'Histoire-Géographie', nameEn: 'History & Geography', coefficient: 2, bias: 0, teacherName: 'M. TCHAMBA', competenceLabel: 'Analyser un document historique' },
  { id: 'eps', code: 'EPS', nameFr: 'EPS', nameEn: 'Physical Education', coefficient: 2, bias: 1.6, teacherName: 'M. EBOA' },
  { id: 'tm', code: 'TM', nameFr: 'Travail Manuel', nameEn: 'Manual Labour', coefficient: 1, bias: 1.1, teacherName: 'Mme SALI' },
];

const TECH_SUBJECTS: readonly PreviewSubjectSeed[] = [
  { id: 'tfr', code: 'FR', nameFr: 'Français', nameEn: 'French', coefficient: 2, bias: 0.2, teacherName: 'M. ALIOU' },
  { id: 'tang', code: 'ANG', nameFr: 'Anglais', nameEn: 'English', coefficient: 2, bias: 0.6, teacherName: 'Mme NJOYA' },
  { id: 'tmath', code: 'MATH', nameFr: 'Mathématiques', nameEn: 'Mathematics', coefficient: 3, bias: -1.1, teacherName: 'M. HAMADOU' },
  { id: 'tpc', code: 'PC', nameFr: 'Sciences Physiques', nameEn: 'Physics', coefficient: 2, bias: -0.5, teacherName: 'M. YAYA' },
  { id: 'tdes', code: 'DESSINTE', nameFr: 'Dessin Technique', nameEn: 'Technical Drawing', coefficient: 4, bias: 0.1, teacherName: 'M. BOUBA' },
  { id: 'ttech', code: 'TECHNOLO', nameFr: 'Technologie', nameEn: 'Technology', coefficient: 3, bias: -0.3, teacherName: 'M. DJIBRILLA' },
  { id: 'tprat', code: 'PRATIQUE', nameFr: 'Travaux Pratiques Atelier', nameEn: 'Workshop Practice', coefficient: 5, bias: 0.9, teacherName: 'M. OUMAROU' },
  { id: 'teps', code: 'EPS', nameFr: 'EPS', nameEn: 'Physical Education', coefficient: 1, bias: 1.5, teacherName: 'Mme SALI' },
];

const PRIMARY_SUBJECTS: readonly PreviewSubjectSeed[] = [
  { id: 'p1', code: 'P1', nameFr: 'Grammaire et orthographe', nameEn: 'Grammar & Usage', coefficient: 1, bias: 0.2, teacherName: '', maxMark: 40, learningDomainFr: 'LANGUE ANGLAISE', learningDomainEn: 'ENGLISH LANGUAGE', learningUnit: 'Unit 2' },
  { id: 'p2', code: 'P2', nameFr: 'Lecture compréhension', nameEn: 'Reading Comprehension', coefficient: 1, bias: 0.6, teacherName: '', maxMark: 20, learningDomainFr: 'LANGUE ANGLAISE', learningDomainEn: 'ENGLISH LANGUAGE', learningUnit: 'Unit 2' },
  { id: 'p3', code: 'P3', nameFr: 'Expression écrite', nameEn: 'Composition Writing', coefficient: 1, bias: -0.4, teacherName: '', maxMark: 20, learningDomainFr: 'LANGUE ANGLAISE', learningDomainEn: 'ENGLISH LANGUAGE', learningUnit: 'Unit 2' },
  { id: 'p4', code: 'P4', nameFr: 'Nombres et opérations', nameEn: 'Number & Operations', coefficient: 1, bias: -0.8, teacherName: '', maxMark: 40, learningDomainFr: 'MATHÉMATIQUES', learningDomainEn: 'MATHEMATICS', learningUnit: 'Unit 3' },
  { id: 'p5', code: 'P5', nameFr: 'Résolution de problèmes', nameEn: 'Problem Solving', coefficient: 1, bias: -1.2, teacherName: '', maxMark: 20, learningDomainFr: 'MATHÉMATIQUES', learningDomainEn: 'MATHEMATICS', learningUnit: 'Unit 3' },
  { id: 'p6', code: 'P6', nameFr: 'Mesures et grandeurs', nameEn: 'Measurement', coefficient: 1, bias: 0, teacherName: '', maxMark: 20, learningDomainFr: 'MATHÉMATIQUES', learningDomainEn: 'MATHEMATICS', learningUnit: 'Unit 3' },
  { id: 'p7', code: 'P7', nameFr: 'Corps humain et santé', nameEn: 'Human Body & Health', coefficient: 1, bias: 0.5, teacherName: '', maxMark: 20, learningDomainFr: 'SCIENCES ET TECHNOLOGIE', learningDomainEn: 'SCIENCES AND TECHNOLOGY', learningUnit: 'Unit 1' },
  { id: 'p8', code: 'P8', nameFr: 'Initiation numérique', nameEn: 'Digital Literacy', coefficient: 1, bias: 0.3, teacherName: '', maxMark: 20, learningDomainFr: 'TIC', learningDomainEn: 'ICT', learningUnit: 'Unit 1' },
  { id: 'p9', code: 'P9', nameFr: 'Dessin et coloriage', nameEn: 'Drawing & Colouring', coefficient: 1, bias: 1.2, teacherName: '', maxMark: 10, learningDomainFr: 'ÉDUCATION ARTISTIQUE', learningDomainEn: 'ARTISTIC EDUCATION', learningUnit: 'Unit 4' },
  { id: 'p10', code: 'P10', nameFr: 'Endurance physique', nameEn: 'Physical Endurance', coefficient: 1, bias: 1.4, teacherName: '', maxMark: 10, learningDomainFr: 'SPORT ET ÉDUCATION PHYSIQUE', learningDomainEn: 'SPORT AND PHYSICAL EDUCATION', learningUnit: 'Unit 4' },
];

const COMMENT_POOL_FR: Readonly<Record<'high' | 'good' | 'fair' | 'low', readonly string[]>> = {
  high: ['Excellent travail', 'Très bon niveau', 'Remarquable, continuez'],
  good: ['Bon travail', 'Travail sérieux', 'Bons résultats'],
  fair: ['Assez bien', 'Peut mieux faire', 'Résultats moyens'],
  low: ['Insuffisant', 'Travail à reprendre', "Doit redoubler d'efforts"],
};
const COMMENT_POOL_EN: Readonly<Record<'high' | 'good' | 'fair' | 'low', readonly string[]>> = {
  high: ['Excellent work', 'Very good level', 'Outstanding, keep it up'],
  good: ['Good work', 'Serious effort', 'Good results'],
  fair: ['Fair', 'Can do better', 'Average results'],
  low: ['Weak', 'Needs to work harder', 'Must make more effort'],
};

/** Bruit pseudo-aléatoire déterministe dans [-1, 1] (aucun Math.random : aperçu reproductible). */
function seededNoise(a: number, b: number, c: number): number {
  const x = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

/** Niveau moyen visé par élève : élève suivi = 13,2 ; les 33 autres couvrent 6 à 18,5 sans doublon. */
function studentLevel(index: number): number {
  if (index === 0) return 13.2;
  return 6 + (((index * 7) % 33) / 32) * 12.5;
}

function clampRound(value: number, max: number, step: number): number {
  const bounded = Math.min(max, Math.max(0, value));
  return Math.round(bounded / step) * step;
}

function pickComment(scoreOn20: number, salt: number, isEn: boolean): string {
  const band = scoreOn20 >= 16 ? 'high' : scoreOn20 >= 13 ? 'good' : scoreOn20 >= 10 ? 'fair' : 'low';
  const pool = (isEn ? COMMENT_POOL_EN : COMMENT_POOL_FR)[band];
  return pool[salt % pool.length]!;
}

function buildSequences(kind: PreviewFamilyKind, isEn: boolean): SnapshotSequenceInput[] {
  if (kind === 'ANNUAL') {
    return Array.from({ length: 6 }, (_, i) => ({
      id: `q${i + 1}`, name: `Évaluation ${i + 1}`, orderIndex: i + 1, termIndex: (Math.floor(i / 2) + 1) as 1 | 2 | 3,
    }));
  }
  if (kind === 'PRIMARY') return [{ id: 'm2', name: isEn ? 'Month 2' : 'Mois 2', orderIndex: 1 }];
  // Famille C : aperçu au 2e trimestre → évaluations 3 et 4 (numéros réels de la période)
  const first = kind === 'APC' ? 3 : 1;
  const label = isEn ? 'Sequence' : 'Évaluation';
  return [
    { id: 'qa', name: `${label} ${first}`, orderIndex: 1 },
    { id: 'qb', name: `${label} ${first + 1}`, orderIndex: 2 },
  ];
}

function buildSubjects(spec: BulletinTemplateSpec, kind: PreviewFamilyKind, isEn: boolean): {
  seeds: readonly PreviewSubjectSeed[];
  subjects: SnapshotSubjectInput[];
} {
  const seeds = kind === 'PRIMARY' ? PRIMARY_SUBJECTS : kind === 'TECH' ? TECH_SUBJECTS : SECONDARY_SUBJECTS;
  const scheme = spec.defaultGroupingScheme ?? 'FLAT';
  const withCompetence = kind === 'APC' || kind === 'ANNUAL';
  const subjects = seeds.map((s): SnapshotSubjectInput => {
    const group = resolveGroupBySubjectCode(scheme, s.code);
    return {
      id: s.id,
      name: isEn ? s.nameEn : s.nameFr,
      coefficient: s.coefficient,
      maxMark: s.maxMark,
      learningDomain: isEn ? s.learningDomainEn : s.learningDomainFr,
      learningUnit: s.learningUnit,
      groupKey: group?.groupKey,
      groupLabel: group?.groupLabel,
      groupOrder: group?.groupOrder,
      competenceLabel: withCompetence ? s.competenceLabel : undefined,
      teacherName: s.teacherName || undefined,
    };
  });
  return { seeds, subjects };
}

/**
 * Notes manquantes (élèves dont index % 6 === 2) et matière entière absente (index % 11 === 4).
 * Ex æquo : l'élève 33 recopie strictement les notes de l'élève 7, l'élève 31 celles de l'élève 12.
 */
function sourceIndexFor(index: number): number {
  if (index === 33) return 7;
  if (index === 31) return 12;
  return index;
}

export function buildFictitiousPreviewClass(params: {
  spec: BulletinTemplateSpec;
  kind: PreviewFamilyKind;
  passThresholdOn20: number;
}): ClassBulletinSnapshotsResult {
  const isEn = params.spec.language === 'en';
  const { seeds, subjects } = buildSubjects(params.spec, params.kind, isEn);
  const sequences = buildSequences(params.kind, isEn);
  const isPrimary = params.kind === 'PRIMARY';
  const withFreeComments = params.kind === 'GENERAL' || params.kind === 'EN' || isPrimary;
  const studentIds = Array.from({ length: PREVIEW_CLASS_SIZE }, (_, i) => (i === 0 ? PREVIEW_FOCUS_STUDENT_ID : `stu-fict-${String(i).padStart(2, '0')}`));

  const notes: SnapshotNoteInput[] = [];
  studentIds.forEach((studentId, index) => {
    const src = sourceIndexFor(index);
    const level = studentLevel(src);
    seeds.forEach((seed, si) => {
      if (src % 11 === 4 && si === src % seeds.length) return; // matière non évaluée
      sequences.forEach((seq, qi) => {
        if (src % 6 === 2 && qi === sequences.length - 1 && si === (src + 1) % seeds.length) return; // note manquante
        const max = seed.maxMark ?? 20;
        const on20 = level + seed.bias + seededNoise(src, si, qi) * 2.6 + (params.kind === 'ANNUAL' ? qi * 0.15 : 0);
        const score = clampRound((on20 / 20) * max, max, max === 20 ? 0.25 : 0.5);
        const isLastSeq = qi === sequences.length - 1;
        const custom = params.kind === 'TECH' && index === 0 && si === 6 ? 'Très habile en atelier, à encourager' : undefined;
        notes.push({
          studentId,
          subjectId: seed.id,
          sequenceId: seq.id,
          coefficient: seed.coefficient,
          maxValue: max,
          sequenceScore: score,
          observation: isLastSeq ? (custom ?? (withFreeComments ? pickComment((score / max) * 20, src + si, isEn) : undefined)) : undefined,
          validationStatus: 'LOCKED',
        });
      });
    });
  });

  const tableBlock = params.spec.blocks.find((b) => b.type === 'subjectTable');
  return BulletinSnapshotBuilder.buildClassSnapshots({
    students: studentIds.map((id) => ({ id })),
    subjects,
    sequences,
    notes,
    hasCoefficientBySubject: !isPrimary,
    isAnnual: params.kind === 'ANNUAL',
    calculationMode: isPrimary ? 'POINTS_RATIO' : undefined,
    passThresholdOn20: params.passThresholdOn20,
    scaleConfig: tableBlock?.type === 'subjectTable' ? tableBlock.scaleConfig : undefined,
  });
}

