import { describe, expect, it } from 'bun:test';
import {
  calculerDiffSynchronisationProgramme,
  type ChapitreEcolePourDiff,
} from '@domain/rules/officialProgressionDiff';
import type { OfficialChapterSource } from '@domain/ports/repositories/MaterialisationProgrammeRepository';

function makeEcole(overrides: Partial<ChapitreEcolePourDiff> & Pick<ChapitreEcolePourDiff, 'id' | 'ordre' | 'titre'>): ChapitreEcolePourDiff {
  return {
    id: overrides.id,
    ordre: overrides.ordre,
    titre: overrides.titre,
    volumeHeuresPrevu: overrides.volumeHeuresPrevu ?? null,
    sequenceCibleFin: overrides.sequenceCibleFin ?? null,
    moduleOrdre: overrides.moduleOrdre ?? 1,
    moduleTitre: overrides.moduleTitre ?? 'Module 1',
    positionDansModule: overrides.positionDansModule ?? overrides.ordre,
    numeroAffiche: overrides.numeroAffiche ?? `Leçon ${overrides.ordre}`,
    sourceUrl: overrides.sourceUrl ?? null,
    sourceKey: overrides.sourceKey !== undefined ? overrides.sourceKey : `1:${overrides.ordre}`,
    nbSeancesCahier: overrides.nbSeancesCahier ?? 0,
    nbCochesDirectes: overrides.nbCochesDirectes ?? 0,
  };
}

function makeOff(overrides: Partial<OfficialChapterSource> & Pick<OfficialChapterSource, 'ordre' | 'titre'>): OfficialChapterSource {
  return {
    ordre: overrides.ordre,
    titre: overrides.titre,
    volumeHeuresPrevu: overrides.volumeHeuresPrevu ?? null,
    sequenceCibleFin: overrides.sequenceCibleFin ?? null,
    moduleOrdre: overrides.moduleOrdre ?? 1,
    moduleTitre: overrides.moduleTitre ?? 'Module 1',
    positionDansModule: overrides.positionDansModule ?? overrides.ordre,
    numeroAffiche: overrides.numeroAffiche ?? `Leçon ${overrides.ordre}`,
    sourceUrl: overrides.sourceUrl ?? null,
    sourceKey: overrides.sourceKey !== undefined ? overrides.sourceKey : `1:${overrides.ordre}`,
  };
}

