import type { TeachingAssignmentGeneratorRepository } from '@domain/ports/repositories/TeachingAssignmentGeneratorRepository';
import {
  genererAffectations,
  reequilibrerAffectations,
  type CandidatMatiereClasse,
  type EnseignantEligible,
  type MatiereNonResolue,
  type MatiereHorsPerimetre,
} from '@domain/services/AffecterEnseignantsService';

export interface GenererAffectationsCommande {
  schoolId: string;
  academicYearId: string;
  classId?: string;
  rebalanceExisting?: boolean;
}

export interface ResumeGenerationAffectations {
  createdCount: number;
  rebalancedCount: number;
  nonResolus: MatiereNonResolue[];
  horsPerimetre: MatiereHorsPerimetre[];
}

export class GenererAffectationsUseCase {
  constructor(private readonly generatorRepository: TeachingAssignmentGeneratorRepository) {}

  async execute(commande: GenererAffectationsCommande): Promise<ResumeGenerationAffectations> {
    const { schoolId, academicYearId, classId } = commande;

    await this.generatorRepository.syncLv2Groups(schoolId, academicYearId);
    const data = await this.generatorRepository.loadGenerationData(schoolId, academicYearId, classId);

    const weeklyPeriodsByKey = new Map<string, number | null>();
    for (const m of data.matieres) {
      weeklyPeriodsByKey.set(`${m.classId}:${m.subjectId}`, m.weeklyPeriods);
    }

    const existingKeys = new Set(data.affectations.map((a) => `${a.classId}:${a.subjectId}`));

    const candidats: CandidatMatiereClasse[] = data.matieres.map((m) => ({
      classId: m.classId,
      className: m.className,
      subjectId: m.subjectId,
      subjectName: m.subjectName,
      weeklyPeriods: m.weeklyPeriods,
      dejaAffecte: existingKeys.has(`${m.classId}:${m.subjectId}`),
    }));

    const chargeParEnseignant = new Map<string, number>();
    for (const a of data.affectations) {
      const key = `${a.classId}:${a.subjectId}`;
      const wp = weeklyPeriodsByKey.get(key) ?? a.subjectHoursPerWeek ?? 0;
      chargeParEnseignant.set(a.teacherId, (chargeParEnseignant.get(a.teacherId) ?? 0) + wp);
    }

    const enseignantsEligibles: EnseignantEligible[] = data.enseignants.map((e) => ({
      teacherId: e.teacherId,
      subjectId: e.subjectId,
      estAP: e.estAP,
      chargeActuelleHeures: chargeParEnseignant.get(e.teacherId) ?? 0,
    }));

    let rebalancedCount = 0;
    if (commande.rebalanceExisting) {
      const affectationsAEquilibrer = data.affectations
        .filter(affectation => !classId || affectation.classId === classId)
        .map(affectation => ({
          ...affectation,
          weeklyPeriods: weeklyPeriodsByKey.get(`${affectation.classId}:${affectation.subjectId}`) ?? affectation.subjectHoursPerWeek ?? 0,
        }));
      const modifications = reequilibrerAffectations(affectationsAEquilibrer, enseignantsEligibles);
      rebalancedCount = await this.generatorRepository.updateAssignmentsInTransaction(modifications.map(modification => ({
        id: modification.id,
        teacherId: modification.nouveauTeacherId,
      })));
    }

    const resultat = genererAffectations(candidats, enseignantsEligibles);

    const assignments = resultat.aCreer.map((a) => ({
      classId: a.classId,
      subjectId: a.subjectId,
      teacherId: a.teacherId,
      schoolId,
      academicYearId,
    }));

    const createdCount = await this.generatorRepository.createAssignmentsInTransaction(assignments);
    await this.generatorRepository.persistIssues({
      schoolId,
      academicYearId,
      issues: resultat.nonResolus.map(issue => ({
        classId: issue.classId,
        subjectId: issue.subjectId,
        reason: issue.raison,
      })),
    });

    return {
      createdCount,
      rebalancedCount,
      nonResolus: resultat.nonResolus,
      horsPerimetre: resultat.horsPerimetre,
    };
  }
}
