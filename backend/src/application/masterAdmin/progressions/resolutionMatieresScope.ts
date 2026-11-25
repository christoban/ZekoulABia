import type { OfficialProgressionImportRepository } from '@domain/ports/repositories/OfficialProgressionImportRepository';
import {
  etendreMatieresReferenceImport,
  expliquerRejetLibelleAbstrait,
} from '@domain/rules/officialProgressionSubjects';
import { normaliserCleMatiere } from './chapitresNormalisation';
import type { RejetImportProgression } from './types';

interface EntreeScopeMatieres {
  map: Map<string, string>;
  liste: string[];
  brutes: string[];
}

export interface ResultatResolutionMatiere {
  subjectNameCanonique: string | null;
  rejet: RejetImportProgression | null;
}

export interface ParametresResolutionMatiere {
  index: number;
  templateCode: string;
  level: string;
  filiere: string;
  subjectNameBrut: string;
  subjectNameSource: string | null;
}

/**
 * Résout strictement une matière d'import dans un scope (templateCode, level, filiere) :
 * - met en cache les matières par scope sur la durée d'un lot ;
 * - applique l'expansion domaine (LV2 / Lettres classiques) et la normalisation casse/accents/espaces ;
 * - construit le rejet SUBJECT_NOT_FOUND avec message explicite et liste matieresConnues.
 */
export class ResolveurMatieresScope {
  private readonly cache = new Map<string, EntreeScopeMatieres>();

  constructor(
    private readonly repo: Pick<OfficialProgressionImportRepository, 'listKnownSubjectsForScope'>,
  ) {}

  async resoudre(params: ParametresResolutionMatiere): Promise<ResultatResolutionMatiere> {
    const { index, templateCode, level, filiere, subjectNameBrut, subjectNameSource } = params;
    const cleScope = `${templateCode}::${level}::${filiere}`;

    let entreeScope = this.cache.get(cleScope);
    if (!entreeScope) {
      const brutes = await this.repo.listKnownSubjectsForScope({ templateCode, level, filiere });
      const etendues = etendreMatieresReferenceImport(brutes, level);
      const map = new Map<string, string>();
      for (const canon of etendues) {
        map.set(normaliserCleMatiere(canon), canon);
      }
      const liste = [...etendues].sort((a, b) => a.localeCompare(b, 'fr'));
      entreeScope = { map, liste, brutes };
      this.cache.set(cleScope, entreeScope);
    }

    const subjectNameCanonique = entreeScope.map.get(normaliserCleMatiere(subjectNameBrut));
    if (!subjectNameCanonique) {
      const raisonAbstrait = expliquerRejetLibelleAbstrait(
        subjectNameBrut,
        entreeScope.brutes,
        level,
      );
      return {
        subjectNameCanonique: null,
        rejet: {
          index,
          templateCode,
          level,
          filiere,
          subjectName: subjectNameBrut,
          subjectNameSource,
          code: 'SUBJECT_NOT_FOUND',
          message:
            raisonAbstrait ??
            `Matière « ${subjectNameBrut} » sans correspondance dans le référentiel (${templateCode} / ${level}${filiere ? ` / ${filiere}` : ''}).`,
          matieresConnues: entreeScope.liste,
        },
      };
    }

    return { subjectNameCanonique, rejet: null };
  }
}
