import type { MatiereRepository, CoefficientMatiere } from '@domain/ports/repositories/MatiereRepository';

export interface DefinirCoefficientCommande {
  schoolId: string;
  subjectId: string;
  demandeurRole: string;
  coefficients: {
    classLevel: string;
    serieCode?: string;
    coefficient: number;
  }[];
}

export interface DefinirCoefficientResultat {
  matiereId: string;
  nombreMisAJour: number;
}

export class DefinirCoefficientUseCase {
  constructor(private readonly matiereRepository: MatiereRepository) {}

  async execute(commande: DefinirCoefficientCommande): Promise<DefinirCoefficientResultat> {
    if (commande.demandeurRole !== 'ADMIN') {
      throw new Error('Seul un Admin peut définir les coefficients');
    }

    const matiere = await this.matiereRepository.findById(commande.subjectId);
    if (!matiere) throw new Error(`Matière introuvable : ${commande.subjectId}`);
    if (matiere.schoolId !== commande.schoolId) {
      throw new Error('Accès refusé : matière hors de votre établissement');
    }

    for (const c of commande.coefficients) {
      if (c.coefficient <= 0) {
        throw new Error(
          `Coefficient invalide pour niveau "${c.classLevel}" : doit être > 0`
        );
      }
    }

    const coefficients: CoefficientMatiere[] = commande.coefficients.map(c => ({
      subjectId: commande.subjectId,
      classLevel: c.classLevel,
      serieCode: c.serieCode,
      coefficient: c.coefficient,
    }));

    await this.matiereRepository.upsertCoefficients(commande.schoolId, coefficients);

    return {
      matiereId: commande.subjectId,
      nombreMisAJour: commande.coefficients.length,
    };
  }
}
