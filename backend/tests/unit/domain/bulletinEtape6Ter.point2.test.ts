import { describe, it, expect } from 'bun:test';
import {
  DEFAULT_COUNCIL_DISTINCTION_THRESHOLDS,
  resolveCouncilDistinctions,
} from '@domain/services/bulletin/bulletinCouncilPolicy';
import { listPublishedTemplateSpecs } from '@domain/templates/bulletinCatalog';
import { buildFictitiousPreviewSnapshot } from '@application/reportCard/bulletinAtelierPreview';

describe('Étape 6 ter — Point 2 : décision du conseil cohérente avec moyenne/rang et seuils configurables', () => {
  it('dérive exactement Tableau d’honneur, Encouragements, Félicitations et sanctions sur 6 profils d’élèves', () => {
    // Profil 1 : Élève excellent (17,20 — 1er/34) -> TH + Encouragements + Félicitations
    const excellent = resolveCouncilDistinctions({ generalAverage: 17.2, rank: 1, totalStudents: 34, isAnnual: true, promotedToClass: 'Terminale C' });
    expect(excellent.honorRoll).toBe(true);
    expect(excellent.encouragements).toBe(true);
    expect(excellent.congratulations).toBe(true);
    expect(excellent.workWarning).toBe(false);
    expect(excellent.workBlame).toBe(false);
    expect(excellent.decision).toBe('PASS');
    expect(excellent.promotedToClass).toBe('Terminale C');

    // Profil 2 : Très bon élève (14,80 — 4e/34) -> TH + Encouragements, pas Félicitations
    const veryGood = resolveCouncilDistinctions({ generalAverage: 14.8, rank: 4, totalStudents: 34 });
    expect(veryGood.honorRoll).toBe(true);
    expect(veryGood.encouragements).toBe(true);
    expect(veryGood.congratulations).toBe(false);

    // Profil 3 : Bon élève dans le top 10 (12,90 — 8e/34) -> TH uniquement
    const goodTop10 = resolveCouncilDistinctions({ generalAverage: 12.9, rank: 8, totalStudents: 34 });
    expect(goodTop10.honorRoll).toBe(true);
    expect(goodTop10.encouragements).toBe(false);
    expect(goodTop10.congratulations).toBe(false);

    // Profil 4 : Élève moyen hors top 10 (12,43 — 17e/34) -> AUCUNE distinction cochée !
    const middle = resolveCouncilDistinctions({ generalAverage: 12.43, rank: 17, totalStudents: 34 });
    expect(middle.honorRoll).toBe(false);
    expect(middle.encouragements).toBe(false);
    expect(middle.congratulations).toBe(false);
    expect(middle.workWarning).toBe(false);
    expect(middle.workBlame).toBe(false);
    expect(middle.decision).toBe('PASS');

    // Profil 5 : Élève en difficulté (9,10 — 28e/34) -> Avertissement travail, aucune distinction, DELIBERATION
    const weak = resolveCouncilDistinctions({ generalAverage: 9.1, rank: 28, totalStudents: 34 });
    expect(weak.honorRoll).toBe(false);
    expect(weak.encouragements).toBe(false);
    expect(weak.congratulations).toBe(false);
    expect(weak.workWarning).toBe(true);
    expect(weak.workBlame).toBe(false);
    expect(weak.decision).toBe('DELIBERATION');

    // Profil 6 : Élève très faible (6,70 — 33e/34) -> Avertissement + Blâme travail, REPEAT
    const failing = resolveCouncilDistinctions({ generalAverage: 6.7, rank: 33, totalStudents: 34, isAnnual: true, repeatClass: '1ère A4' });
    expect(failing.honorRoll).toBe(false);
    expect(failing.workWarning).toBe(true);
    expect(failing.workBlame).toBe(true);
    expect(failing.decision).toBe('REPEAT');
    expect(failing.repeatClass).toBe('1ère A4');
  });

  it('respecte les seuils configurables personnalisés (moyenne et rang)', () => {
    // École qui n'impose pas de plafond de rang pour le Tableau d'honneur et fixe le seuil à 12
    const withoutRankCap = resolveCouncilDistinctions({
      generalAverage: 12.43,
      rank: 17,
      totalStudents: 34,
      thresholds: { honorRollMinAverage: 12, honorRollMaxRank: undefined },
    });
    expect(withoutRankCap.honorRoll).toBe(true);
    expect(withoutRankCap.encouragements).toBe(false);

    // École plus exigeante : TH >= 14 et top 3
    const strict = resolveCouncilDistinctions({
      generalAverage: 13.5,
      rank: 2,
      totalStudents: 34,
      thresholds: { honorRollMinAverage: 14, honorRollMaxRank: 3 },
    });
    expect(strict.honorRoll).toBe(false);
  });

  it('dans tous les spécimens générés, la décision du conseil n’est jamais cochée par défaut et reste cohérente avec moyenne/rang', () => {
    for (const spec of listPublishedTemplateSpecs()) {
      const preview = buildFictitiousPreviewSnapshot(spec);
      const snap = preview.snapshot;
      const hasCouncilBlock = spec.blocks.some((b) => b.type === 'councilDecision');
      if (!hasCouncilBlock) {
        expect(snap.councilDecision).toBeUndefined();
        continue;
      }
      expect(snap.councilDecision).toBeDefined();
      const dec = snap.councilDecision!;
      const expected = resolveCouncilDistinctions({
        generalAverage: snap.generalAverage,
        rank: snap.rank,
        totalStudents: snap.totalStudents,
        thresholds: DEFAULT_COUNCIL_DISTINCTION_THRESHOLDS,
      });
      expect(dec.honorRoll).toBe(expected.honorRoll);
      expect(dec.encouragements).toBe(expected.encouragements);
      expect(dec.congratulations).toBe(expected.congratulations);
      // L'élève fictif principal est ~17e/34 (~12,43) : ni Tableau d'honneur ni Encouragements ne doivent être cochés
      if (snap.rank > (DEFAULT_COUNCIL_DISTINCTION_THRESHOLDS.honorRollMaxRank ?? 10)) {
        expect(dec.honorRoll).toBe(false);
        expect(dec.encouragements).toBe(false);
        expect(dec.congratulations).toBe(false);
      }
    }
  });
});

