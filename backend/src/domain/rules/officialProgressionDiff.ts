/**
 * DOMAIN LAYER — Règle métier pure de calcul de diff entre un Programme d'école
 * matérialisé (source = 'national') et la version courante de son OfficialProgrammeProgression.
 *
 * Garanties strictes :
 * - Appariement déterministe par sourceKey (moduleOrdre:positionDansModule), puis par titre normalisé.
 * - Les leçons modifiées conservent leur Chapitre.id existant (préservant ChapitreAvancement et CahierDeTexte).
 * - Aucune leçon supprimée silencieusement : toute leçon retirée du référentiel national est
 *   explicitement signalée (en distinguant celles utilisées par le cahier/coches des orphelines).
 */
import type { OfficialChapterSource } from '@domain/ports/repositories/MaterialisationProgrammeRepository';
import { normaliserCleLibelle } from './officialProgressionResolution';

export interface ChapitreEcolePourDiff {
  id: string;
  titre: string;
  ordre: number;
  volumeHeuresPrevu: number | null;
  sequenceCibleFin: number | null;
  moduleOrdre: number | null;
  moduleTitre: string | null;
  positionDansModule: number | null;
  numeroAffiche: string | null;
  sourceUrl: string | null;
  sourceKey: string | null;
  retireDuReferentielLe?: Date | null;
  nbSeancesCahier: number;
  nbCochesDirectes: number;
}

export interface DiffChapitreAjoute {
  sourceKey: string;
  ordre: number;
  titre: string;
  moduleOrdre: number | null;
  moduleTitre: string | null;
  positionDansModule: number | null;
  numeroAffiche: string | null;
  sourceUrl: string | null;
  volumeHeuresPrevu: number | null;
  sequenceCibleFin: number | null;
}

export interface DiffChapitreModifie {
  chapitreId: string;
  sourceKey: string;
  champsModifies: string[];
  avant: {
    titre: string;
    ordre: number;
    moduleOrdre: number | null;
    moduleTitre: string | null;
    numeroAffiche: string | null;
  };
  apres: {
    titre: string;
    ordre: number;
    moduleOrdre: number | null;
    moduleTitre: string | null;
    positionDansModule: number | null;
    numeroAffiche: string | null;
    sourceUrl: string | null;
    sourceKey: string;
  };
}

export interface DiffChapitreRetireDuNational {
  chapitreId: string;
  sourceKey: string | null;
  titre: string;
  moduleTitre: string | null;
  utilisee: boolean;
  /** true si la leçon est déjà marquée « retirée du référentiel » (Chapitre.retireDuReferentielLe). */
  dejaMarqueRetire: boolean;
  nbSeancesCahier: number;
  nbCochesDirectes: number;
}

export interface DiffSynchronisationProgramme {
  aDerive: boolean;
  checksumEcole: string | null;
  checksumNational: string | null;
  titreModifie: boolean;
  titreAvant: string;
  titreApres: string;
  ajoutes: DiffChapitreAjoute[];
  modifies: DiffChapitreModifie[];
  retiresDuNational: DiffChapitreRetireDuNational[];
  inchangesCount: number;
}

function cleSourceEffective(ch: {
  sourceKey?: string | null;
  moduleOrdre?: number | null;
  positionDansModule?: number | null;
  ordre: number;
}): string {
  if (ch.sourceKey && ch.sourceKey.trim().length > 0) return ch.sourceKey.trim();
  if (
    ch.moduleOrdre !== null &&
    ch.moduleOrdre !== undefined &&
    ch.positionDansModule !== null &&
    ch.positionDansModule !== undefined
  ) {
    return `${ch.moduleOrdre}:${ch.positionDansModule}`;
  }
  return String(ch.ordre);
}

