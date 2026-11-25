/**
 * APPLICATION LAYER — Use Case : Créer une session de Conseil de Classe
 *
 * Loi 5 : bloqué si une note n'est pas LOCKED.
 * Composition légale obligatoire (Art. 29 et 30 MINESEC).
 */
import type { NoteRepository } from '@domain/ports/repositories/NoteRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import { ConseilBloqueError } from '@domain/errors/ConseilBloqueError';

export interface TenirConseilCommande {
  schoolId: string;
  classId: string;
  academicPeriodId: string;
  presidedById: string; // Admin ou Censeur
}

export interface TenirConseilResultat {
  sessionId: string;
  classeNom: string;
  message: string;
}

// Ce type représente les données brutes d'une session
// (sera persisté par l'adapter Prisma)
export interface ConseilSession {
  id: string;
  schoolId: string;
  classId: string;
  academicPeriodId: string;
  presidedById: string;
  statut: 'OPEN';
  createdAt: Date;
}

export class TenirConseilClasseUseCase {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly classeRepository: ClasseRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(commande: TenirConseilCommande): Promise<TenirConseilResultat> {
    // 1. Vérifier permission du président
    const president = await this.userRepository.findById(commande.presidedById);
    if (!president) throw new Error('Président de séance introuvable');
    if (!president.estAdmin() && !president.aPermission('VALIDATE_GRADES')) {
      throw new Error('Seul un Admin ou Censeur peut présider un Conseil de Classe');
    }

    // 2. Charger la classe
    const classe = await this.classeRepository.findById(commande.classId);
    if (!classe) throw new Error(`Classe introuvable : ${commande.classId}`);

    // 3. Loi 5 — vérifier toutes notes LOCKED
    const notesNonValidees = await this.noteRepository.findNotesNonValideesParClasse(
      commande.classId,
      commande.academicPeriodId
    );

    if (notesNonValidees.length > 0) {
      throw new ConseilBloqueError(classe.nomComplet, notesNonValidees);
    }

    // 4. Créer la session
    const session: ConseilSession = {
      id: crypto.randomUUID(),
      schoolId: commande.schoolId,
      classId: commande.classId,
      academicPeriodId: commande.academicPeriodId,
      presidedById: commande.presidedById,
      statut: 'OPEN',
      createdAt: new Date(),
    };

    return {
      sessionId: session.id,
      classeNom: classe.nomComplet,
      message: `Conseil de Classe ouvert pour "${classe.nomComplet}" — prêt pour les décisions`,
    };
  }
}