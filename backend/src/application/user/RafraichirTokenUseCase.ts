/**
 * APPLICATION LAYER — Use Case : Rafraîchir les tokens
 * Logique extraite de controllers/user.ts → refreshToken handler
 * Vérifie refreshTokenVersion pour la révocation de session.
 */
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { TokenService, PayloadToken } from '@domain/ports/services/TokenService';

export interface RafraichirTokenResultat {
  accessToken: string;
  refreshToken: string;
}

export class RafraichirTokenUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly schoolRepository: SchoolRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(refreshTokenPayload: PayloadToken & { refreshTokenVersion: number }): Promise<RafraichirTokenResultat> {
    // 1. Charger user avec refreshTokenVersion actuelle
    const result = await this.userRepository.findByIdWithRefreshVersion(
      refreshTokenPayload.userId
    );
    if (!result || !result.user.isActive) {
      throw new Error('Utilisateur introuvable ou inactif');
    }

    if (result.user.accessMode && result.user.accessMode !== 'FULL_ACCESS') {
      throw new Error("Ce compte ne dispose pas d'un accès de connexion direct.");
    }

    // 2. Vérifier que la version du token correspond (mécanisme de révocation de session)
    if (result.refreshTokenVersion !== refreshTokenPayload.refreshTokenVersion) {
      throw new Error('Session expirée — veuillez vous reconnecter');
    }

    // 3. Vérifier que l'école est toujours active
    const school = await this.schoolRepository.findById(result.user.schoolId);
    if (!school?.estActive()) {
      throw new Error("Cet établissement n'est plus actif");
    }

    // 4. Ré-émettre les tokens avec la même version — pas de rotation
    // La rotation (invaliderTokens) est réservée au logout et au changement de mot de passe.
    // Une rotation à chaque refresh provoque des déconnexions sur plusieurs onglets simultanés.
    return this.tokenService.genererTokens({
      userId: result.user.id,
      schoolId: result.user.schoolId,
      role: result.user.role,
      permissions: result.user.staffPermissions,
      tokenType: 'access',
      refreshTokenVersion: result.refreshTokenVersion,
    });
  }
}
