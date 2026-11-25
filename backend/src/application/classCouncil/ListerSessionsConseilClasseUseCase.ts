import type { ClassCouncilRepository } from '@domain/ports/repositories/ClassCouncilRepository';

export interface ListerSessionsCommande {
  schoolId: string;
  classId?: string;
  academicPeriodId?: string;
}

export class ListerSessionsConseilClasseUseCase {
  constructor(private readonly repo: ClassCouncilRepository) {}

  async execute(commande: ListerSessionsCommande) {
    const sessions = await this.repo.listerSessions(commande.schoolId, {
      classId: commande.classId,
      academicPeriodId: commande.academicPeriodId,
    });
    return { sessions, total: sessions.length };
  }
}
