import type { IOrientationRepository } from '@domain/ports/repositories/IOrientationRepository';
import type { FicheOrientation, TypePreoccupation } from '@domain/entities/FicheOrientation';

export interface CreerFicheCommande {
  studentId:      string;
  schoolId:       string;
  academicYearId: string;
  conseillerId:   string;
  mainConcern?:   TypePreoccupation;
}

export class CreerFicheOrientationUseCase {
  constructor(private readonly repo: IOrientationRepository) {}

  async execute(cmd: CreerFicheCommande): Promise<FicheOrientation> {
    const existante = await this.repo.findFicheByStudentAndYear(cmd.studentId, cmd.academicYearId);
    if (existante) {
      throw new Error('Une fiche d\'orientation existe déjà pour cet élève cette année scolaire');
    }
    return this.repo.createFiche({
      studentId:      cmd.studentId,
      schoolId:       cmd.schoolId,
      academicYearId: cmd.academicYearId,
      conseillerId:   cmd.conseillerId,
      mainConcern:    cmd.mainConcern,
    });
  }
}
