import type { StudentAffectationRepository } from '@domain/ports/repositories/StudentAffectationRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { StudentGroupSetRepository } from '@domain/ports/repositories/StudentGroupSetRepository';
import type { StudentGroupRepository } from '@domain/ports/repositories/StudentGroupRepository';
import type { StudentGroupMembershipRepository } from '@domain/ports/repositories/StudentGroupMembershipRepository';
import { synchroniserAppartenanceProgramme } from '@application/studentGroup/syncGroupMembership';
import type { PebsFiliere } from '@domain/types/enums';

export interface AffecterPEBSEnMasseCommande {
  studentUserIds: string[];
  schoolId: string;
  pebsFiliere: PebsFiliere | null;
}

export interface AffecterPEBSEnMasseResultat {
  modifies: number;
}

export class AffecterPEBSEnMasseUseCase {
  constructor(
    private readonly affectationRepository: StudentAffectationRepository,
    private readonly anneeRepository: AnneeAcademiqueRepository,
    private readonly groupSetRepository: StudentGroupSetRepository,
    private readonly groupRepository: StudentGroupRepository,
    private readonly membershipRepository: StudentGroupMembershipRepository,
  ) {}

  async execute(cmd: AffecterPEBSEnMasseCommande): Promise<AffecterPEBSEnMasseResultat> {
    if (cmd.studentUserIds.length === 0) return { modifies: 0 };

    if (cmd.pebsFiliere !== null && !['FR_PEBS', 'EN_PEBS'].includes(cmd.pebsFiliere)) {
      throw new Error('Valeur pebsFiliere invalide. Utilisez FR_PEBS, EN_PEBS ou null');
    }

    const profiles = await this.affectationRepository.listerProfilsParUserIds(cmd.studentUserIds, cmd.schoolId);

    if (profiles.length === 0) return { modifies: 0 };

    const profileIds = profiles.map((p) => p.id);
    const result = await this.affectationRepository.mettreAJourPEBSEnMasse(profileIds, cmd.pebsFiliere);

    const syncRepos = { anneeRepository: this.anneeRepository, groupSetRepository: this.groupSetRepository, groupRepository: this.groupRepository, membershipRepository: this.membershipRepository };
    for (const profileId of profileIds) {
      await synchroniserAppartenanceProgramme(syncRepos, { schoolId: cmd.schoolId, studentProfileId: profileId, pebsFiliere: cmd.pebsFiliere });
    }

    return { modifies: result };
  }
}
