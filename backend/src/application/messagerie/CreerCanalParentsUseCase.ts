import type { MessagerieRepository } from '@domain/ports/repositories/MessagerieRepository';

export interface CreerCanalParentsCommande {
  schoolId: string;
  classId: string;
  className: string;
}

/** Même principe que CreerCanalClasseUseCase, pour le PARENT_CHANNEL. */
export class CreerCanalParentsUseCase {
  constructor(private readonly messagerieRepository: MessagerieRepository) {}

  async execute(cmd: CreerCanalParentsCommande) {
    return this.messagerieRepository.creerCanalParents(cmd.schoolId, cmd.classId, cmd.className);
  }
}
