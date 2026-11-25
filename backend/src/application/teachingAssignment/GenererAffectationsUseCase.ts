import type { TeachingAssignmentGeneratorRepository } from '@domain/ports/repositories/TeachingAssignmentGeneratorRepository';
import { calculerChargeParEnseignant } from '@domain/rules/CapaciteEmploiDuTemps';
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

    const chargeParEnseignant = calculerChargeParEnseignant(data.affectations.map((a) => ({
      teacherId: a.teacherId,
      weeklyPeriods: weeklyPeriodsByKey.get(`${a.classId}:${a.subjectId}`) ?? a.subjectHoursPerWeek,
    })));

    const enseignantsEligibles: EnseignantEligible[] = data.enseignants.map((e) => {
      const configuredCapacity = e.maxWeeklyHours ?? e.defaultMaxWeeklyHours;
      const capaciteHeures = configuredCapacity === null || configuredCapacity === undefined
        ? e.capaciteHeures
        : e.capaciteHeures === undefined
          ? configuredCapacity
          : Math.min(e.capaciteHeures, configuredCapacity);
      return {
        teacherId: e.teacherId,
        subjectId: e.subjectId,
        estAP: e.estAP,
        chargeActuelleHeures: chargeParEnseignant.get(e.teacherId) ?? 0,
        capaciteHeures,
      };
    });

    let rebalancedCount = 0;
    if (commande.rebalanceExisting) {
      const affectationsAEquilibrer = data.affectations
        .filter(affectation => affectation.source === 'GENERATED' && (!classId || affectation.classId === classId))
        .map(affectation => ({
          ...affectation,
          weeklyPeriods: weeklyPeriodsByKey.get(`${affectation.classId}:${affectation.subjectId}`) ?? affectation.subjectHoursPerWeek ?? 0,
        }));
      const modifications = reequilibrerAffectations(affectationsAEquilibrer, enseignantsEligibles);
      for (const modification of modifications) {
        const affectation = affectationsAEquilibrer.find((a) => a.id === modification.id);
        if (!affectation) continue;
        for (const enseignant of enseignantsEligibles) {
          if (enseignant.teacherId === modification.ancienTeacherId) {
            enseignant.chargeActuelleHeures -= affectation.weeklyPeriods;
          }
          if (enseignant.teacherId === modification.nouveauTeacherId) {
            enseignant.chargeActuelleHeures += affectation.weeklyPeriods;
          }
        }
      }
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
        details: issue.details,
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
