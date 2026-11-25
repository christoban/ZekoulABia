/**
 * APPLICATION LAYER — Demandes de transfert ENTRANTES en attente pour une école (côté Admin
 * de l'école CIBLE). Sert aussi à déterminer la visibilité de l'entrée sidebar (même principe
 * de gating que LV2/concours/PEBS — visible seulement s'il y a une demande en attente).
 */
import type { GroupTransferRepository } from '@domain/ports/repositories/GroupTransferRepository';
import type { GroupeScolaireQueryRepository } from '@domain/ports/repositories/GroupeScolaireQueryRepository';

export class ListerDemandesTransfertEntrantesUseCase {
  constructor(
    private readonly transfertRepository: GroupTransferRepository,
    private readonly queryRepository: GroupeScolaireQueryRepository,
  ) {}

  async execute(targetSchoolId: string) {
    const demandes = await this.transfertRepository.listerEntrantesEnAttente(targetSchoolId);

    const sourceSchoolIds = Array.from(new Set(demandes.map((d) => d.sourceSchoolId)));
    const userIds = demandes.map((d) => d.sourceUserId);

    const [schools, users] = await Promise.all([
      this.queryRepository.listerNomsEcoles(sourceSchoolIds),
      this.queryRepository.listerNomsUsers(userIds),
    ]);
    const schoolNameById = new Map(schools.map((s) => [s.id, s.name]));
    const userById = new Map(users.map((u) => [u.id, u]));

    return demandes.map((d) => {
      const user = userById.get(d.sourceUserId);
      return {
        ...d,
        sourceSchoolName: schoolNameById.get(d.sourceSchoolId) ?? '—',
        sourceUserName: user ? `${user.firstName} ${user.lastName}` : '—',
      };
    });
  }
}
