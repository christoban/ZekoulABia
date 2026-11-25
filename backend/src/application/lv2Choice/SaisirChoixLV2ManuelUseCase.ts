import type { SaisirChoixManuelCommande } from './types';
import type { Lv2ChoiceRepository } from '@domain/ports/repositories/Lv2ChoiceRepository';
import type { StudentAffectationRepository } from '@domain/ports/repositories/StudentAffectationRepository';

export class SaisirChoixLV2ManuelUseCase {
  constructor(
    private readonly lv2ChoiceRepository: Lv2ChoiceRepository,
    private readonly affectationRepository: StudentAffectationRepository,
  ) {}

  async execute(cmd: SaisirChoixManuelCommande): Promise<void> {
    // Vérifier que la fenêtre existe et est ouverte
    const window = await this.lv2ChoiceRepository.trouverFenetre(cmd.windowId);
    if (!window) throw new Error('Fenêtre de choix introuvable');
    if (window.status !== 'OPEN') throw new Error('La fenêtre de choix est clôturée');
    if (window.schoolId !== cmd.schoolId) throw new Error('Accès refusé');

    // Vérifier que l'élève existe et appartient à l'école
    const profile = await this.affectationRepository.trouverProfilParId(cmd.studentProfileId, cmd.schoolId);
    if (!profile) {
      throw new Error('Élève introuvable');
    }

    // Vérifier que la matière existe
    const subject = await this.affectationRepository.trouverMatiere(cmd.chosenSubjectId, cmd.schoolId);
    if (!subject) throw new Error('Matière introuvable');

    // Upsert avec ADMIN_MANUAL
    await this.lv2ChoiceRepository.upsertSoumission({
      windowId: cmd.windowId,
      studentProfileId: cmd.studentProfileId,
      chosenSubjectId: cmd.chosenSubjectId,
      submissionMethod: 'ADMIN_MANUAL',
      submittedByUserId: cmd.submittedByUserId,
    });
  }
}
