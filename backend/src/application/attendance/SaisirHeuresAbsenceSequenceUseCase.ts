/**
 * APPLICATION LAYER — Use Case : Saisie consolidée des heures d'absence (J/NJ) & consignes par séquence.
 * Réservé exclusivement aux rôles consolidant l'assiduité (ADMIN ou STAFF avec permission MANAGE_ATTENDANCE).
 */
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { SequenceAbsenceSummaryRepository } from '@domain/ports/repositories/SequenceAbsenceSummaryRepository';

export class ForbiddenAttendanceConsolidationError extends Error {
  constructor(message = 'Seul un administrateur ou un surveillant général habilité (MANAGE_ATTENDANCE) peut saisir les heures d’absence consolidées.') {
    super(message);
    this.name = 'ForbiddenAttendanceConsolidationError';
  }
}

export interface SequenceAbsenceEntryInput {
  studentId: string;
  justifiedHours: number;
  unjustifiedHours: number;
  consignesCount?: number;
}

export interface SaisirHeuresAbsenceSequenceCommande {
  schoolId: string;
  classId: string;
  academicPeriodId: string;
  sequenceId: string;
  actorUserId: string;
  actorRole: string;
  actorPermissions?: string[];
  entries: SequenceAbsenceEntryInput[];
}

export function canConsolidateAttendanceHours(role: string, permissions?: string[]): boolean {
  const normalizedRole = role.trim().toUpperCase();
  if (normalizedRole === 'ADMIN') return true;
  if (normalizedRole === 'STAFF') {
    return (permissions ?? []).includes('MANAGE_ATTENDANCE');
  }
  return false;
}

export class SaisirHeuresAbsenceSequenceUseCase {
  constructor(
    private readonly sequenceAbsenceRepository: SequenceAbsenceSummaryRepository,
    private readonly classeRepository: ClasseRepository,
    private readonly anneeRepository: AnneeAcademiqueRepository,
  ) {}

  async execute(commande: SaisirHeuresAbsenceSequenceCommande): Promise<{ savedCount: number }> {
    if (!canConsolidateAttendanceHours(commande.actorRole, commande.actorPermissions)) {
      throw new ForbiddenAttendanceConsolidationError();
    }

    const classe = await this.classeRepository.findById(commande.classId);
    if (!classe || classe.schoolId !== commande.schoolId) {
      throw new Error(`Classe introuvable dans cet établissement : ${commande.classId}`);
    }

    const periode = await this.anneeRepository.findPeriodeById(commande.academicPeriodId, commande.schoolId);
    if (!periode) {
      throw new Error(`Période académique introuvable : ${commande.academicPeriodId}`);
    }

    const seqs = await this.anneeRepository.findSequencesByPeriode(commande.academicPeriodId);
    if (!seqs.some((s) => s.id === commande.sequenceId)) {
      throw new Error(`Séquence "${commande.sequenceId}" n'appartient pas à la période "${commande.academicPeriodId}"`);
    }

    for (const item of commande.entries) {
      if (
        !Number.isFinite(item.justifiedHours) ||
        !Number.isFinite(item.unjustifiedHours) ||
        item.justifiedHours < 0 ||
        item.unjustifiedHours < 0
      ) {
        throw new Error(`Heures d'absence invalides pour l'élève ${item.studentId} (valeurs >= 0 requises).`);
      }
      if (item.consignesCount !== undefined && (!Number.isInteger(item.consignesCount) || item.consignesCount < 0)) {
        throw new Error(`Nombre de consignes invalide pour l'élève ${item.studentId}.`);
      }
    }

    const savedCount = await this.sequenceAbsenceRepository.upsertBatchForSequence(
      commande.entries.map((e) => ({
        schoolId: commande.schoolId,
        studentId: e.studentId,
        classId: commande.classId,
        academicYearId: classe.academicYearId,
        academicPeriodId: commande.academicPeriodId,
        sequenceId: commande.sequenceId,
        justifiedHours: Math.round(e.justifiedHours * 100) / 100,
        unjustifiedHours: Math.round(e.unjustifiedHours * 100) / 100,
        consignesCount: e.consignesCount ?? 0,
        recordedById: commande.actorUserId,
      })),
    );

    return { savedCount };
  }
}

