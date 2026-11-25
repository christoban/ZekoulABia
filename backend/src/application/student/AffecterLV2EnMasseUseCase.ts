import type { StudentAffectationRepository } from '@domain/ports/repositories/StudentAffectationRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { StudentGroupSetRepository } from '@domain/ports/repositories/StudentGroupSetRepository';
import type { StudentGroupRepository } from '@domain/ports/repositories/StudentGroupRepository';
import type { StudentGroupMembershipRepository } from '@domain/ports/repositories/StudentGroupMembershipRepository';
import { synchroniserAppartenanceLV2 } from '@application/studentGroup/syncGroupMembership';

export interface AffecterLV2EnMasseCommande {
  studentUserIds: string[];
  schoolId: string;
  lv2SubjectId: string | null;
}

export interface AffecterLV2EnMasseResultat {
  modifies: number;
}

export class AffecterLV2EnMasseUseCase {
  constructor(
    private readonly affectationRepository: StudentAffectationRepository,
    private readonly anneeRepository: AnneeAcademiqueRepository,
    private readonly groupSetRepository: StudentGroupSetRepository,
    private readonly groupRepository: StudentGroupRepository,
    private readonly membershipRepository: StudentGroupMembershipRepository,
  ) {}

  async execute(cmd: AffecterLV2EnMasseCommande): Promise<AffecterLV2EnMasseResultat> {
    if (cmd.studentUserIds.length === 0) return { modifies: 0 };

    if (cmd.lv2SubjectId !== null) {
      const subject = await this.affectationRepository.trouverMatiere(cmd.lv2SubjectId, cmd.schoolId);
      if (!subject) throw new Error('Matière LV2 introuvable dans cet établissement');
    }

    // Vérifier que tous les élèves appartiennent à cette école
    const profiles = await this.affectationRepository.listerProfilsParUserIds(cmd.studentUserIds, cmd.schoolId);

    if (profiles.length === 0) return { modifies: 0 };

    const profileIds = profiles.map((p) => p.id);
    const result = await this.affectationRepository.mettreAJourLV2EnMasse(profileIds, cmd.lv2SubjectId);

    const syncRepos = { anneeRepository: this.anneeRepository, groupSetRepository: this.groupSetRepository, groupRepository: this.groupRepository, membershipRepository: this.membershipRepository };
    for (const profileId of profileIds) {
      await synchroniserAppartenanceLV2(syncRepos, { schoolId: cmd.schoolId, studentProfileId: profileId, lv2SubjectId: cmd.lv2SubjectId });
    }

    return { modifies: result };
  }
}
