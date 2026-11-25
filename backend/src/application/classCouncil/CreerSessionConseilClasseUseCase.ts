import type { ClassCouncilRepository } from '@domain/ports/repositories/ClassCouncilRepository';
import type { ActivityLogPort } from '@domain/ports/services/ActivityLogPort';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';

export interface CreerSessionCommande {
  schoolId: string;
  classId: string;
  academicPeriodId: string;
  presidedById: string;
  userRole: string;
  userPermissions?: string[];
}

export interface CreerSessionResultat {
  session: unknown;
  className: string;
  studentCount: number;
}

export class CreerSessionConseilClasseUseCase {
  constructor(
    private readonly repo: ClassCouncilRepository,
    private readonly activityLog: ActivityLogPort,
    private readonly auditLog: AIActionAuditPort,
  ) {}

  async execute(commande: CreerSessionCommande): Promise<CreerSessionResultat> {
    const { schoolId, classId, academicPeriodId, presidedById, userRole, userPermissions } = commande;

    if (!classId || !academicPeriodId) {
      throw new Error('classId et academicPeriodId sont requis');
    }

    const estAdmin = userRole.toUpperCase() === 'ADMIN';
    const aPermission = (userPermissions ?? []).includes('VALIDATE_GRADES');
    if (!estAdmin && !aPermission) {
      throw new ForbiddenError('Permission VALIDATE_GRADES requise');
    }

    const schoolClass = await this.repo.classeExiste(classId, schoolId);
    if (!schoolClass) {
      throw new NotFoundError('Classe introuvable');
    }

    const unvalidated = await this.repo.compterNotesNonValidees(schoolId, classId, academicPeriodId);
    if (unvalidated > 0) {
      throw new ConflictError(
        `${unvalidated} note(s) non encore validée(s). Validez toutes les notes avant de tenir le Conseil de Classe.`,
        { unvalidatedCount: unvalidated, blocked: true },
      );
    }

    const existing = await this.repo.sessionExistente(classId, academicPeriodId);
    if (existing) {
      throw new ConflictError(
        'Une session de Conseil de Classe existe déjà pour cette classe et cette période',
        { session: existing },
      );
    }

    const session = await this.repo.creerSession({ schoolId, classId, academicPeriodId, presidedById });

    const studentIds = await this.repo.elevesDansClasse(classId);
    await this.repo.preRemplirDecisions(session.id, studentIds);

    this.activityLog.log({
      userId: presidedById,
      schoolId,
      action: 'Class council session created',
      details: `Classe ${schoolClass.name} — période ${academicPeriodId} — ${studentIds.length} élève(s) pré-peuplé(s)`,
    });

    this.auditLog.journaliser({
      actorUserId: presidedById, actorRole: userRole, schoolId,
      actionName: 'ouvrir_conseil_classe', targetType: 'Class', targetId: classId,
      origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { classId, academicPeriodId },
    });

    return { session, className: schoolClass.name, studentCount: studentIds.length };
  }
}

class ForbiddenError extends Error {
  constructor(message: string) { super(message); this.name = 'ForbiddenError'; }
}

class NotFoundError extends Error {
  constructor(message: string) { super(message); this.name = 'NotFoundError'; }
}

class ConflictError extends Error {
  public readonly details?: unknown;
  constructor(message: string, details?: unknown) { super(message); this.name = 'ConflictError'; this.details = details; }
}
