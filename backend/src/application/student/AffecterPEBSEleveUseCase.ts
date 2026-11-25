import type { StudentAffectationRepository } from '@domain/ports/repositories/StudentAffectationRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { StudentGroupSetRepository } from '@domain/ports/repositories/StudentGroupSetRepository';
import type { StudentGroupRepository } from '@domain/ports/repositories/StudentGroupRepository';
import type { StudentGroupMembershipRepository } from '@domain/ports/repositories/StudentGroupMembershipRepository';
import { synchroniserAppartenanceProgramme } from '@application/studentGroup/syncGroupMembership';
import type { PebsFiliere } from '@domain/types/enums';

export interface AffecterPEBSEleveCommande {
  studentUserId: string;
  schoolId: string;
  pebsFiliere: PebsFiliere | null;
}

export class AffecterPEBSEleveUseCase {
  constructor(
    private readonly affectationRepository: StudentAffectationRepository,
    private readonly anneeRepository: AnneeAcademiqueRepository,
    private readonly groupSetRepository: StudentGroupSetRepository,
    private readonly groupRepository: StudentGroupRepository,
    private readonly membershipRepository: StudentGroupMembershipRepository,
  ) {}

  async execute(cmd: AffecterPEBSEleveCommande): Promise<void> {
    const profile = await this.affectationRepository.trouverProfilParUserId(cmd.studentUserId, cmd.schoolId);
    if (!profile) throw new Error('Élève introuvable dans cet établissement');

    if (cmd.pebsFiliere !== null && !['FR_PEBS', 'EN_PEBS'].includes(cmd.pebsFiliere)) {
      throw new Error('Valeur pebsFiliere invalide. Utilisez FR_PEBS, EN_PEBS ou null');
    }

    await this.affectationRepository.mettreAJourPEBS(profile.id, cmd.pebsFiliere);

    await synchroniserAppartenanceProgramme(
      { anneeRepository: this.anneeRepository, groupSetRepository: this.groupSetRepository, groupRepository: this.groupRepository, membershipRepository: this.membershipRepository },
      { schoolId: cmd.schoolId, studentProfileId: profile.id, pebsFiliere: cmd.pebsFiliere }
    );
  }
}
