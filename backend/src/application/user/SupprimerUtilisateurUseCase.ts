/**
 * APPLICATION LAYER — Use Case : Supprimer un utilisateur
 * Logique extraite de controllers/user.ts → deleteUser handler
 * Suppression douce (Couche 1, PLAN_IMPLEMENTATION_BACKUP.md) — pose deletedAt sur la ligne User,
 * ne touche plus à ses données liées (notes/présences/bulletins/liens parent-élève restent
 * intacts, invisibles seulement via le filtre automatique deletedAt:null sur l'utilisateur).
 */
import type { UserRepository } from '@domain/ports/repositories/UserRepository';

export class SupprimerUtilisateurUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(params: {
    userId: string;
    schoolId: string;
    demandeurRole: string;
    demandeurId: string;
  }): Promise<void> {
    if (params.demandeurRole !== 'ADMIN') {
      throw new Error('Accès refusé : seul un Admin peut supprimer un utilisateur');
    }

    const user = await this.userRepository.findById(params.userId);
    if (!user) throw new Error('Utilisateur introuvable');

    if (user.schoolId !== params.schoolId) {
      throw new Error('Accès refusé : utilisateur hors de votre établissement');
    }

    await this.userRepository.supprimerAvecCascade(params.userId, params.demandeurId);
  }
}
