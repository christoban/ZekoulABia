import type { MessagerieRepository } from '@domain/ports/repositories/MessagerieRepository';

interface ClasseInfo { id: string; name: string; schoolId: string }

/**
 * Initialise les canaux de messagerie (CLASS_CHANNEL + PARENT_CHANNEL) pour toutes les classes
 * d'un établissement qui n'en ont pas encore.
 *
 * Idempotent : `creerCanalClasse` / `creerCanalParents` vérifient l'existence avant de créer.
 * À exécuter une fois après une migration de données, ou via un endpoint admin.
 */
export class InitialiserCanauxManquantsUseCase {
  constructor(
    private readonly messagerieRepository: MessagerieRepository,
    private readonly listerClasses: (schoolId: string) => Promise<ClasseInfo[]>,
  ) {}

  async execute(schoolId: string): Promise<{ created: number; skipped: number }> {
    const classes = await this.listerClasses(schoolId);
    let created = 0;
    let skipped = 0;

    for (const classe of classes) {
      try {
        // creerCanalClasse/creerCanalParents sont déjà idempotents (findFirst avant create)
        await this.messagerieRepository.creerCanalClasse(classe.schoolId, classe.id, classe.name);
        await this.messagerieRepository.creerCanalParents(classe.schoolId, classe.id, classe.name);
        created++;
      } catch {
        skipped++;
      }
    }

    return { created: created * 2, skipped };
  }
}
