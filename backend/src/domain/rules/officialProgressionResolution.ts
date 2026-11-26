/**
 * DOMAIN LAYER — Règle métier pure de résolution d'une progression nationale
 * (OfficialProgrammeProgression) pour une (classe, matière) d'établissement.
 *
 * Aucune dépendance Prisma ou HTTP. Utilisée par :
 * - ProposerInitialisationProgrammesClasseUseCase (dry-run)
 * - AppliquerInitialisationProgrammesClasseUseCase (application atomique)
 */
import {
  ABSTRACT_LV2_LABEL,
  COMPOSITE_CLASSICAL_LABEL,
  CONCRETE_CLASSICAL_SUBJECTS,
  CONCRETE_LV2_SUBJECTS,
  normaliserNiveauScolaire,
} from '@domain/rules/officialProgressionSubjects';

export type OptionClassique = (typeof CONCRETE_CLASSICAL_SUBJECTS)[number];

export interface ClasseContexteResolution {
  schoolTemplateCode: string;
  level: string | null;
  filiere: string | null;
  serie: string | null;
  pebsMixte: boolean;
}

export interface OfficialProgressionCandidate {
  id: string;
  templateCode: string;
  level: string;
  filiere: string;
  subjectName: string;
  titre: string;
  importChecksum: string | null;
  nbLecons: number;
}

export type ResolutionProgressionResultat =
  | {
      statut: 'RESOLU';
      progression: OfficialProgressionCandidate;
      filiereResolue: string;
      subjectNameResolu: string;
    }
  | {
      statut: 'CHOIX_REQUIS';
      options: OptionClassique[];
      candidates: OfficialProgressionCandidate[];
      raison: string;
    }
  | {
      statut: 'IMPOSSIBLE';
      raison: string;
    };

