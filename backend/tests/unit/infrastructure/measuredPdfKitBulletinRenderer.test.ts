import { describe, it, expect } from 'bun:test';
import PDFDocument from 'pdfkit';
import type { StudentBulletinSnapshot } from '@domain/types/bulletinSnapshot';
import type { BulletinTemplateSpec } from '@domain/types/bulletinTemplateSpec';
import type { BulletinRenderOptions } from '@domain/ports/services/BulletinRendererPort';
import { MeasuredPdfKitBulletinRenderer } from '@infrastructure/pdf/renderer/MeasuredPdfKitBulletinRenderer';
import {
  registerEmbeddedFonts,
  resolveEmbeddedFontPaths,
  verifyEmbeddedFontsExist,
} from '@infrastructure/pdf/renderer/measuredHeaderHelpers';

const LONG_COMMENT =
  'Travail très sérieux tout au long du trimestre. L’élève maîtrise les notions théoriques et résout avec rigueur les exercices complexes ; il convient toutefois d’approfondir la justification écrite des étapes intermédiaires et d’accorder davantage d’attention aux applications expérimentales pour viser la mention Très Bien.';

const SPEC_FAMILLE_A_TEST: BulletinTemplateSpec = {
  id: 'spec-test-a',
  familyKey: 'A',
  name: 'Famille A Test',
  version: 1,
  language: 'fr',
  grayscaleFirst: true,
  page: { size: 'A4', orientation: 'portrait', margin: 24 },
  blocks: [
    { type: 'officialHeader', bilingual: true, showDelegations: true, showLogo: true, showCoatOfArms: false, showMotto: true },
    { type: 'studentCard', fields: ['photo', 'matricule', 'birth', 'sex', 'repeater', 'classSize', 'mainTeacher'] },
    {
      type: 'subjectTable',
      grouping: 'byGroup',
      showGroupSubtotals: true,
      appreciationScale: 'A+/A/ECA/NA',
      columns: [
        { key: 'subjectName', labelFr: 'MATIÈRES', labelEn: 'SUBJECTS', ratio: 22, align: 'left' },
        { key: 'seq1Score', labelFr: 'CC', labelEn: 'T1', ratio: 7 },
        { key: 'seq2Score', labelFr: 'DS', labelEn: 'T2', ratio: 7 },
        { key: 'subjectAverage', labelFr: 'EVA/20', labelEn: 'AVG', ratio: 8 },
        { key: 'coefficient', labelFr: 'COEF', labelEn: 'COEF', ratio: 6 },
        { key: 'weightedScore', labelFr: 'TOTAL', labelEn: 'WGT', ratio: 8 },
        { key: 'subjectRank', labelFr: 'RANG', labelEn: 'RANK', ratio: 6 },
        { key: 'cote', labelFr: 'COTE', labelEn: 'GRD', ratio: 6 },
        { key: 'teacherComment', labelFr: 'APPRÉCIATION', labelEn: 'COMMENT', ratio: 20, align: 'left' },
        { key: 'teacherName', labelFr: 'ENSEIGNANT', labelEn: 'TEACHER', ratio: 10, align: 'left' },
      ],
    },
    { type: 'classProfile', fields: ['classAverage', 'topAverage', 'lowAverage', 'passCount', 'passRate'] },
    { type: 'councilDecision', items: ['honorRoll', 'encouragements', 'congratulations', 'observations', 'warning', 'blame'] },
    { type: 'conductSummary', absenceUnit: 'hours', fields: ['absJ', 'absNJ', 'days', 'late', 'warnings', 'blames'] },
    { type: 'signatures', slots: ['parent', 'mainTeacher', 'principal'], showStamp: true, showPlaceDate: true },
    { type: 'verifyQr', position: 'bottomRight', showVerificationCode: true },
  ],
};

