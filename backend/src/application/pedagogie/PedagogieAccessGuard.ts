/**
 * APPLICATION LAYER — Garde RBAC unique (DRY) pour la pédagogie & les programmes.
 *
 * Règles métier strictes (isolation par département pour les Animateurs Pédagogiques) :
 * - ADMIN ou détenteur de la permission MANAGE_CLASSES (Censeur, Vice-Principal, Directeur Adjoint)
 *   → accès complet à tous les programmes de l'établissement (SCHOOL_WIDE).
 * - Animateur Pédagogique (TEACHER ou STAFF chef d'au moins un département via Department.headId)
 *   → accès STRICTEMENT scopé aux matières de son/ses département(s) (DEPARTMENT_SCOPED).
 *   Un AP d'Anglais ne peut ni voir ni modifier les programmes de Français ou d'Espagnol.
 * - Tout autre utilisateur (enseignant simple, secrétaire, intendant, élève, parent)
 *   → accès refusé en écriture programmes/chapitres et sur les rapports consolidés (NONE).
 */
import type { DepartmentRepository } from '@domain/ports/repositories/DepartmentRepository';
import type { RattachementEnseignantRepository } from '@domain/ports/repositories/RattachementEnseignantRepository';
import { PedagogieForbiddenError } from './errors';

export interface PedagogieActor {
  userId: string;
  role: string;
  permissions?: string[];
}

export type PedagogieScope =
  | { kind: 'SCHOOL_WIDE' }
  | { kind: 'DEPARTMENT_SCOPED'; departmentIds: Set<string>; subjectIds: Set<string> }
  | { kind: 'NONE' };

export async function resoudreScopePedagogie(
  departmentRepository: DepartmentRepository,
  schoolId: string,
  actor: PedagogieActor,
): Promise<PedagogieScope> {
  const roleUpper = actor.role.toUpperCase();
  const perms = actor.permissions ?? [];

  if (roleUpper === 'ADMIN' || perms.includes('MANAGE_CLASSES')) {
    return { kind: 'SCHOOL_WIDE' };
  }

  if (roleUpper === 'TEACHER' || roleUpper === 'STAFF') {
    const departments = await departmentRepository.findBySchool(schoolId);
    const headed = departments.filter((d) => d.headId === actor.userId);
    if (headed.length > 0) {
      const departmentIds = new Set(headed.map((d) => d.id));
      const subjectIds = new Set<string>();
      for (const d of headed) {
        for (const s of d.subjects ?? []) {
          subjectIds.add(s.id);
        }
      }
      return { kind: 'DEPARTMENT_SCOPED', departmentIds, subjectIds };
    }
  }

  return { kind: 'NONE' };
}

/**
 * Vérifie que l'acteur a le droit de créer/modifier/supprimer un programme ou chapitre
 * sur `subjectId`. Lève PedagogieForbiddenError (403) dans le cas contraire.
 */
export async function exigerDroitGestionProgrammeMatiere(
  departmentRepository: DepartmentRepository,
  schoolId: string,
  subjectId: string,
  actor?: PedagogieActor,
): Promise<void> {
  if (!actor) return;

  const scope = await resoudreScopePedagogie(departmentRepository, schoolId, actor);
  if (scope.kind === 'SCHOOL_WIDE') return;

  if (scope.kind === 'DEPARTMENT_SCOPED') {
    if (scope.subjectIds.has(subjectId)) return;
    throw new PedagogieForbiddenError(
      "Accès refusé : un Animateur Pédagogique ne peut gérer que les programmes des matières rattachées à son département.",
    );
  }

  throw new PedagogieForbiddenError(
    "Accès refusé : seuls l'administration, le censeur ou l'Animateur Pédagogique du département peuvent gérer les programmes.",
  );
}

/**
 * Vérifie que l'acteur a le droit de consulter un programme ou sa progression
 * pour un couple (classId, subjectId) :
 * - ADMIN / MANAGE_CLASSES (Censeur) : toute l'école ;
 * - AP chef de département : matières de son département ;
 * - Enseignant (TEACHER) : uniquement s'il est affecté à (classId, subjectId) ;
 * - Tout autre rôle (enseignant non affecté, élève, parent, staff sans droit) : 403.
 */
export async function exigerDroitLectureProgrammeClasseMatiere(
  departmentRepository: DepartmentRepository,
  rattachementRepository: RattachementEnseignantRepository | undefined,
  schoolId: string,
  subjectId: string,
  classId: string | undefined,
  actor?: PedagogieActor,
): Promise<void> {
  if (!actor) return;

  const scope = await resoudreScopePedagogie(departmentRepository, schoolId, actor);
  if (scope.kind === 'SCHOOL_WIDE') return;
  if (scope.kind === 'DEPARTMENT_SCOPED' && scope.subjectIds.has(subjectId)) return;

  if (actor.role.toUpperCase() === 'TEACHER' && classId && rattachementRepository) {
    const rattache = await rattachementRepository.estRattacheALaClasse(
      actor.userId,
      classId,
      subjectId,
      { autoriserProfesseurPrincipal: false },
    );
    if (rattache) return;
  }

  throw new PedagogieForbiddenError(
    "Accès refusé : vous n'êtes pas affecté à cette classe/matière ni autorisé à consulter ce programme.",
  );
}