export function normaliserCleLibelle(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const CLE_LV2 = normaliserCleLibelle(ABSTRACT_LV2_LABEL);
const CLE_LETTRES_CLASSIQUES = normaliserCleLibelle(COMPOSITE_CLASSICAL_LABEL);

const NIVEAUX_ANGLOPHONES_MAP: Record<string, string> = {
  'form 1': 'Form1',
  form1: 'Form1',
  'form 2': 'Form2',
  form2: 'Form2',
  'form 3': 'Form3',
  form3: 'Form3',
  'form 4': 'Form4',
  form4: 'Form4',
  'form 5': 'Form5',
  form5: 'Form5',
  'lower sixth': 'LowerSixth',
  lowersixth: 'LowerSixth',
  'upper sixth': 'UpperSixth',
  uppersixth: 'UpperSixth',
};

const NIVEAUX_PREMIER_CYCLE_FR = new Set(['6e', '5e', '4e', '3e']);
const NIVEAUX_SECOND_CYCLE_FR = new Set(['2nde', '1ere', 'Tle']);
const NIVEAUX_ANGLOPHONES = new Set([
  'Form1', 'Form2', 'Form3', 'Form4', 'Form5', 'LowerSixth', 'UpperSixth',
]);

/** Normalise le niveau scolaire vers la forme canonique utilisée dans OfficialProgrammeProgression. */
export function normaliserNiveauPourResolution(level: string | null | undefined): string | null {
  if (!level || !level.trim()) return null;
  const cle = normaliserCleLibelle(level);
  if (NIVEAUX_ANGLOPHONES_MAP[cle]) return NIVEAUX_ANGLOPHONES_MAP[cle];
  return normaliserNiveauScolaire(level);
}

/** Retourne les templates candidats par ordre de priorité : spécifique école puis "__ALL__". */
export function calculerTemplatesCandidats(schoolTemplateCode: string): string[] {
  const res: string[] = [];
  const trimmed = schoolTemplateCode.trim();
  if (trimmed) res.push(trimmed);
  if (trimmed !== '__ALL__') res.push('__ALL__');
  return res;
}

/**
 * Calcule la liste ordonnée des filières à consulter dans OfficialProgrammeProgression
 * pour une classe donnée (1er cycle FR, 2nd cycle FR séries, anglophone, PEBS mixte).
 */
export function calculerFilieresCandidates(ctx: ClasseContexteResolution): string[] {
  const niveau = normaliserNiveauPourResolution(ctx.level);
  const filiereBrute = ctx.filiere?.trim() || '';
  const serieBrute = ctx.serie?.trim() || '';
  const result: string[] = [];

  const ajouter = (v: string) => {
    if (!result.includes(v)) result.push(v);
  };

  if (niveau && NIVEAUX_PREMIER_CYCLE_FR.has(niveau)) {
    if (filiereBrute) {
      ajouter(filiereBrute);
      // Une classe FR_GENERAL marquée pebsMixte peut héberger des matières PEBS (Intensive English, etc.)
      if (ctx.pebsMixte && filiereBrute === 'FR_GENERAL') {
        ajouter('FR_PEBS');
      }
    } else if (ctx.pebsMixte) {
      ajouter('FR_PEBS');
      ajouter('FR_GENERAL');
    } else {
      ajouter('FR_GENERAL');
    }
    ajouter('');
    return result;
  }

  if (niveau && NIVEAUX_SECOND_CYCLE_FR.has(niveau)) {
    if (serieBrute) {
      ajouter(serieBrute);
      const baseSerie = serieBrute.split(/[-\s]/)[0]?.trim() ?? '';
      if (baseSerie && baseSerie !== serieBrute) {
        ajouter(baseSerie);
      }
    }
    if (filiereBrute) {
      ajouter(filiereBrute);
      const baseFiliere = filiereBrute.split(/[-\s]/)[0]?.trim() ?? '';
      if (baseFiliere && baseFiliere !== filiereBrute) {
        ajouter(baseFiliere);
      }
    }
    if (ctx.pebsMixte) {
      ajouter('FR_PEBS');
    }
    ajouter('');
    return result;
  }

  if (niveau && NIVEAUX_ANGLOPHONES.has(niveau)) {
    if (filiereBrute) {
      ajouter(filiereBrute);
      if (ctx.pebsMixte && filiereBrute === 'EN_GENERAL') {
        ajouter('EN_PEBS');
      }
    } else if (serieBrute) {
      ajouter(serieBrute);
      ajouter('EN_GENERAL');
    } else if (ctx.pebsMixte) {
      ajouter('EN_PEBS');
      ajouter('EN_GENERAL');
    } else {
      ajouter('EN_GENERAL');
    }
    ajouter('');
    return result;
  }

  if (filiereBrute) ajouter(filiereBrute);
  if (serieBrute) ajouter(serieBrute);
  ajouter('');
  return result;
}

function trouverMeilleureCandidate(
  candidates: readonly OfficialProgressionCandidate[],
  templatesOrdre: readonly string[],
  filieresOrdre: readonly string[],
  niveauNorm: string,
  subjectNameCible: string,
): OfficialProgressionCandidate | null {
  const cleSujet = normaliserCleLibelle(subjectNameCible);
  const cleNiveau = normaliserCleLibelle(niveauNorm);

  for (const tpl of templatesOrdre) {
    for (const fil of filieresOrdre) {
      const cleFil = normaliserCleLibelle(fil);
      const found = candidates.find(
        (c) =>
          c.templateCode === tpl &&
          normaliserCleLibelle(normaliserNiveauPourResolution(c.level) ?? c.level) === cleNiveau &&
          normaliserCleLibelle(c.filiere) === cleFil &&
          normaliserCleLibelle(c.subjectName) === cleSujet,
      );
      if (found) return found;
    }
  }
  return null;
}

/**
 * Résout la progression officielle nationale applicable à une matière d'une classe.
 */
export function resoudreProgressionOfficielle(
  ctx: ClasseContexteResolution,
  subjectName: string,
  candidates: readonly OfficialProgressionCandidate[],
  optionClassique?: OptionClassique,
): ResolutionProgressionResultat {
  const niveau = normaliserNiveauPourResolution(ctx.level);
  if (!niveau) {
    return {
      statut: 'IMPOSSIBLE',
      raison: 'Niveau de la classe non renseigné',
    };
  }

  const cleSujet = normaliserCleLibelle(subjectName);
  const templatesOrdre = calculerTemplatesCandidats(ctx.schoolTemplateCode);
  const filieresOrdre = calculerFilieresCandidates(ctx);

  // Cas 1 : Poste abstrait générique "LV2" → refusé, il faut une langue concrète
  if (cleSujet === CLE_LV2) {
    return {
      statut: 'IMPOSSIBLE',
      raison: `Matière générique « LV2 » : rattachez une langue vivante concrète (${CONCRETE_LV2_SUBJECTS.join(', ')}) à la classe.`,
    };
  }

  // Cas 2 : Poste composite "Lettres classiques (Latin/Grec)"
  if (cleSujet === CLE_LETTRES_CLASSIQUES) {
    if (niveau === '6e' || niveau === '5e') {
      const latin = trouverMeilleureCandidate(candidates, templatesOrdre, filieresOrdre, niveau, 'Latin');
      if (!latin) {
        return {
          statut: 'IMPOSSIBLE',
          raison: `Aucune progression nationale « Latin » trouvée pour ${niveau} (${filieresOrdre.filter(Boolean).join(', ') || 'général'}).`,
        };
      }
      return {
        statut: 'RESOLU',
        progression: latin,
        filiereResolue: latin.filiere,
        subjectNameResolu: latin.subjectName,
      };
    }

    if (niveau === '4e' || niveau === '3e') {
      if (optionClassique) {
        const choisi = trouverMeilleureCandidate(
          candidates,
          templatesOrdre,
          filieresOrdre,
          niveau,
          optionClassique,
        );
        if (!choisi) {
          return {
            statut: 'IMPOSSIBLE',
            raison: `Aucune progression nationale « ${optionClassique} » trouvée pour ${niveau}.`,
          };
        }
        return {
          statut: 'RESOLU',
          progression: choisi,
          filiereResolue: choisi.filiere,
          subjectNameResolu: choisi.subjectName,
        };
      }

      const disponibles = CONCRETE_CLASSICAL_SUBJECTS
        .map((nom) => ({
          nom,
          cand: trouverMeilleureCandidate(candidates, templatesOrdre, filieresOrdre, niveau, nom),
        }))
        .filter((x): x is { nom: OptionClassique; cand: OfficialProgressionCandidate } => x.cand !== null);

      if (disponibles.length === 0) {
        return {
          statut: 'IMPOSSIBLE',
          raison: `Aucune progression nationale Latin ou Grec trouvée pour ${niveau}.`,
        };
      }
      if (disponibles.length === 1) {
        const seul = disponibles[0];
        return {
          statut: 'RESOLU',
          progression: seul.cand,
          filiereResolue: seul.cand.filiere,
          subjectNameResolu: seul.cand.subjectName,
        };
      }
      return {
        statut: 'CHOIX_REQUIS',
        options: disponibles.map((d) => d.nom),
        candidates: disponibles.map((d) => d.cand),
        raison: `La matière « ${COMPOSITE_CLASSICAL_LABEL} » en ${niveau} dispose de deux programmes distincts (Latin et Grec) : choisissez l'option enseignée dans cette classe.`,
      };
    }
  }

  // Cas 3 : Correspondance directe (y compris LV2 concrètes, Intensive English, SVTEEHB, Sciences, Latin, Grec, séries 2nd cycle)
  const match = trouverMeilleureCandidate(candidates, templatesOrdre, filieresOrdre, niveau, subjectName);
  if (!match) {
    return {
      statut: 'IMPOSSIBLE',
      raison: `Aucun programme national disponible pour « ${subjectName} » (${niveau}${filieresOrdre[0] ? ` · ${filieresOrdre[0]}` : ''}).`,
    };
  }

  return {
    statut: 'RESOLU',
    progression: match,
    filiereResolue: match.filiere,
    subjectNameResolu: match.subjectName,
  };
}