function buildSnapshot(subjectCount: number): StudentBulletinSnapshot {
  const groups = [
    { key: 'G1', label: '1er Groupe', order: 1 },
    { key: 'G2', label: '2e Groupe', order: 2 },
    { key: 'G3', label: '3e Groupe', order: 3 },
  ];
  const scorePattern = [18.5, 16, 12.5, 8.5];
  const subjectLines = Array.from({ length: subjectCount }, (_, idx) => {
    const grp = groups[idx % 3]!;
    const avg = scorePattern[idx % scorePattern.length]!;
    return {
      subjectId: `sub-${idx + 1}`,
      subjectName: `Discipline ${idx + 1} — Intitulé complet`,
      coefficient: (idx % 3) + 1,
      groupKey: grp.key,
      groupLabel: grp.label,
      groupOrder: grp.order,
      seq1Score: avg,
      seq2Score: avg,
      subjectAverage: avg,
      weightedScore: avg * ((idx % 3) + 1),
      subjectRank: (idx % 10) + 1,
      subjectTotalStudents: 60,
      classSubjectAverage: 12.1,
      minSubjectAverage: 6.0,
      maxSubjectAverage: 19.0,
      teacherComment: `${LONG_COMMENT} (#${idx + 1})`,
      teacherName: `Prof. ${idx + 1}`,
    };
  });

  return {
    studentId: 'stu-1',
    computationVersion: 2,
    templateVersion: 1,
    generalAverage: 14.25,
    totalCoefficient: subjectLines.reduce((s, l) => s + l.coefficient, 0),
    totalWeightedScore: subjectLines.reduce((s, l) => s + l.weightedScore, 0),
    rank: 4,
    totalStudents: 60,
    mainTeacherName: 'Mme Ateba',
    studentIdentity: {
      studentId: 'stu-1',
      fullName: 'KAMGA FOTSING Jean-Baptiste',
      firstName: 'Jean-Baptiste',
      lastName: 'KAMGA FOTSING',
      matricule: 'LQ-26-0042',
      dateOfBirth: '2010-02-19T00:00:00.000Z',
      placeOfBirth: 'Bafoussam',
      gender: 'M',
      isRepeater: false,
      photoUrl: null,
    },
    conduct: {
      justifiedAbsenceHours: null,
      unjustifiedAbsenceHours: null,
      totalAbsenceHours: null,
      totalAbsenceDays: 2,
      lateCount: 1,
      warningsCount: 0,
      blamesCount: 0,
      exclusionsCount: 0,
      consignesCount: 0,
      sanctions: [],
    },
    councilDecision: {
      decision: 'PASS',
      observations: 'Félicitations du conseil.',
      honorRoll: true,
      encouragements: true,
      congratulations: false,
    },
    classProfile: { classSize: 60, classAverage: 11.8, topAverage: 17.6, lowAverage: 5.9, passCount: 45, passRate: 75 },
    subjectLines,
    groupSummaries: groups.map((g) => ({
      groupKey: g.key, groupLabel: g.label, groupOrder: g.order,
      totalCoefficient: 10, totalWeightedScore: 142.5, groupAverage: 14.25, groupRank: 4, groupTotalStudents: 60,
    })),
  };
}

function buildOptions(overrides: Partial<BulletinRenderOptions> = {}): BulletinRenderOptions {
  return {
    className: '3ème Bilingue',
    periodName: 'Trimestre 1',
    yearName: '2025-2026',
    mention: 'Bien',
    language: 'fr',
    isOfficial: true,
    verifyUrl: 'https://zekoulabia.cm/verify/tok-xyz',
    verifyToken: 'tok-xyz-123456',
    school: {
      schoolName: 'Collège Bilingue Le Québécois',
      schoolMotto: '',
      regionalDelegation: 'Délégation Régionale du Nord',
      departmentalDelegation: 'Délégation Départementale de la Bénoué',
      city: 'Garoua',
    },
    ...overrides,
  };
}

