import type { SuivreFenetreCommande } from './types';
import type { Lv2ChoiceRepository } from '@domain/ports/repositories/Lv2ChoiceRepository';

interface EleveSuivi {
  studentProfileId: string;
  userId: string;
  firstName: string;
  lastName: string;
  className: string;
  hasSubmitted: boolean;
  submissionMethod?: string;
  chosenSubjectName?: string;
}

export class SuivreFenetreChoixLV2UseCase {
  constructor(private readonly lv2ChoiceRepository: Lv2ChoiceRepository) {}

  async execute(cmd: SuivreFenetreCommande): Promise<{
    window: { id: string; level: string; status: string; openDate: Date; closeDate: Date };
    total: number;
    submitted: number;
    pending: number;
    students: EleveSuivi[];
  }> {
    return this.lv2ChoiceRepository.suivreFenetre(cmd.windowId, cmd.schoolId);
  }
}
