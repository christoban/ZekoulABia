import type { TokenService, PayloadToken, TokensGeneres } from '@domain/ports/services/TokenService';

export class FakeTokenService implements TokenService {
  private dernierPayload: PayloadToken | null = null;

  genererTokens(payload: PayloadToken): TokensGeneres {
    this.dernierPayload = payload;
    return {
      accessToken: `fake-access-${payload.userId}`,
      refreshToken: `fake-refresh-${payload.userId}`,
    };
  }

  verifierAccessToken(token: string): PayloadToken {
    const userId = token.replace('fake-access-', '');
    return {
      userId,
      schoolId: 'school-test',
      role: 'TEACHER',
      permissions: [],
      tokenType: 'access',
    };
  }

  verifierRefreshToken(token: string): PayloadToken {
    const userId = token.replace('fake-refresh-', '');
    return {
      userId,
      schoolId: 'school-test',
      role: 'TEACHER',
      permissions: [],
      tokenType: 'refresh',
      refreshTokenVersion: 0,
    };
  }

  getDernierPayload() { return this.dernierPayload; }
}
