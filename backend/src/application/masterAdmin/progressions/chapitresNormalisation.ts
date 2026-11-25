import { createHash } from 'node:crypto';
import type {
  OfficialProgressionChapterRecord,
  OfficialProgressionNaturalKey,
} from '@domain/ports/repositories/OfficialProgressionImportRepository';
import type {
  ChapitreImportEntree,
  DiagnosticElementExclu,
  DiagnosticLeconSansNumero,
  DiagnosticModuleParasite,
  DiagnosticNumeroDuplique,
  ImportProgressionsDiagnostics,
} from './types';

export function construireCleProgression(key: OfficialProgressionNaturalKey): string {
  return `${key.templateCode}::${key.level}::${key.filiere}::${key.subjectName}`;
}

/**
 * Normalise un intitulé de matière pour comparaison stricte :
 * casse, accents (NFD) et espaces multiples/insécables.
 */
export function normaliserCleMatiere(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normaliserLeconNumero(valeur: number | string | null | undefined): number | string | null {
  if (valeur === null || valeur === undefined) return null;
  if (typeof valeur === 'number') return Number.isFinite(valeur) ? valeur : null;
  const trimmed = valeur.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normaliserTexteOptionnel(valeur: string | null | undefined): string | null {
  if (valeur === null || valeur === undefined) return null;
  const trimmed = valeur.trim();
  return trimmed.length > 0 ? trimmed : null;
}

interface ChapitrePrepare {
  indexOrigine: number;
  moduleOrdre: number | null;
  moduleTitre: string | null;
  titreModuleParasite: boolean;
  positionDansModule: number;
  positionSource: number;
  titre: string;
  volumeHeuresPrevu: number | null;
  sequenceCibleFin: number | null;
  leconNumero: number | string | null;
  numeroAffiche: string | null;
  sourceUrl: string | null;
}

export interface ResultatNormalisationChapitres {
  chapitres: OfficialProgressionChapterRecord[];
  nbExclus: number;
  erreurCleNaturelleDupliquee: string | null;
  diagnostics: ImportProgressionsDiagnostics;
}

/**
 * Normalise les chapitres/leçons d'une matière :
 * - retire les éléments marqués `exclure: true` (signalés dans diagnostics.elementsExclus)
 * - vérifie l'unicité de la clé naturelle (moduleOrdre, positionDansModule) sans jamais utiliser leconNumero
 * - calcule `ordre` global strictement par ordre d'apparition (moduleOrdre puis positionDansModule puis positionSource)
 * - collecte les 4 catégories de diagnostics sans rejeter pour ces motifs
 */
export function normaliserChapitresEtCollecterDiagnostics(params: {
  cleProgression: string;
  subjectName: string;
  chapitresBruts: ChapitreImportEntree[];
}): ResultatNormalisationChapitres {
  const { cleProgression, subjectName, chapitresBruts } = params;

  const leconsSansNumero: DiagnosticLeconSansNumero[] = [];
  const elementsExclus: DiagnosticElementExclu[] = [];
  const modulesParasitesMap = new Map<string, DiagnosticModuleParasite>();

  const compteurParModule = new Map<string, number>();
  const actifs: ChapitrePrepare[] = [];

  for (let idx = 0; idx < chapitresBruts.length; idx++) {
    const brut = chapitresBruts[idx]!;
    const moduleOrdre = brut.moduleOrdre !== null && brut.moduleOrdre !== undefined
      ? brut.moduleOrdre
      : null;
    const moduleTitre = normaliserTexteOptionnel(brut.moduleTitre);
    const moduleCle = moduleOrdre !== null ? String(moduleOrdre) : '__FLAT__';

    const nextPos = (compteurParModule.get(moduleCle) ?? 0) + 1;
    compteurParModule.set(moduleCle, nextPos);

    const positionDansModule = brut.positionDansModule !== null && brut.positionDansModule !== undefined
      ? brut.positionDansModule
      : nextPos;
    const positionSource = brut.positionSource !== null && brut.positionSource !== undefined
      ? brut.positionSource
      : idx + 1;

    const leconNumero = normaliserLeconNumero(brut.leconNumero);
    const numeroAffiche = normaliserTexteOptionnel(brut.numeroAffiche);
    const sourceUrl = normaliserTexteOptionnel(brut.sourceUrl);
    const titre = brut.titre.trim();

    if (brut.exclure === true) {
      elementsExclus.push({
        cleProgression,
        subjectName,
        moduleOrdre,
        moduleTitre,
        positionDansModule,
        positionSource,
        titre,
        leconNumero,
        numeroAffiche,
      });
      continue;
    }

    actifs.push({
      indexOrigine: idx,
      moduleOrdre,
      moduleTitre,
      titreModuleParasite: brut.titreModuleParasite === true,
      positionDansModule,
      positionSource,
      titre,
      volumeHeuresPrevu: brut.volumeHeuresPrevu !== null && brut.volumeHeuresPrevu !== undefined
        ? brut.volumeHeuresPrevu
        : null,
      sequenceCibleFin: brut.sequenceCibleFin !== null && brut.sequenceCibleFin !== undefined
        ? brut.sequenceCibleFin
        : null,
      leconNumero,
      numeroAffiche,
      sourceUrl,
    });
  }

  // Vérification clé naturelle (moduleOrdre + positionDansModule) parmi les leçons actives
  const clesVues = new Set<string>();
  for (const ch of actifs) {
    const cleChapitre = `${ch.moduleOrdre !== null ? ch.moduleOrdre : '__FLAT__'}::${ch.positionDansModule}`;
    if (clesVues.has(cleChapitre)) {
      return {
        chapitres: [],
        nbExclus: elementsExclus.length,
        erreurCleNaturelleDupliquee:
          `Collision sur la clé naturelle (moduleOrdre=${ch.moduleOrdre ?? 'aucun'}, positionDansModule=${ch.positionDansModule})`,
        diagnostics: { leconsSansNumero: [], numerosDupliques: [], modulesParasites: [], elementsExclus },
      };
    }
    clesVues.add(cleChapitre);
  }

  // Tri strict par ordre d'apparition : module d'abord, puis position dans le module, puis positionSource
  // JAMAIS par leconNumero !
  const tries = [...actifs].sort((a, b) => {
    if (a.moduleOrdre !== b.moduleOrdre) {
      if (a.moduleOrdre === null) return 1;
      if (b.moduleOrdre === null) return -1;
      return a.moduleOrdre - b.moduleOrdre;
    }
    if (a.positionDansModule !== b.positionDansModule) {
      return a.positionDansModule - b.positionDansModule;
    }
    if (a.positionSource !== b.positionSource) {
      return a.positionSource - b.positionSource;
    }
    return a.indexOrigine - b.indexOrigine;
  });

  // Diagnostics sur les leçons retenues (sans jamais rejeter)
  const parNumero = new Map<string, ChapitrePrepare[]>();
  for (const ch of tries) {
    if (ch.leconNumero === null) {
      leconsSansNumero.push({
        cleProgression,
        subjectName,
        moduleOrdre: ch.moduleOrdre,
        moduleTitre: ch.moduleTitre,
        positionDansModule: ch.positionDansModule,
        positionSource: ch.positionSource,
        titre: ch.titre,
        numeroAffiche: ch.numeroAffiche,
      });
    } else {
      const cleNum = String(ch.leconNumero);
      const list = parNumero.get(cleNum) ?? [];
      list.push(ch);
      parNumero.set(cleNum, list);
    }

    if (ch.titreModuleParasite) {
      const cleMod = `${ch.moduleOrdre !== null ? ch.moduleOrdre : '__FLAT__'}::${ch.moduleTitre ?? ''}`;
      const existing = modulesParasitesMap.get(cleMod);
      if (existing) {
        existing.nbLecons += 1;
      } else {
        modulesParasitesMap.set(cleMod, {
          cleProgression,
          subjectName,
          moduleOrdre: ch.moduleOrdre,
          moduleTitre: ch.moduleTitre,
          nbLecons: 1,
        });
      }
    }
  }

  const numerosDupliques: DiagnosticNumeroDuplique[] = [];
  for (const [leconNumero, occs] of parNumero.entries()) {
    if (occs.length < 2) continue;
    const moduleCounts = new Map<string, number>();
    for (const o of occs) {
      const mk = o.moduleOrdre !== null ? String(o.moduleOrdre) : '__FLAT__';
      moduleCounts.set(mk, (moduleCounts.get(mk) ?? 0) + 1);
    }
    const aDoublonMemeModule = Array.from(moduleCounts.values()).some((c) => c > 1);
    const aDoublonInterModules = moduleCounts.size > 1;
    const portee: DiagnosticNumeroDuplique['portee'] =
      aDoublonMemeModule && aDoublonInterModules
        ? 'MIXTE'
        : aDoublonMemeModule
          ? 'MEME_MODULE'
          : 'INTER_MODULES';

    numerosDupliques.push({
      cleProgression,
      subjectName,
      leconNumero,
      portee,
      occurrences: occs.map((o) => ({
        moduleOrdre: o.moduleOrdre,
        moduleTitre: o.moduleTitre,
        positionDansModule: o.positionDansModule,
        positionSource: o.positionSource,
        titre: o.titre,
        numeroAffiche: o.numeroAffiche,
      })),
    });
  }

  // Construction finale des chapitres avec compteur global ordre = 1..N
  const chapitres: OfficialProgressionChapterRecord[] = tries.map((ch, index) => {
    const record: OfficialProgressionChapterRecord = {
      ordre: index + 1,
      titre: ch.titre,
    };
    if (ch.volumeHeuresPrevu !== null) record.volumeHeuresPrevu = ch.volumeHeuresPrevu;
    if (ch.sequenceCibleFin !== null) record.sequenceCibleFin = ch.sequenceCibleFin;
    if (ch.moduleOrdre !== null) record.moduleOrdre = ch.moduleOrdre;
    if (ch.moduleTitre !== null) record.moduleTitre = ch.moduleTitre;
    if (ch.leconNumero !== null) record.leconNumero = ch.leconNumero;
    if (ch.numeroAffiche !== null) record.numeroAffiche = ch.numeroAffiche;
    record.positionDansModule = ch.positionDansModule;
    record.positionSource = ch.positionSource;
    if (ch.sourceUrl !== null) record.sourceUrl = ch.sourceUrl;
    return record;
  });

  return {
    chapitres,
    nbExclus: elementsExclus.length,
    erreurCleNaturelleDupliquee: null,
    diagnostics: {
      leconsSansNumero,
      numerosDupliques,
      modulesParasites: Array.from(modulesParasitesMap.values()),
      elementsExclus,
    },
  };
}

/**
 * Calcule le checksum SHA-256 PAR LIGNE (item) sur son contenu métier normalisé :
 * titre + active + chapitres normalisés.
 */
export function calculerChecksumProgression(payload: {
  titre: string;
  active: boolean;
  chapitres: OfficialProgressionChapterRecord[];
}): string {
  const canonique = JSON.stringify({
    titre: payload.titre,
    active: payload.active,
    chapitres: payload.chapitres,
  });
  return createHash('sha256').update(canonique).digest('hex');
}