describe('MeasuredPdfKitBulletinRenderer — Étape 3', () => {
  const renderer = new MeasuredPdfKitBulletinRenderer();

  it('rend 20 matières en 3 groupes avec appréciations > 300 chars sans aucun chevauchement vertical', async () => {
    expect(LONG_COMMENT.length).toBeGreaterThan(300);
    const drawnTexts: string[] = [];
    const pageRows = new Map<number, Array<{ y: number; h: number }>>();
    const docPages = new WeakMap<object, number>();

    const origAddPage = PDFDocument.prototype.addPage;
    const origRect = PDFDocument.prototype.rect;
    const origText = PDFDocument.prototype.text;

    PDFDocument.prototype.addPage = function patchedAddPage(this: PDFKit.PDFDocument, ...args: unknown[]) {
      docPages.set(this, (docPages.get(this) ?? 1) + 1);
      return (origAddPage as (...a: unknown[]) => PDFKit.PDFDocument).apply(this, args);
    } as typeof PDFDocument.prototype.addPage;

    PDFDocument.prototype.rect = function patchedRect(
      this: PDFKit.PDFDocument,
      x: number,
      y: number,
      w: number,
      h: number,
    ) {
      if (w >= 400 && h >= 14 && h <= 160) {
        const page = docPages.get(this) ?? 1;
        const list = pageRows.get(page) ?? [];
        list.push({ y, h });
        pageRows.set(page, list);
      }
      return origRect.call(this, x, y, w, h);
    } as typeof PDFDocument.prototype.rect;

    PDFDocument.prototype.text = function patchedText(
      this: PDFKit.PDFDocument,
      text?: string,
      ...rest: unknown[]
    ) {
      if (typeof text === 'string') drawnTexts.push(text);
      return (origText as (...args: unknown[]) => PDFKit.PDFDocument).call(this, text, ...rest);
    } as typeof PDFDocument.prototype.text;

    try {
      const buf = await renderer.render(
        buildSnapshot(20),
        SPEC_FAMILLE_A_TEST,
        buildOptions({ isDuplicate: true, reprintCount: 2 }),
      );
      expect(buf.subarray(0, 5).toString('utf8')).toBe('%PDF-');
      expect(buf.length).toBeGreaterThan(5000);

      for (const [, rows] of pageRows.entries()) {
        for (let i = 1; i < rows.length; i++) {
          const prev = rows[i - 1]!;
          const curr = rows[i]!;
          expect(curr.y).toBeGreaterThanOrEqual(prev.y + prev.h - 0.1);
        }
      }

      // Lisibilité N&B : cotes explicites, heures null en « — », marque DUPLICATA, zéro devise vide
      expect(drawnTexts).toContain('A+');
      expect(drawnTexts).toContain('A');
      expect(drawnTexts).toContain('ECA');
      expect(drawnTexts).toContain('NA');
      expect(drawnTexts.some((t) => t.includes('Abs. justifiées : —') && t.includes('Abs. non justifiées : —'))).toBe(true);
      expect(drawnTexts.some((t) => t.includes('DUPLICATA n° 2'))).toBe(true);
      expect(drawnTexts.some((t) => t.trim() === '' || t.trim() === '""')).toBe(false);
    } finally {
      PDFDocument.prototype.addPage = origAddPage;
      PDFDocument.prototype.rect = origRect;
      PDFDocument.prototype.text = origText;
    }
  });

  it('vérifie la présence des polices TTF embarquées et échoue explicitement si une police est introuvable', () => {
    expect(() => verifyEmbeddedFontsExist()).not.toThrow();
    const missingPaths = resolveEmbeddedFontPaths('/dossier/polices/inexistant');
    expect(() => verifyEmbeddedFontsExist(missingPaths)).toThrow(/Police TTF embarquée introuvable/);

    const doc = new PDFDocument({ size: 'A4' });
    expect(() => registerEmbeddedFonts(doc, '/dossier/polices/inexistant')).toThrow(/Police TTF embarquée introuvable/);
  });

  it('génère un lot complet de 60 bulletins (18 matières) largement sous le seuil de 3 minutes', async () => {
    const items = Array.from({ length: 60 }, () => ({
      snapshot: buildSnapshot(18),
      options: buildOptions(),
    }));
    const t0 = performance.now();
    const buffers = await renderer.renderBatch(items, SPEC_FAMILLE_A_TEST);
    const elapsedMs = performance.now() - t0;

    expect(buffers).toHaveLength(60);
    for (const b of buffers) {
      expect(b.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    }
    expect(elapsedMs).toBeLessThan(180_000);
  }, 30_000);
});
