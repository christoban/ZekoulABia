/**
 * DOMAIN LAYER — Port Service Token JWT
 * Génération et vérification des tokens d'authentification.
 */
import type { UserRole, StaffPermissionType } from '@domain/types/enums';

export interface PayloadToken {
  userId: string;
  schoolId: string;
  role: UserRole;
  permissions: StaffPermissionType[];
  mustChangePassword?: boolean;
  tokenType: 'access' | 'refresh';
  refreshTokenVersion?: number;
}

export interface TokensGeneres {
  accessToken: string;  // 15 minutes, fixe
  refreshToken: string; // 7 ou 30 jours selon le rôle — voir JwtTokenService
}

export interface TokenService {
  genererTokens(payload: PayloadToken): TokensGeneres;
  verifierAccessToken(token: string): PayloadToken;
  verifierRefreshToken(token: string): PayloadToken;
}
