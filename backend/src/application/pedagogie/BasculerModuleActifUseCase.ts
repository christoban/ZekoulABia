/**
 * APPLICATION LAYER — Use Case d'activation / désactivation d'un module d'un programme
 * (ProgrammeModuleEtat).
 *
 * Règles métier :
 * - Aucune donnée n'est supprimée : un module désactivé reste en base et réactivable à tout moment.
 * - RBAC strict : réservé à l'enseignant affecté ou à l'Animateur Pédagogique du département.
 *   L'administration dispose uniquement d'un accès en lecture seule.
 */
import type {
  ChapitreAvancementRepository,
  ProgrammeModuleEtatProps,
} from '@domain/ports/repositories/ChapitreAvancementRepository';
import type { RattachementEnseignantRepository } from '@domain/ports/repositories/RattachementEnseignantRepository';
import {
  PedagogieForbiddenError,
  PedagogieNotFoundError,
  PedagogieValidationError,
} from './errors';

export interface BasculerModuleActifInput {
  schoolId: string;
  userId: string;
  role: string;
  programmeId: string;
  moduleOrdre: number;
  actif: boolean;
}

export class BasculerModuleActifUseCase {
  constructor(
    private readonly avancementRepository: ChapitreAvancementRepository,
    private readonly rattachementRepository: RattachementEnseignantRepository,
  ) {}

  async execute(input: BasculerModuleActifInput): Promise<ProgrammeModuleEtatProps> {
    if (!input.programmeId?.trim() || !Number.isInteger(input.moduleOrdre) || input.moduleOrdre < 0) {
      throw new PedagogieValidationError('programmeId et moduleOrdre valide sont requis');
    }

    // L'administration consulte l'état des modules en lecture seule
    if (input.role.toUpperCase() === 'ADMIN') {
      throw new PedagogieForbiddenError(
        "L'administration dispose d'un accès en lecture seule sur les modules ; seul l'enseignant affecté ou l'Animateur Pédagogique peut activer ou désactiver un module.",
      );
    }

    const ctx = await this.avancementRepository.findProgrammeContextePourModule(
      input.schoolId,
      input.programmeId,
    );
    if (!ctx) {
      throw new PedagogieNotFoundError('Programme introuvable');
    }

    if (!ctx.modulesOrdresExistants.includes(input.moduleOrdre)) {
      throw new PedagogieNotFoundError(`Module ${input.moduleOrdre} introuvable dans ce programme`);
    }

    const [estRattache, estAP] = await Promise.all([
      ctx.classId
        ? this.rattachementRepository.estRattacheALaClasse(
            input.userId,
            ctx.classId,
            ctx.subjectId,
            { autoriserProfesseurPrincipal: false },
          )
        : Promise.resolve(false),
      this.avancementRepository.estAnimateurPedagogiqueDeMatiere(
        input.schoolId,
        input.userId,
        ctx.subjectId,
      ),
    ]);

    if (!estRattache && !estAP) {
      throw new PedagogieForbiddenError(
        "Seul l'enseignant affecté à cette classe/matière ou l'Animateur Pédagogique du département peut activer ou désactiver un module.",
      );
    }

    return this.avancementRepository.definirModuleActif({
      schoolId: input.schoolId,
      programmeId: input.programmeId,
      moduleOrdre: input.moduleOrdre,
      actif: input.actif,
      modifieParId: input.userId,
    });
  }
}
