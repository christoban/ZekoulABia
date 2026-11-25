import { EmploiDuTemps } from '@domain/entities/EmploiDuTemps';
import type { TimetableRepository } from '@domain/ports/repositories/TimetableRepository';

export interface CreerEmploiDuTempsCommande {
  schoolId: string;
  classId: string;
  academicYearId: string;
}

export interface CreerEmploiDuTempsResultat {
  timetableId: string;
  estNouveauCree: boolean;
}

export class CreerEmploiDuTempsUseCase {
  constructor(private readonly timetableRepository: TimetableRepository) {}

  async execute(commande: CreerEmploiDuTempsCommande): Promise<CreerEmploiDuTempsResultat> {
    const existant = await this.timetableRepository.findByClasse(
      commande.classId,
      commande.academicYearId
    );
    if (existant) {
      return { timetableId: existant.id, estNouveauCree: false };
    }

    const emploiDuTemps = EmploiDuTemps.create({
      schoolId: commande.schoolId,
      classId: commande.classId,
      academicYearId: commande.academicYearId,
      generatedByAI: false,
    });

    await this.timetableRepository.save(emploiDuTemps);
    return { timetableId: emploiDuTemps.id, estNouveauCree: true };
  }
}
