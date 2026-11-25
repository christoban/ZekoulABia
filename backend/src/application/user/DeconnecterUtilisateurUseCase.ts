/**
 * APPLICATION LAYER — Use Case : Déconnecter un utilisateur
 * Incrémente refreshTokenVersion pour invalider toutes les sessions actives.
 */
import type { UserRepository } from '@domain/ports/repositories/UserRepository';

export class DeconnecterUtilisateurUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(userId: string): Promise<void> {
    const result = await this.userRepository.findByIdWithRefreshVersion(userId);
    if (!result) return; // Déjà déconnecté ou inexistant

    result.user.invaliderTokens();
    await this.userRepository.update(result.user);
  }
}
