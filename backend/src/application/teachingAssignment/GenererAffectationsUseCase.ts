import type { TeachingAssignmentGeneratorRepository } from '@domain/ports/repositories/TeachingAssignmentGeneratorRepository';
import {
  genererAffectations,
  type CandidatMatiereClasse,
  type EnseignantEligible,
  type MatiereNonResolue,
  type MatiereHorsPerimetre,
} from '@domain/services/AffecterEnseignantsService';

export interface GenererAffectationsCommande {
  schoolId: string;
  academicYearId: string;
  classId?: string;
}

export interface ResumeGenerationAffectations {
  createdCount: number;
  nonResolus: MatiereNonResolue[];
  horsPerimetre: MatiereHorsPerimetre[];
}

export class GenererAffectationsUseCase {
  constructor(private readonly generatorRepository: TeachingAssignmentGeneratorRepository) {}

  async execute(commande: GenererAffectationsCommande): Promise<ResumeGenerationAffectations> {
    const { schoolId, academicYearId, classId } = commande;

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
      const wp = weeklyPeriodsByKey.get(key) ?? 0;
      chargeParEnseignant.set(a.teacherId, (chargeParEnseignant.get(a.teacherId) ?? 0) + wp);
    }

    const enseignantsEligibles: EnseignantEligible[] = data.enseignants.map((e) => ({
      teacherId: e.teacherId,
      subjectId: e.subjectId,
      estAP: e.estAP,
      chargeActuelleHeures: chargeParEnseignant.get(e.teacherId) ?? 0,
    }));

    const resultat = genererAffectations(candidats, enseignantsEligibles);

    const assignments = resultat.aCreer.map((a) => ({
      classId: a.classId,
      subjectId: a.subjectId,
      teacherId: a.teacherId,
      schoolId,
      academicYearId,
    }));

    const createdCount = await this.generatorRepository.createAssignmentsInTransaction(assignments);

    return {
      createdCount,
      nonResolus: resultat.nonResolus,
      horsPerimetre: resultat.horsPerimetre,
    };
  }
}
