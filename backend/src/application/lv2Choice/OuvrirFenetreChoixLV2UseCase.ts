import type { OuvrirFenetreCommande } from './types';
import type { Lv2ChoiceRepository } from '@domain/ports/repositories/Lv2ChoiceRepository';

interface EleveConcerne { studentUserId: string; studentName: string }

export class OuvrirFenetreChoixLV2UseCase {
  constructor(private readonly lv2ChoiceRepository: Lv2ChoiceRepository) {}

  async execute(cmd: OuvrirFenetreCommande): Promise<{ windowId: string; level: string; closeDate: Date; eleves: EleveConcerne[] }> {
    // Vérifier qu'aucune fenêtre OPEN n'existe déjà pour ce niveau + année
    const existing = await this.lv2ChoiceRepository.trouverFenetreOuverteParNiveau(cmd.schoolId, cmd.level, cmd.academicYearId);
    if (existing) {
      throw new Error(`Une fenêtre de choix LV2 est déjà ouverte pour le niveau ${cmd.level}`);
    }

    const window = await this.lv2ChoiceRepository.creerFenetre({
      schoolId: cmd.schoolId,
      level: cmd.level,
      academicYearId: cmd.academicYearId,
      openDate: cmd.openDate,
      closeDate: cmd.closeDate,
    });

    // Élèves du niveau concerné — pour notification (SMS aux parents).
    const eleves = await this.lv2ChoiceRepository.listerElevesDuNiveau(cmd.schoolId, cmd.level);

    return {
      windowId: window.id,
      level: cmd.level,
      closeDate: cmd.closeDate,
      eleves,
    };
  }
}