describe('officialProgressionDiff — calcul de diff non destructif par sourceKey', () => {
  it('retourne aDerive=false lorsque checksum, titre et leçons sont identiques', () => {
    const diff = calculerDiffSynchronisationProgramme({
      programmeTitre: 'Maths 6e',
      programmeChecksum: 'sha256:v1',
      chapitresEcole: [makeEcole({ id: 'ch_1', ordre: 1, titre: 'Entiers naturels' })],
      officialTitre: 'Maths 6e',
      officialChecksum: 'sha256:v1',
      chapitresOfficiels: [makeOff({ ordre: 1, titre: 'Entiers naturels' })],
    });

    expect(diff.aDerive).toBe(false);
    expect(diff.ajoutes).toHaveLength(0);
    expect(diff.modifies).toHaveLength(0);
    expect(diff.retiresDuNational).toHaveLength(0);
    expect(diff.inchangesCount).toBe(1);
  });

  it('apparie par sourceKey pour mettre à jour en place (même Chapitre.id), ajoute les nouvelles leçons et signale sans supprimer les retirées', () => {
    const diff = calculerDiffSynchronisationProgramme({
      programmeTitre: 'Maths 6e',
      programmeChecksum: 'sha256:v1',
      chapitresEcole: [
        makeEcole({ id: 'ch_1', ordre: 1, titre: 'Entiers naturel (faute)', sourceKey: '1:1', nbCochesDirectes: 1 }),
        makeEcole({ id: 'ch_2', ordre: 2, titre: 'Ancienne leçon retirée', sourceKey: '1:2', nbSeancesCahier: 2 }),
        makeEcole({ id: 'ch_3', ordre: 3, titre: 'Autre retirée non utilisée', sourceKey: '1:3' }),
      ],
      officialTitre: 'Maths 6e (révisé)',
      officialChecksum: 'sha256:v2',
      chapitresOfficiels: [
        makeOff({ ordre: 1, titre: 'Entiers naturels', sourceKey: '1:1' }),
        makeOff({ ordre: 2, titre: 'Nouvelle leçon géométrie', sourceKey: '2:1', moduleOrdre: 2, moduleTitre: 'Module 2', positionDansModule: 1 }),
      ],
    });

    expect(diff.aDerive).toBe(true);
    expect(diff.titreModifie).toBe(true);

    // ch_1 conservé avec le même Chapitre.id
    expect(diff.modifies).toHaveLength(1);
    expect(diff.modifies[0].chapitreId).toBe('ch_1');
    expect(diff.modifies[0].champsModifies).toContain('titre');
    expect(diff.modifies[0].apres.titre).toBe('Entiers naturels');

    // Nouvelle leçon ajoutée
    expect(diff.ajoutes).toHaveLength(1);
    expect(diff.ajoutes[0].sourceKey).toBe('2:1');

    // Leçons retirées du national : signalées avec drapeau utilisee, jamais supprimées
    expect(diff.retiresDuNational).toHaveLength(2);
    const ch2 = diff.retiresDuNational.find((r) => r.chapitreId === 'ch_2');
    const ch3 = diff.retiresDuNational.find((r) => r.chapitreId === 'ch_3');
    expect(ch2?.utilisee).toBe(true);
    expect(ch2?.nbSeancesCahier).toBe(2);
    expect(ch3?.utilisee).toBe(false);
  });

  it('non-régression idempotence : après synchronisation avec leçon retirée conservée, aDerive repasse à false dès que le checksum est aligné', () => {
    // Avant synchro : seul changement = retrait de 1:2, checksum national changé → aDerive = true
    const avantSync = calculerDiffSynchronisationProgramme({
      programmeTitre: 'Maths 6e',
      programmeChecksum: 'sha256:v1',
      chapitresEcole: [
        makeEcole({ id: 'ch_1', ordre: 1, titre: 'Entiers naturels', sourceKey: '1:1' }),
        makeEcole({ id: 'ch_2', ordre: 2, titre: 'Leçon retirée en v2', sourceKey: '1:2', nbSeancesCahier: 1 }),
      ],
      officialTitre: 'Maths 6e',
      officialChecksum: 'sha256:v2',
      chapitresOfficiels: [makeOff({ ordre: 1, titre: 'Entiers naturels', sourceKey: '1:1' })],
    });
    expect(avantSync.aDerive).toBe(true);
    expect(avantSync.retiresDuNational).toHaveLength(1);

    // Après synchro : ch_2 conservé en base, checksum aligné sur sha256:v2 → aDerive = false (idempotent)
    const apresSync = calculerDiffSynchronisationProgramme({
      programmeTitre: 'Maths 6e',
      programmeChecksum: 'sha256:v2',
      chapitresEcole: [
        makeEcole({ id: 'ch_1', ordre: 1, titre: 'Entiers naturels', sourceKey: '1:1' }),
        makeEcole({ id: 'ch_2', ordre: 2, titre: 'Leçon retirée en v2', sourceKey: '1:2', nbSeancesCahier: 1 }),
      ],
      officialTitre: 'Maths 6e',
      officialChecksum: 'sha256:v2',
      chapitresOfficiels: [makeOff({ ordre: 1, titre: 'Entiers naturels', sourceKey: '1:1' })],
    });
    expect(apresSync.aDerive).toBe(false);
    expect(apresSync.retiresDuNational).toHaveLength(1);
  });

  it('non-régression AP local : un chapitre ajouté manuellement (sourceKey=null) sur un programme national n est pas classé retiré du national', () => {
    const diff = calculerDiffSynchronisationProgramme({
      programmeTitre: 'Maths 6e',
      programmeChecksum: 'sha256:v1',
      chapitresEcole: [
        makeEcole({ id: 'ch_1', ordre: 1, titre: 'Entiers naturels', sourceKey: '1:1' }),
        makeEcole({ id: 'ch_local', ordre: 2, titre: 'TD complémentaire lycée', sourceKey: null }),
      ],
      officialTitre: 'Maths 6e',
      officialChecksum: 'sha256:v1',
      chapitresOfficiels: [makeOff({ ordre: 1, titre: 'Entiers naturels', sourceKey: '1:1' })],
    });
    expect(diff.aDerive).toBe(false);
    expect(diff.retiresDuNational).toHaveLength(0);
  });
});
