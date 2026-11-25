import type { MessagerieRepository, ContactResult } from '@domain/ports/repositories/MessagerieRepository';

export interface ListerContactsMessagerieCommande {
  schoolId: string;
  appelantId: string;
  appelantRole: string;
  recherche?: string;
}

/**
 * Contacts éligibles pour démarrer une conversation privée — alimente le sélecteur de
 * destinataire de NouveauMessagePrive.tsx.
 *
 * Comportement (matrice de communication) :
 * - STUDENT : aucun contact (pas de DM, canaux seulement).
 * - PARENT : enseignants de ses enfants, PP, staff, admin.
 * - TEACHER : parents/élèves de ses classes, collègues, staff, admin.
 * - ADMIN/STAFF : tout le monde (mais uniquement par recherche textuelle, jamais en liste brute).
 *
 * La recherche textuelle (param `recherche`, min 2 chars) est obligatoire pour tous les rôles.
 * Sans recherche, seul un tableau vide est retourné — pas de liste brute.
 */
export class ListerContactsMessagerieUseCase {
  constructor(private readonly messagerieRepository: MessagerieRepository) {}

  async execute(cmd: ListerContactsMessagerieCommande): Promise<ContactResult[]> {
    const recherche = (cmd.recherche ?? '').trim();

    // Pas de recherche → pas de résultats (fin de la liste brute)
    if (recherche.length < 2) return [];

    return this.messagerieRepository.rechercherContacts({
      schoolId: cmd.schoolId,
      appelantId: cmd.appelantId,
      appelantRole: cmd.appelantRole,
      recherche,
      limite: 20,
    });
  }
}
