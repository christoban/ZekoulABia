/**
 * APPLICATION LAYER — Use Case : Transférer un élève vers une autre classe
 * Logique extraite de controllers/user.ts → transferStudent handler
 */
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';

export interface TransfererEleveCommande {
  studentId: string;
  fromClasseId: string;
  toClasseId: string;
  schoolId: string;
  demandeurId: string;
}

export class TransfererEleveUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly classeRepository: ClasseRepository,
  ) {}

  async execute(commande: TransfererEleveCommande): Promise<void> {
    if (commande.fromClasseId === commande.toClasseId) {
      throw new Error('La classe source et la classe cible sont identiques');
    }

    // Vérifier que la classe cible appartient à la même école
    const classeDestination = await this.classeRepository.findById(commande.toClasseId);
    if (!classeDestination) {
      throw new Error('Classe de destination introuvable');
    }
    if (classeDestination.schoolId !== commande.schoolId) {
      throw new Error("Accès refusé : la classe de destination n'appartient pas à votre établissement");
    }

    const eleve = await this.userRepository.findById(commande.studentId);
    if (!eleve || !eleve.estEleve()) {
      throw new Error('Élève introuvable');
    }
    if (eleve.schoolId !== commande.schoolId) {
      throw new Error('Accès refusé : élève hors de votre établissement');
    }

    // Transfert + log dans StudentPromotion
    await this.userRepository.transfererEleve({
      studentId: commande.studentId,
      fromClasseId: commande.fromClasseId,
      toClasseId: commande.toClasseId,
      demandeurId: commande.demandeurId,
      schoolId: commande.schoolId,
    });
  }
}
