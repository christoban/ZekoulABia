/**
 * INFRASTRUCTURE LAYER — Adapter JWT Token Service
 * Implémente TokenService en wrappant la logique JWT existante.
 */
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { TokenService, PayloadToken, TokensGeneres } from '@domain/ports/services/TokenService';

// Type exact attendu par jwt.sign({ expiresIn }) — @types/jsonwebtoken 9.0.10 l'a resserré à un
// format de durée précis (ex. "7d"), un `string` générique ne suffit plus. Repris depuis la
// bibliothèque elle-même plutôt qu'un `as any` : si le format accepté change encore, l'erreur de
// type réapparaît ici plutôt que de se taire.
type Duree = NonNullable<SignOptions['expiresIn']>;

const JWT_SECRET = process.env.JWT_SECRET || 'zekoulabia-secret-change-in-production';
const ACCESS_EXPIRY: Duree = process.env.NODE_ENV === 'development' ? '7d' : '12h';

/**
 * Durée du refresh token graduée par sensibilité du rôle (Plan offline-first V1, §2) : un
 * appareil Admin/Staff perdu ou volé expose une surface d'action bien plus large (RBAC quasi
 * complet, actions destructives) qu'un appareil Enseignant/Élève/Parent — d'où une fenêtre de
 * session offline plus courte pour les deux premiers. Passé cette durée sans connexion, la
 * prochaine ouverture en ligne redemande un login complet.
 */
const REFRESH_EXPIRY_PAR_ROLE: Record<string, Duree> = {
  ADMIN: '7d',
  STAFF: '7d',
  TEACHER: '30d',
  STUDENT: '30d',
  PARENT: '30d',
};
const REFRESH_EXPIRY_DEFAUT: Duree = '7d'; // repli prudent si un rôle futur n'est pas dans la table ci-dessus

function dureeRefreshPourRole(role: string): Duree {
  return REFRESH_EXPIRY_PAR_ROLE[role.toUpperCase()] ?? REFRESH_EXPIRY_DEFAUT;
}

export class JwtTokenService implements TokenService {
  genererTokens(payload: PayloadToken): TokensGeneres {
    const accessToken = jwt.sign(
      {
        userId: payload.userId,
        schoolId: payload.schoolId,
        role: payload.role,
        permissions: payload.permissions,
        mustChangePassword: payload.mustChangePassword ?? false,
        tokenType: 'access',
        refreshTokenVersion: payload.refreshTokenVersion ?? 0,
      },
      JWT_SECRET,
      { algorithm: 'HS512', expiresIn: ACCESS_EXPIRY }
    );

    const refreshToken = jwt.sign(
      {
        userId: payload.userId,
        schoolId: payload.schoolId,
        role: payload.role,
        permissions: [],
        mustChangePassword: payload.mustChangePassword ?? false,
        tokenType: 'refresh',
        refreshTokenVersion: payload.refreshTokenVersion ?? 0,
      },
      JWT_SECRET,
      { algorithm: 'HS512', expiresIn: dureeRefreshPourRole(payload.role) }
    );

    return { accessToken, refreshToken };
  }

  verifierAccessToken(token: string): PayloadToken {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS512'] }) as unknown as PayloadToken;
    if (decoded.tokenType !== 'access') {
      throw new Error('Token invalide : type incorrect');
    }
    return decoded;
  }

  verifierRefreshToken(token: string): PayloadToken {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS512'] }) as unknown as PayloadToken;
    if (decoded.tokenType !== 'refresh') {
      throw new Error('Token invalide : type incorrect');
    }
    return decoded;
  }
}