export function calculerDiffSynchronisationProgramme(params: {
  programmeTitre: string;
  programmeChecksum: string | null;
  chapitresEcole: readonly ChapitreEcolePourDiff[];
  officialTitre: string;
  officialChecksum: string | null;
  chapitresOfficiels: readonly OfficialChapterSource[];
}): DiffSynchronisationProgramme {
  const ecoleParSourceKey = new Map<string, ChapitreEcolePourDiff>();
  const ecoleParTitre = new Map<string, ChapitreEcolePourDiff[]>();

  for (const ch of params.chapitresEcole) {
    if (ch.sourceKey && !ecoleParSourceKey.has(ch.sourceKey)) {
      ecoleParSourceKey.set(ch.sourceKey, ch);
    }
    const cleTitre = normaliserCleLibelle(ch.titre);
    const list = ecoleParTitre.get(cleTitre) ?? [];
    list.push(ch);
    ecoleParTitre.set(cleTitre, list);
  }

  const appariements = new Set<string>();
  const ajoutes: DiffChapitreAjoute[] = [];
  const modifies: DiffChapitreModifie[] = [];
  let inchangesCount = 0;

  for (const off of params.chapitresOfficiels) {
    const keyOff = cleSourceEffective(off);
    let match = ecoleParSourceKey.get(keyOff);

    if (match && appariements.has(match.id)) {
      match = undefined;
    }

    if (!match) {
      const candidatsTitre = ecoleParTitre.get(normaliserCleLibelle(off.titre)) ?? [];
      match = candidatsTitre.find((c) => !appariements.has(c.id));
    }

    if (!match) {
      ajoutes.push({
        sourceKey: keyOff,
        ordre: off.ordre,
        titre: off.titre,
        moduleOrdre: off.moduleOrdre,
        moduleTitre: off.moduleTitre,
        positionDansModule: off.positionDansModule,
        numeroAffiche: off.numeroAffiche,
        sourceUrl: off.sourceUrl,
        volumeHeuresPrevu: off.volumeHeuresPrevu,
        sequenceCibleFin: off.sequenceCibleFin,
      });
      continue;
    }

    appariements.add(match.id);

    const champsModifies: string[] = [];
    if (match.titre !== off.titre) champsModifies.push('titre');
    if (match.ordre !== off.ordre) champsModifies.push('ordre');
    if ((match.moduleOrdre ?? null) !== (off.moduleOrdre ?? null)) champsModifies.push('moduleOrdre');
    if ((match.moduleTitre ?? null) !== (off.moduleTitre ?? null)) champsModifies.push('moduleTitre');
    if ((match.positionDansModule ?? null) !== (off.positionDansModule ?? null)) {
      champsModifies.push('positionDansModule');
    }
    if ((match.numeroAffiche ?? null) !== (off.numeroAffiche ?? null)) {
      champsModifies.push('numeroAffiche');
    }
    if ((match.sourceUrl ?? null) !== (off.sourceUrl ?? null)) champsModifies.push('sourceUrl');
    if ((match.sourceKey ?? null) !== keyOff) champsModifies.push('sourceKey');
    // Leçon précédemment retirée qui réapparaît dans le référentiel : elle est réintégrée
    if (match.retireDuReferentielLe !== null && match.retireDuReferentielLe !== undefined) {
      champsModifies.push('reintegree');
    }

    if (champsModifies.length === 0) {
      inchangesCount += 1;
    } else {
      modifies.push({
        chapitreId: match.id,
        sourceKey: keyOff,
        champsModifies,
        avant: {
          titre: match.titre,
          ordre: match.ordre,
          moduleOrdre: match.moduleOrdre,
          moduleTitre: match.moduleTitre,
          numeroAffiche: match.numeroAffiche,
        },
        apres: {
          titre: off.titre,
          ordre: off.ordre,
          moduleOrdre: off.moduleOrdre,
          moduleTitre: off.moduleTitre,
          positionDansModule: off.positionDansModule,
          numeroAffiche: off.numeroAffiche,
          sourceUrl: off.sourceUrl,
          sourceKey: keyOff,
        },
      });
    }
  }

  const retiresDuNational: DiffChapitreRetireDuNational[] = [];
  for (const ch of params.chapitresEcole) {
    if (appariements.has(ch.id)) continue;
    // Une leçon ajoutée manuellement localement (sans sourceKey) n'est pas issue du référentiel national
    if (!ch.sourceKey) continue;
    retiresDuNational.push({
      chapitreId: ch.id,
      sourceKey: ch.sourceKey,
      titre: ch.titre,
      moduleTitre: ch.moduleTitre,
      utilisee: ch.nbSeancesCahier > 0 || ch.nbCochesDirectes > 0,
      dejaMarqueRetire: ch.retireDuReferentielLe !== null && ch.retireDuReferentielLe !== undefined,
      nbSeancesCahier: ch.nbSeancesCahier,
      nbCochesDirectes: ch.nbCochesDirectes,
    });
  }

  const titreModifie = params.programmeTitre !== params.officialTitre;
  const checksumDifferent =
    (params.programmeChecksum ?? null) !== (params.officialChecksum ?? null);
  // Les leçons retirées du national sont conservées (non destructif) et marquées lors de la
  // synchronisation : seule une leçon retirée pas encore marquée constitue encore une dérive.
  const aDerive =
    checksumDifferent ||
    titreModifie ||
    ajoutes.length > 0 ||
    modifies.length > 0 ||
    retiresDuNational.some((r) => !r.dejaMarqueRetire);

  return {
    aDerive,
    checksumEcole: params.programmeChecksum,
    checksumNational: params.officialChecksum,
    titreModifie,
    titreAvant: params.programmeTitre,
    titreApres: params.officialTitre,
    ajoutes,
    modifies,
    retiresDuNational,
    inchangesCount,
  };
}
