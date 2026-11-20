import { describe, it, expect } from 'bun:test';
import PDFDocument from 'pdfkit';
import { BulletinSnapshotBuilder } from '@domain/services/bulletin/BulletinSnapshotBuilder';
import { buildCouncilDecisionSnapshot } from '@application/reportCard/bulletinEnrichmentHelpers';
import type { BulletinSnapshotBuildInput, StudentBulletinSnapshot } from '@domain/types/bulletinSnapshot';
import {
  ANNUAL_BILINGUAL_V1,
  BILINGUAL_APC_V1,
  EN_SECONDARY_V1,
  PRIMARY_POINTS_RATIO_EN_V1,
  PRIMARY_POINTS_RATIO_FR_V1,
  TECH_GROUPED_V1,
  findDefaultSpecForTemplate,
  getPublishedTemplateSpec,
} from '@domain/templates/bulletinCatalog';
import { MeasuredPdfKitBulletinRenderer } from '@infrastructure/pdf/renderer/MeasuredPdfKitBulletinRenderer';

describe('Étape 6 — Jeux de vérité calculés à la main (Familles F, D, B, C)', () => {
  it('Famille F (POINTS_RATIO) : 22 sous-compétences (245 / 440) => Moyenne = round2((245 / 440) * 20) = 11.14 et 24/40 => 12.00', () => {
    const seqs = [{ id: 's1', name: 'Month 1', orderIndex: 1 }];
    // 22 sous-compétences fictives dont la somme exacte vaut 245 / 440 :
    // 1x (24/40) + 19x (11/20) + 1x (6/10) + 1x (6/10) => raw = 24 + 209 + 6 + 6 = 245 ; max = 40 + 380 + 10 + 10 = 440
    const subjects = [
      { id: 'f-1', name: 'Grammar & Usage', code: 'ENG_GRAM', coefficient: 1, maxMark: 40, learningDomain: 'ENGLISH LANGUAGE', learningUnit: 'Unit 1' },
      ...Array.from({ length: 19 }, (_, idx) => ({
        id: `f-${idx + 2}`,
        name: `Sub-skill ${idx + 2}`,
        code: `SUB_${idx + 2}`,
        coefficient: 1,
        maxMark: 20,
        learningDomain: idx < 6 ? 'MATHEMATICS' : idx < 12 ? 'FRENCH' : 'SCIENCES AND TECHNOLOGY',
        learningUnit: `Unit ${Math.floor(idx / 4) + 1}`,
      })),
      { id: 'f-21', name: 'Penmanship', code: 'PEN', coefficient: 1, maxMark: 10, learningDomain: 'ARTISTIC EDUCATION', learningUnit: 'Unit 5' },
      { id: 'f-22', name: 'Physical Endurance', code: 'EPS_P', coefficient: 1, maxMark: 10, learningDomain: 'SPORT AND PHYSICAL EDUCATION', learningUnit: 'Unit 5' },
    ];

    const notes = [
      { studentId: 'st-1', subjectId: 'f-1', sequenceId: 's1', coefficient: 1, maxValue: 40, sequenceScore: 24, validationStatus: 'LOCKED' as const },
      ...Array.from({ length: 19 }, (_, idx) => ({
        studentId: 'st-1', subjectId: `f-${idx + 2}`, sequenceId: 's1', coefficient: 1, maxValue: 20, sequenceScore: 11, validationStatus: 'LOCKED' as const,
      })),
      { studentId: 'st-1', subjectId: 'f-21', sequenceId: 's1', coefficient: 1, maxValue: 10, sequenceScore: 6, validationStatus: 'LOCKED' as const },
      { studentId: 'st-1', subjectId: 'f-22', sequenceId: 's1', coefficient: 1, maxValue: 10, sequenceScore: 6, validationStatus: 'LOCKED' as const },
    ];

    const res = BulletinSnapshotBuilder.buildClassSnapshots({
      students: [{ id: 'st-1' }],
      subjects,
      sequences: seqs,
      notes,
      hasCoefficientBySubject: false,
      calculationMode: 'POINTS_RATIO',
      requireLockedGrades: true,
    } as BulletinSnapshotBuildInput);

    const snap = res.snapshotsByStudentId.get('st-1')!;
    expect(snap.calculationMode).toBe('POINTS_RATIO');
    expect(snap.totalRawMarks).toBe(245);
    expect(snap.totalMaxMarks).toBe(440);
    // Calcul à la main : (245 / 440) * 20 = 11.136363... -> 11.14
    expect(snap.generalAverage).toBe(11.14);

    const gramLine = snap.subjectLines.find((l) => l.subjectId === 'f-1')!;
    expect(gramLine.rawMark).toBe(24);
    expect(gramLine.maxMark).toBe(40);
    expect(gramLine.subjectAverage).toBe(12);
    expect(gramLine.competenceCote).toBe('ECA');
  });

  it('Famille D (Annuel bilingue 1ère A) : moyennes trimestrielles par matière/groupe, rangs sur 6 séquences et zéro décision annuelle auto-inventée', () => {
    const seqs = [
      { id: 'seq1', name: 'Eval 1', orderIndex: 1, termIndex: 1 as const },
      { id: 'seq2', name: 'Eval 2', orderIndex: 2, termIndex: 1 as const },
      { id: 'seq3', name: 'Eval 3', orderIndex: 3, termIndex: 2 as const },
      { id: 'seq4', name: 'Eval 4', orderIndex: 4, termIndex: 2 as const },
      { id: 'seq5', name: 'Eval 5', orderIndex: 5, termIndex: 3 as const },
      { id: 'seq6', name: 'Eval 6', orderIndex: 6, termIndex: 3 as const },
    ];
    const subjects = [
      { id: 'fr', name: 'Français', coefficient: 4, groupKey: 'GROUPE_1', groupLabel: '1er Groupe', groupOrder: 1 },
      { id: 'math', name: 'Mathématiques', coefficient: 3, groupKey: 'GROUPE_2', groupLabel: '2ème Groupe', groupOrder: 2 },
    ];
    // Élève 1 : FR = [12, 14, 10, 16, 15, 17] -> Tri1=13, Tri2=13, Tri3=16, An=14 ; MATH = [10, 12, 14, 12, 16, 14] -> Tri1=11, Tri2=13, Tri3=15
    // Élève 2 : FR = [16, 16, 16, 16, 16, 16], MATH = [8, 8, 8, 8, 8, 8] -> moy seq = (16*4 + 8*3)/7 = 88/7 = 12.57
    const notes = [
      ...[12, 14, 10, 16, 15, 17].map((s, i) => ({ studentId: 'e1', subjectId: 'fr', sequenceId: `seq${i + 1}`, coefficient: 4, sequenceScore: s, validationStatus: 'LOCKED' as const })),
      ...[10, 12, 14, 12, 16, 14].map((s, i) => ({ studentId: 'e1', subjectId: 'math', sequenceId: `seq${i + 1}`, coefficient: 3, sequenceScore: s, validationStatus: 'LOCKED' as const })),
      ...Array.from({ length: 6 }, (_, i) => ({ studentId: 'e2', subjectId: 'fr', sequenceId: `seq${i + 1}`, coefficient: 4, sequenceScore: 16, validationStatus: 'LOCKED' as const })),
      ...Array.from({ length: 6 }, (_, i) => ({ studentId: 'e2', subjectId: 'math', sequenceId: `seq${i + 1}`, coefficient: 3, sequenceScore: 8, validationStatus: 'LOCKED' as const })),
    ];

    const res = BulletinSnapshotBuilder.buildClassSnapshots({
      students: [{ id: 'e1' }, { id: 'e2' }],
      subjects,
      sequences: seqs,
      notes,
      hasCoefficientBySubject: true,
      isAnnual: true,
      annualPolicy: 'SIX_SEQUENCES_ARITHMETIC',
    });

    const snap1 = res.snapshotsByStudentId.get('e1')!;
    const fr1 = snap1.subjectLines.find((l) => l.subjectId === 'fr')!;
    expect(fr1.trim1Average).toBe(13);
    expect(fr1.trim2Average).toBe(13);
    expect(fr1.trim3Average).toBe(16);
    expect(fr1.subjectAverage).toBe(14);

    // Moyenne de groupe par trimestre et par séquence
    const grp1Bd = snap1.groupBreakdowns?.['GROUPE_1']!;
    expect(grp1Bd.trim1Average).toBe(13);
    expect(grp1Bd.seq1Average).toBe(12);
    expect(grp1Bd.seq6Average).toBe(17);

    // Rangs sur chaque séquence : seq1 -> e1=(12*4+10*3)/7=11.14 (rang 2), e2=12.57 (rang 1)
    expect(snap1.sequenceAverages).toHaveLength(6);
    expect(snap1.sequenceAverages![0]!.average).toBe(11.14);
    expect(snap1.sequenceAverages![0]!.rank).toBe(2);
    expect(snap1.sequenceAverages![5]!.rank).toBe(1);

    // Décision annuelle : jamais inventée sans ClassCouncilDecision
    expect(buildCouncilDecisionSnapshot(undefined, 15.5, 0)).toBeUndefined();
    const explicitPass = buildCouncilDecisionSnapshot(
      { decision: 'PASS', observations: 'Admis en Terminale' },
      15.5,
      0,
      { isAnnual: true },
    );
    expect(explicitPass?.decision).toBe('PASS');
    expect(explicitPass?.honorRoll).toBe(false);
  });

  it('Famille B (Technique) : sous-totaux Général / Professionnel / Divers avec groupRank et appréciation de compétence de groupe', () => {
    const seqs = [
      { id: 's1', name: 'Eval 1', orderIndex: 1 },
      { id: 's2', name: 'Eval 2', orderIndex: 2 },
    ];
    const subjects = [
      { id: 'g1', name: 'Français Technique', coefficient: 2, groupKey: 'GENERAL', groupLabel: 'Enseignement Général', groupOrder: 1 },
      { id: 'p1', name: 'Dessin Industriel', coefficient: 5, groupKey: 'PROFESSIONNEL', groupLabel: 'Enseignement Professionnel', groupOrder: 2 },
      { id: 'd1', name: 'EPS', coefficient: 1, groupKey: 'DIVERS', groupLabel: 'Enseignements Divers', groupOrder: 3 },
    ];
    const notes = [
      // Élève 1 : Gen=14 (acquise >= 14), Pro=12 (en cours 11..13,99), Div=14
      { studentId: 'a1', subjectId: 'g1', sequenceId: 's1', coefficient: 2, sequenceScore: 14, validationStatus: 'LOCKED' as const },
      { studentId: 'a1', subjectId: 'p1', sequenceId: 's1', coefficient: 5, sequenceScore: 12, validationStatus: 'LOCKED' as const },
      { studentId: 'a1', subjectId: 'd1', sequenceId: 's1', coefficient: 1, sequenceScore: 14, validationStatus: 'LOCKED' as const },
      // Élève 2 : Gen=10, Pro=16 (acquise), Div=7 (non acquise < 11)
      { studentId: 'a2', subjectId: 'g1', sequenceId: 's1', coefficient: 2, sequenceScore: 10, validationStatus: 'LOCKED' as const },
      { studentId: 'a2', subjectId: 'p1', sequenceId: 's1', coefficient: 5, sequenceScore: 16, validationStatus: 'LOCKED' as const },
      { studentId: 'a2', subjectId: 'd1', sequenceId: 's1', coefficient: 1, sequenceScore: 7, validationStatus: 'LOCKED' as const },
    ];

    const res = BulletinSnapshotBuilder.buildClassSnapshots({
      students: [{ id: 'a1' }, { id: 'a2' }],
      subjects,
      sequences: seqs,
      notes,
      hasCoefficientBySubject: true,
    });

    const s1 = res.snapshotsByStudentId.get('a1')!;
    const gen1 = s1.groupSummaries.find((g) => g.groupKey === 'GENERAL')!;
    const pro1 = s1.groupSummaries.find((g) => g.groupKey === 'PROFESSIONNEL')!;
    const div1 = s1.groupSummaries.find((g) => g.groupKey === 'DIVERS')!;

    expect(gen1.groupRank).toBe(1);
    expect(s1.groupBreakdowns?.['GENERAL']?.groupCompetenceLabel).toBe('Compétence acquise');
    expect(pro1.groupRank).toBe(2);
    expect(pro1.totalWeightedScore).toBe(60);
    expect(s1.groupBreakdowns?.['PROFESSIONNEL']?.groupCompetenceLabel).toBe("En cours d'acquisition");
    expect(div1.groupRank).toBe(1);

    const s2 = res.snapshotsByStudentId.get('a2')!;
    expect(s2.groupBreakdowns?.['DIVERS']?.groupCompetenceLabel).toBe('Compétence non acquise');
  });

  it('Famille C (Bilingue APC 2nde) : competenceLabel reste undefined si non fourni, sequenceAverages périodiques avec rang et sous-totaux Eval a/b', () => {
    const res = BulletinSnapshotBuilder.buildClassSnapshots({
      students: [{ id: 'c1' }, { id: 'c2' }],
      subjects: [
        { id: 'fr', name: 'Français', coefficient: 3, groupKey: 'GROUPE_1', groupLabel: '1er Groupe', groupOrder: 1, competenceLabel: 'Produire des écrits argumentés' },
        { id: 'philo', name: 'Philosophie', coefficient: 2, groupKey: 'GROUPE_1', groupLabel: '1er Groupe', groupOrder: 1 },
      ],
      sequences: [
        { id: 'ea', name: 'Eval 3', orderIndex: 3 },
        { id: 'eb', name: 'Eval 4', orderIndex: 4 },
      ],
      notes: [
        { studentId: 'c1', subjectId: 'fr', sequenceId: 'ea', coefficient: 3, sequenceScore: 18, validationStatus: 'LOCKED' },
        { studentId: 'c1', subjectId: 'fr', sequenceId: 'eb', coefficient: 3, sequenceScore: 18, validationStatus: 'LOCKED' },
        { studentId: 'c1', subjectId: 'philo', sequenceId: 'ea', coefficient: 2, sequenceScore: 12, validationStatus: 'LOCKED' },
        { studentId: 'c1', subjectId: 'philo', sequenceId: 'eb', coefficient: 2, sequenceScore: 12, validationStatus: 'LOCKED' },
        { studentId: 'c2', subjectId: 'fr', sequenceId: 'ea', coefficient: 3, sequenceScore: 14, validationStatus: 'LOCKED' },
        { studentId: 'c2', subjectId: 'fr', sequenceId: 'eb', coefficient: 3, sequenceScore: 16, validationStatus: 'LOCKED' },
      ],
      hasCoefficientBySubject: true,
      isAnnual: false,
    });

    const snap1 = res.snapshotsByStudentId.get('c1')!;
    const fr = snap1.subjectLines.find((l) => l.subjectId === 'fr')!;
    const philo = snap1.subjectLines.find((l) => l.subjectId === 'philo')!;
    expect(fr.competenceLabel).toBe('Produire des écrits argumentés');
    expect(philo.competenceLabel).toBeUndefined();
    expect(fr.competenceLevelLabel).toBe('Niveau Expert / High Profile');
    expect(philo.competenceLevelLabel).toBe("En cours d'acquisition / Ongoing");

    // Moyenne de groupe par évaluation sur la période : (18*3 + 12*2)/5 = 15.6
    expect(snap1.groupBreakdowns?.['GROUPE_1']?.seq1Average).toBe(15.6);
    expect(snap1.groupBreakdowns?.['GROUPE_1']?.seq2Average).toBe(15.6);

    // sequenceAverages périodiques présentes avec rang
    expect(snap1.sequenceAverages).toHaveLength(2);
    expect(snap1.sequenceAverages![0]!.average).toBe(15.6);
    expect(snap1.sequenceAverages![0]!.rank).toBe(1);
    expect(snap1.sequenceAverages![1]!.rank).toBe(2);
  });

  it('Catalogue Étape 6 : toutes les specs D, B, C, E, F_EN, F_FR sont gelées, résolues et marquées À VALIDER SUR UN BULLETIN RÉEL pour E & F_FR', () => {
    const specs = [
      ANNUAL_BILINGUAL_V1,
      TECH_GROUPED_V1,
      BILINGUAL_APC_V1,
      EN_SECONDARY_V1,
      PRIMARY_POINTS_RATIO_EN_V1,
      PRIMARY_POINTS_RATIO_FR_V1,
    ];
    for (const s of specs) {
      expect(Object.isFrozen(s)).toBe(true);
      expect(Object.isFrozen(s.blocks)).toBe(true);
      expect(getPublishedTemplateSpec(s.id, 1)?.id).toBe(s.id);
    }
    expect(findDefaultSpecForTemplate('ANNUAL')?.id).toBe('ANNUAL_BILINGUAL_V1');
    expect(findDefaultSpecForTemplate('TECHNICAL_FR')?.id).toBe('TECH_GROUPED_V1');
    expect(findDefaultSpecForTemplate('EN_SECONDARY')?.id).toBe('EN_SECONDARY_V1');
    expect(findDefaultSpecForTemplate('PRIMARY')?.id).toBe('PRIMARY_POINTS_RATIO_EN_V1');
    expect(findDefaultSpecForTemplate('FR_SECONDARY')?.id).toBe('GENERAL_GROUPED_V1');
    expect(EN_SECONDARY_V1.validationNotice).toBe('À VALIDER SUR UN BULLETIN RÉEL');
    expect(PRIMARY_POINTS_RATIO_FR_V1.validationNotice).toBe('À VALIDER SUR UN BULLETIN RÉEL');
  });

  it('Rendu PDFKit mesuré des familles D, B, C, E, F (EN & FR) : 1 page, séparateur décimal localisé, groupRank B, points ratio F et zéro invention', async () => {
    const renderer = new MeasuredPdfKitBulletinRenderer();
    const renderAndCapture = async (
      snap: StudentBulletinSnapshot,
      spec: typeof ANNUAL_BILINGUAL_V1,
      language: 'fr' | 'en',
      isAnnual = false,
    ) => {
      const texts: string[] = [];
      let pageCount = 0;
      const origText = PDFDocument.prototype.text;
      const origAddPage = PDFDocument.prototype.addPage;
      PDFDocument.prototype.text = function patchedText(this: PDFKit.PDFDocument, t: string, ...rest: unknown[]) {
        if (typeof t === 'string') texts.push(t);
        return (origText as (...a: unknown[]) => PDFKit.PDFDocument).call(this, t, ...rest);
      } as typeof PDFDocument.prototype.text;
      PDFDocument.prototype.addPage = function patchedAddPage(this: PDFKit.PDFDocument, ...rest: unknown[]) {
        pageCount++;
        return (origAddPage as (...a: unknown[]) => PDFKit.PDFDocument).apply(this, rest);
      } as typeof PDFDocument.prototype.addPage;
      try {
        const pdf = await renderer.render(snap, spec, {
          className: 'Classe Spécimen',
          periodName: isAnnual ? 'Annuel' : language === 'en' ? 'Term 1' : 'Trimestre 2',
          yearName: '2026-2027',
          isAnnual,
          mention: language === 'en' ? 'Fair' : 'Assez Bien',
          language,
          verifyUrl: 'https://verify.zekoulabia.cm/verify/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1234',
          shortVerifyCode: 'ZK-UNIT-SPEC',
          school: { schoolName: 'Établissement Modèle', city: 'Garoua' },
        });
        expect(pdf.subarray(0, 5).toString('utf8')).toBe('%PDF-');
        return { joined: texts.join('\n'), pageCount };
      } finally {
        PDFDocument.prototype.text = origText;
        PDFDocument.prototype.addPage = origAddPage;
      }
    };

    const resF = BulletinSnapshotBuilder.buildClassSnapshots({
      students: [{ id: 'sf' }],
      subjects: [
        { id: 'f1', name: 'Grammar & Usage', coefficient: 1, maxMark: 40, learningDomain: 'ENGLISH LANGUAGE', learningUnit: 'Unit 1' },
        ...Array.from({ length: 19 }, (_, idx) => ({
          id: `f${idx + 2}`, name: `Skill ${idx + 2}`, coefficient: 1, maxMark: 20, learningDomain: idx < 8 ? 'MATHEMATICS' : 'FRENCH', learningUnit: 'Unit 2',
        })),
        { id: 'f21', name: 'Art', coefficient: 1, maxMark: 10, learningDomain: 'ARTISTIC EDUCATION', learningUnit: 'Unit 3' },
        { id: 'f22', name: 'Sport', coefficient: 1, maxMark: 10, learningDomain: 'SPORT', learningUnit: 'Unit 3' },
      ],
      sequences: [{ id: 's1', name: 'Month 1', orderIndex: 1 }],
      notes: [
        { studentId: 'sf', subjectId: 'f1', sequenceId: 's1', coefficient: 1, maxValue: 40, sequenceScore: 24, validationStatus: 'LOCKED' },
        ...Array.from({ length: 19 }, (_, idx) => ({
          studentId: 'sf', subjectId: `f${idx + 2}`, sequenceId: 's1', coefficient: 1, maxValue: 20, sequenceScore: 11, validationStatus: 'LOCKED' as const,
        })),
        { studentId: 'sf', subjectId: 'f21', sequenceId: 's1', coefficient: 1, maxValue: 10, sequenceScore: 6, validationStatus: 'LOCKED' },
        { studentId: 'sf', subjectId: 'f22', sequenceId: 's1', coefficient: 1, maxValue: 10, sequenceScore: 6, validationStatus: 'LOCKED' },
      ],
      hasCoefficientBySubject: false,
      calculationMode: 'POINTS_RATIO',
    });
    const snapF = resF.snapshotsByStudentId.get('sf')!;
    const outFEn = await renderAndCapture(snapF, PRIMARY_POINTS_RATIO_EN_V1, 'en');
    expect(outFEn.pageCount).toBe(1);
    expect(outFEn.joined).toContain('Total Marks : 245.00');
    expect(outFEn.joined).toContain('On : 440');
    expect(outFEn.joined).toContain('Average : 11.14 / 20');
    expect(outFEn.joined).toContain('ENGLISH LANGUAGE');

    const outFFr = await renderAndCapture(snapF, PRIMARY_POINTS_RATIO_FR_V1, 'fr');
    expect(outFFr.pageCount).toBe(1);
    expect(outFFr.joined).toContain('Total Notes : 245,00');
    expect(outFFr.joined).toContain('Moyenne : 11,14 / 20');
    expect(outFFr.joined).toContain('À VALIDER SUR UN BULLETIN RÉEL');

    // Famille B (Technique) : groupRank affiché sur RÉCAP + Corvée
    const resB = BulletinSnapshotBuilder.buildClassSnapshots({
      students: [{ id: 'sb' }],
      subjects: [
        { id: 'bg', name: 'Français Technique', coefficient: 2, groupKey: 'GENERAL', groupLabel: 'Enseignement Général', groupOrder: 1 },
        { id: 'bp', name: 'Atelier', coefficient: 5, groupKey: 'PROFESSIONNEL', groupLabel: 'Enseignement Professionnel', groupOrder: 2 },
      ],
      sequences: [{ id: 'bs1', name: 'Eval 1', orderIndex: 1 }],
      notes: [
        { studentId: 'sb', subjectId: 'bg', sequenceId: 'bs1', coefficient: 2, sequenceScore: 14, validationStatus: 'LOCKED' },
        { studentId: 'sb', subjectId: 'bp', sequenceId: 'bs1', coefficient: 5, sequenceScore: 12, validationStatus: 'LOCKED' },
      ],
      hasCoefficientBySubject: true,
    });
    const outB = await renderAndCapture(resB.snapshotsByStudentId.get('sb')!, TECH_GROUPED_V1, 'fr');
    expect(outB.pageCount).toBe(1);
    expect(outB.joined).toContain('Rang : 1er/1');
    expect(outB.joined).toContain('Compétence acquise');
    expect(outB.joined).toContain('Corvée (en jrs)');

    // Familles D, C, E
    const resD = BulletinSnapshotBuilder.buildClassSnapshots({
      students: [{ id: 'sd' }],
      subjects: [{ id: 'df', name: 'Français', coefficient: 4, groupKey: 'G1', groupLabel: '1er Groupe', groupOrder: 1 }],
      sequences: Array.from({ length: 6 }, (_, i) => ({ id: `q${i + 1}`, name: `Ev${i + 1}`, orderIndex: i + 1 })),
      notes: Array.from({ length: 6 }, (_, i) => ({ studentId: 'sd', subjectId: 'df', sequenceId: `q${i + 1}`, coefficient: 4, sequenceScore: 14, validationStatus: 'LOCKED' as const })),
      hasCoefficientBySubject: true,
      isAnnual: true,
    });
    const outD = await renderAndCapture(resD.snapshotsByStudentId.get('sd')!, ANNUAL_BILINGUAL_V1, 'fr', true);
    expect(outD.pageCount).toBe(1);
    expect(outD.joined).toContain('PROMU(E) EN');
    expect(outD.joined).toContain('EXCLU(E) POUR');

    const outC = await renderAndCapture(resB.snapshotsByStudentId.get('sb')!, BILINGUAL_APC_V1, 'fr');
    expect(outC.pageCount).toBe(1);
    expect(outC.joined).toContain('MOY Éval 1');
    expect(outC.joined).toContain('MOY Éval 2');
    expect(outC.joined).not.toContain('Eval a');
    expect(outC.joined).not.toContain('Eval b');

    const outE = await renderAndCapture(resB.snapshotsByStudentId.get('sb')!, EN_SECONDARY_V1, 'en');
    expect(outE.pageCount).toBe(1);
    expect(outE.joined).toContain('À VALIDER SUR UN BULLETIN RÉEL');
  });
});
