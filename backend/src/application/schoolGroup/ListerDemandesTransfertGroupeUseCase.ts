/**
 * APPLICATION LAYER — Liste des demandes de transfert du groupe (toutes, tous statuts),
 * vue du Fondateur de Groupe.
 */
import type { GroupTransferRepository } from '@domain/ports/repositories/GroupTransferRepository';
import type { GroupeScolaireQueryRepository } from '@domain/ports/repositories/GroupeScolaireQueryRepository';

export class ListerDemandesTransfertGroupeUseCase {
  constructor(
    private readonly transfertRepository: GroupTransferRepository,
    private readonly queryRepository: GroupeScolaireQueryRepository,
  ) {}

  async execute(groupId: string) {
    const demandes = await this.transfertRepository.listerParGroupe(groupId);

    const schoolIds = Array.from(new Set(demandes.flatMap((d) => [d.sourceSchoolId, d.targetSchoolId])));
    const userIds = demandes.map((d) => d.sourceUserId);

    const [schools, users] = await Promise.all([
      this.queryRepository.listerNomsEcoles(schoolIds),
      this.queryRepository.listerNomsUsers(userIds),
    ]);
    const schoolNameById = new Map(schools.map((s) => [s.id, s.name]));
    const userNameById = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

    return demandes.map((d) => ({
      ...d,
      sourceSchoolName: schoolNameById.get(d.sourceSchoolId) ?? '—',
      targetSchoolName: schoolNameById.get(d.targetSchoolId) ?? '—',
      sourceUserName: userNameById.get(d.sourceUserId) ?? '—',
    }));
  }
}
