import type { MessagerieRepository } from '@domain/ports/repositories/MessagerieRepository';

export interface CreerCanalClasseCommande {
  schoolId: string;
  classId: string;
  className: string;
}

/**
 * Crée le CLASS_CHANNEL d'une classe — appelé automatiquement à la création de la classe
 * (hook dans CreerClasseUseCase), jamais manuellement. Idempotent : si le canal existe déjà
 * pour cette classe, le retourne tel quel plutôt que d'en créer un second.
 */
export class CreerCanalClasseUseCase {
  constructor(private readonly messagerieRepository: MessagerieRepository) {}

  async execute(cmd: CreerCanalClasseCommande) {
    return this.messagerieRepository.creerCanalClasse(cmd.schoolId, cmd.classId, cmd.className);
  }
}
