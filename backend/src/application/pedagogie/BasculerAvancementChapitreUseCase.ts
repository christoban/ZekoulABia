/**
 * APPLICATION LAYER — Use Case de coche / décoche directe d'une leçon (ChapitreAvancement).
 *
 * Règles métier :
 * - Une leçon est considérée « faite » si elle est cochée directement OU référencée par >= 1 CahierDeTexte.
 * - Décocher retire UNIQUEMENT la coche directe ; si un CahierDeTexte référence encore cette leçon,
 *   elle reste « faite » avec sourceRealisation = 'CAHIER'.
 * - RBAC strict : uniquement l'enseignant affecté à (classId, subjectId) (sans prof principal non affecté)
 *   OU l'Animateur Pédagogique chef du département contenant subjectId.
 */
import type { ChapitreAvancementRepository } from '@domain/ports/repositories/ChapitreAvancementRepository';
import type { CahierDeTexteRepository } from '@domain/ports/repositories/CahierDeTexteRepository';
import type { RattachementEnseignantRepository } from '@domain/ports/repositories/RattachementEnseignantRepository';
import {
  PedagogieForbiddenError,
  PedagogieNotFoundError,
  PedagogieValidationError,
} from './errors';

export type SourceRealisationLecon = 'COCHE' | 'CAHIER' | 'LES_DEUX' | null;

export interface BasculerAvancementChapitreInput {
  schoolId: string;
  userId: string;
  role: string;
  chapitreId: string;
  classId: string;
  fait: boolean;
}

export interface BasculerAvancementChapitreResultat {
  chapitreId: string;
  classId: string;
  realise: boolean;
  cocheDirecte: boolean;
  nbSeancesCahier: number;
  sourceRealisation: SourceRealisationLecon;
  cocheParId: string | null;
  cocheLe: Date | null;
}

export class BasculerAvancementChapitreUseCase {
  constructor(
    private readonly avancementRepository: ChapitreAvancementRepository,
    private readonly cahierDeTexteRepository: CahierDeTexteRepository,
    private readonly rattachementRepository: RattachementEnseignantRepository,
  ) {}

  async execute(
    input: BasculerAvancementChapitreInput,
  ): Promise<BasculerAvancementChapitreResultat> {
    if (!input.chapitreId?.trim() || !input.classId?.trim()) {
      throw new PedagogieValidationError('chapitreId et classId sont requis');
    }

    const ctx = await this.avancementRepository.findChapitreContextePourCoche(
      input.schoolId,
      input.chapitreId,
    );
    if (!ctx) {
      throw new PedagogieNotFoundError('Chapitre introuvable');
    }

    if (ctx.classId !== null && ctx.classId !== input.classId) {
      throw new PedagogieValidationError("Ce chapitre n'appartient pas à cette classe");
    }

    const [estRattache, estAP] = await Promise.all([
      this.rattachementRepository.estRattacheALaClasse(
        input.userId,
        input.classId,
        ctx.subjectId,
        { autoriserProfesseurPrincipal: false },
      ),
      this.avancementRepository.estAnimateurPedagogiqueDeMatiere(
        input.schoolId,
        input.userId,
        ctx.subjectId,
      ),
    ]);

    if (!estRattache && !estAP) {
      throw new PedagogieForbiddenError(
        "Seul l'enseignant affecté à cette classe/matière ou l'Animateur Pédagogique du département peut cocher cette leçon.",
      );
    }

    let cocheDirecte = false;
    let cocheParId: string | null = null;
    let cocheLe: Date | null = null;

    if (input.fait) {
      const saved = await this.avancementRepository.marquerFait({
        schoolId: input.schoolId,
        classId: input.classId,
        chapitreId: input.chapitreId,
        academicYearId: ctx.academicYearId,
        cocheParId: input.userId,
      });
      cocheDirecte = true;
      cocheParId = saved.cocheParId;
      cocheLe = saved.cocheLe;
    } else {
      await this.avancementRepository.retirerCocheDirecte(
        input.schoolId,
        input.classId,
        input.chapitreId,
      );
      cocheDirecte = false;
    }

    const entries = await this.cahierDeTexteRepository.findByFilters(input.schoolId, {
      classId: input.classId,
      subjectId: ctx.subjectId,
      academicYearId: ctx.academicYearId,
    });
    const nbSeancesCahier = entries.filter((e) => e.chapitreId === input.chapitreId).length;
    const realise = cocheDirecte || nbSeancesCahier > 0;
    const sourceRealisation: SourceRealisationLecon =
      cocheDirecte && nbSeancesCahier > 0
        ? 'LES_DEUX'
        : cocheDirecte
          ? 'COCHE'
          : nbSeancesCahier > 0
            ? 'CAHIER'
            : null;

    return {
      chapitreId: input.chapitreId,
      classId: input.classId,
      realise,
      cocheDirecte,
      nbSeancesCahier,
      sourceRealisation,
      cocheParId,
      cocheLe,
    };
  }
}
