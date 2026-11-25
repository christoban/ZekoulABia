import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';

export interface Bloqueur {
  type: 'UNVALIDATED_GRADES' | 'MISSING_REPORT_CARDS' | 'MISSING_COUNCIL_SESSIONS';
  message: string;
  details?: { classeId?: string; classeNom?: string; periodeNom?: string }[];
}

export interface VerifierPrerequisResultat {
  peutCloturer: boolean;
  bloqueurs: Bloqueur[];
}

export class VerifierPrerequisClotureUseCase {
  constructor(private readonly anneeRepository: AnneeAcademiqueRepository) {}

  async execute(academicYearId: string): Promise<VerifierPrerequisResultat> {
    const bloqueurs: Bloqueur[] = [];

    const notesNonValidees = await this.anneeRepository.countNotesNonValidees(academicYearId);
    if (notesNonValidees > 0) {
      bloqueurs.push({
        type: 'UNVALIDATED_GRADES',
        message: `${notesNonValidees} note(s) non validée(s) — toutes les notes doivent être LOCKED avant la clôture`,
      });
    }

    const classesSansBulletins = await this.anneeRepository.getClassesAvecBulletinsManquants(
      academicYearId
    );
    if (classesSansBulletins.length > 0) {
      bloqueurs.push({
        type: 'MISSING_REPORT_CARDS',
        message: `${classesSansBulletins.length} combinaison(s) classe/période sans bulletins générés`,
        details: classesSansBulletins,
      });
    }

    const classesSansConseil = await this.anneeRepository.getClassesSansConseilVerrouille(
      academicYearId
    );
    if (classesSansConseil.length > 0) {
      bloqueurs.push({
        type: 'MISSING_COUNCIL_SESSIONS',
        message: `${classesSansConseil.length} classe(s) sans Conseil de Classe verrouillé pour la dernière période`,
        details: classesSansConseil,
      });
    }

    return {
      peutCloturer: bloqueurs.length === 0,
      bloqueurs,
    };
  }
}
