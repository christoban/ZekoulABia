import type { SoumettreChoixCommande } from './types';
import type { Lv2ChoiceRepository } from '@domain/ports/repositories/Lv2ChoiceRepository';
import type { StudentAffectationRepository } from '@domain/ports/repositories/StudentAffectationRepository';

export class SoumettreChoixLV2EleveUseCase {
  constructor(
    private readonly lv2ChoiceRepository: Lv2ChoiceRepository,
    private readonly affectationRepository: StudentAffectationRepository,
  ) {}

  async execute(cmd: SoumettreChoixCommande): Promise<void> {
    // Récupérer le profil élève avec sa classe actuelle
    const profile = await this.affectationRepository.trouverProfilParUserIdAvecClasse(cmd.studentUserId, cmd.schoolId);
    if (!profile) throw new Error('Profil élève introuvable');

    // Trouver la fenêtre ouverte pour le niveau de l'élève
    const classeId = profile.classId;
    if (!classeId) throw new Error('Classe introuvable');

    const niveau = await this.niveauDeClasse(classeId);
    if (!niveau) throw new Error('Classe introuvable');

    const window = await this.lv2ChoiceRepository.trouverFenetreOuverteActive(cmd.schoolId, niveau);
    if (!window) throw new Error('Aucune fenêtre de choix LV2 ouverte pour votre niveau');

    // Vérifier que la matière existe et est bien une LV2 dans cette école
    const subject = await this.affectationRepository.trouverMatiere(cmd.chosenSubjectId, cmd.schoolId);
    if (!subject) throw new Error('Matière introuvable');

    // Upsert : si déjà soumis, mettre à jour le choix
    await this.lv2ChoiceRepository.upsertSoumission({
      windowId: window.id,
      studentProfileId: profile.id,
      chosenSubjectId: cmd.chosenSubjectId,
      submissionMethod: 'STUDENT_DIRECT',
    });
  }

  private async niveauDeClasse(classId: string): Promise<string | null> {
    const classe = await this.affectationRepository.trouverClasseNiveau(classId);
    return classe ?? null;
  }
}
