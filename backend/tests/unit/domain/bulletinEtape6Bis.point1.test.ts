import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildFictitiousPreviewSnapshot } from '@application/reportCard/bulletinAtelierPreview';
import { PREVIEW_CLASS_SIZE, buildFictitiousPreviewClass } from '@application/reportCard/bulletinPreviewFictitiousClass';
import { listPublishedTemplateSpecs } from '@domain/templates/bulletinCatalog';
import { computeClassProfile, round2 } from '@domain/services/bulletin/bulletinSnapshotMath';

const KIND_BY_FAMILY = { A: 'GENERAL', B: 'TECH', C: 'APC', D: 'ANNUAL', E: 'EN', F: 'PRIMARY' } as const;

describe('Étape 6 bis — Point 1 : classe fictive cohérente (30 à 40 élèves) et statistiques calculées', () => {
  for (const spec of listPublishedTemplateSpecs()) {
    for (const threshold of [10, 12]) {
      it(`${spec.id} v${spec.version} (seuil ${threshold}) : effectif, admis, taux, premier/moyenne/dernier dérivés des moyennes`, () => {
        const res = buildFictitiousPreviewClass({ spec, kind: KIND_BY_FAMILY[spec.familyKey], passThresholdOn20: threshold });
        const snaps = [...res.snapshotsByStudentId.values()];
        const avgs = snaps.map((s) => s.generalAverage);
        const cp = res.classProfile;

        expect(snaps.length).toBe(PREVIEW_CLASS_SIZE);
        expect(cp.classSize).toBeGreaterThanOrEqual(30);
        expect(cp.classSize).toBeLessThanOrEqual(40);
        expect(cp.classSize).toBe(avgs.length);
        expect(cp.passCount).toBeLessThanOrEqual(cp.classSize);
        expect(cp.passCount).toBe(avgs.filter((a) => a >= threshold).length);
        expect(cp.passRate).toBe(round2((cp.passCount / cp.classSize) * 100));
        expect(cp.topAverage).toBe(Math.max(...avgs));
        expect(cp.lowAverage).toBe(Math.min(...avgs));
        expect(cp.classAverage).toBe(round2(avgs.reduce((a, b) => a + b, 0) / avgs.length));
        expect(cp.topAverage).toBeGreaterThanOrEqual(cp.classAverage);
        expect(cp.classAverage).toBeGreaterThanOrEqual(cp.lowAverage);
        // Admis ET non-admis présents : la classe n'est pas uniforme
        expect(cp.passCount).toBeGreaterThan(0);
        expect(cp.passCount).toBeLessThan(cp.classSize);

        // Moyennes variées (au moins 25 valeurs distinctes) avec au moins un ex æquo
        expect(new Set(avgs).size).toBeGreaterThanOrEqual(25);
        expect(new Set(avgs).size).toBeLessThan(avgs.length);
        // Rangs de compétition : deux ex æquo partagent le même rang, rang = 1 + nb élèves strictement meilleurs
        for (const s of snaps) {
          expect(s.rank).toBe(1 + avgs.filter((a) => a > s.generalAverage).length);
          expect(s.totalStudents).toBe(cp.classSize);
        }
        // Notes manquantes : au moins un élève a moins de lignes matière que le maximum
        const lineCounts = snaps.map((s) => s.subjectLines.length);
        expect(Math.min(...lineCounts)).toBeLessThan(Math.max(...lineCounts));
      });
    }
  }

  it('le spécimen rendu porte des appréciations et moyennes annuelles variées (jamais toutes identiques)', () => {
    for (const spec of listPublishedTemplateSpecs()) {
      const snap = buildFictitiousPreviewSnapshot(spec).snapshot;
      const avgs = snap.subjectLines.map((l) => l.subjectAverage);
      expect(new Set(avgs).size).toBeGreaterThan(Math.min(3, avgs.length - 1));
      const comments = snap.subjectLines.map((l) => l.teacherComment).filter((c): c is string => typeof c === 'string');
      if (comments.length > 1) expect(new Set(comments).size).toBeGreaterThan(1);
      expect(snap.classProfile?.classSize).toBe(PREVIEW_CLASS_SIZE);
    }
    const annual = listPublishedTemplateSpecs().find((s) => s.familyKey === 'D')!;
    const res = buildFictitiousPreviewClass({ spec: annual, kind: 'ANNUAL', passThresholdOn20: 10 });
    const annualAvgs = [...res.snapshotsByStudentId.values()].map((s) => s.generalAverage);
    expect(new Set(annualAvgs).size).toBeGreaterThanOrEqual(25);
  });

  it('computeClassProfile ne connaît plus de surcharge d\'effectif et classSizeOverride n\'existe plus dans src/', () => {
    expect(computeClassProfile([12, 8, 15], 10)).toEqual({
      classSize: 3, classAverage: 11.67, topAverage: 15, lowAverage: 8, passCount: 2, passRate: 66.67,
    });
    const files = [
      'src/domain/types/bulletinSnapshot.ts',
      'src/domain/services/bulletin/BulletinSnapshotBuilder.ts',
      'src/domain/services/bulletin/bulletinSnapshotMath.ts',
      'src/application/reportCard/bulletinAtelierPreview.ts',
      'src/application/reportCard/bulletinPreviewFictitiousClass.ts',
    ];
    for (const f of files) {
      expect(readFileSync(join(import.meta.dir, '../../..', f), 'utf8')).not.toContain('classSizeOverride');
    }
  });
});

