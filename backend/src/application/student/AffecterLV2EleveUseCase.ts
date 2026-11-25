import type { StudentAffectationRepository } from '@domain/ports/repositories/StudentAffectationRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { StudentGroupSetRepository } from '@domain/ports/repositories/StudentGroupSetRepository';
import type { StudentGroupRepository } from '@domain/ports/repositories/StudentGroupRepository';
import type { StudentGroupMembershipRepository } from '@domain/ports/repositories/StudentGroupMembershipRepository';
import { synchroniserAppartenanceLV2 } from '@application/studentGroup/syncGroupMembership';

export interface AffecterLV2EleveCommande {
  studentUserId: string;
  schoolId: string;
  lv2SubjectId: string | null;
}

export class AffecterLV2EleveUseCase {
  constructor(
    private readonly affectationRepository: StudentAffectationRepository,
    private readonly anneeRepository: AnneeAcademiqueRepository,
    private readonly groupSetRepository: StudentGroupSetRepository,
    private readonly groupRepository: StudentGroupRepository,
    private readonly membershipRepository: StudentGroupMembershipRepository,
  ) {}

  async execute(cmd: AffecterLV2EleveCommande): Promise<void> {
    const profile = await this.affectationRepository.trouverProfilParUserId(cmd.studentUserId, cmd.schoolId);
    if (!profile) throw new Error('Élève introuvable dans cet établissement');

    if (cmd.lv2SubjectId !== null) {
      const subject = await this.affectationRepository.trouverMatiere(cmd.lv2SubjectId, cmd.schoolId);
      if (!subject) throw new Error('Matière LV2 introuvable dans cet établissement');
    }

    await this.affectationRepository.mettreAJourLV2(profile.id, cmd.lv2SubjectId);

    await synchroniserAppartenanceLV2(
      { anneeRepository: this.anneeRepository, groupSetRepository: this.groupSetRepository, groupRepository: this.groupRepository, membershipRepository: this.membershipRepository },
      { schoolId: cmd.schoolId, studentProfileId: profile.id, lv2SubjectId: cmd.lv2SubjectId }
    );
  }
}
