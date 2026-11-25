/**
 * INFRASTRUCTURE LAYER — Implémentation du Port QrTokenService (V2.11)
 *
 * Token signé (JWT HMAC) court : { roomId, schoolId, ttl } — vérifié au scan : signature +
 * expiration + croisement avec le TimetableSlot courant (salle + enseignant + plage horaire).
 * Un roomId brut serait scannable depuis une simple photo partagée ; le token signé horodaté
 * limite la fenêtre d'exploitation à quelques secondes/minutes.
 */
import jwt, { type JwtPayload } from 'jsonwebtoken';
import type { QrTokenService, QrTokenVerification } from '@domain/ports/services/QrTokenService';

const SECRET = process.env.JWT_SECRET || 'zekoulabia-secret-change-in-production';

export class JwtQrTokenService implements QrTokenService {
  genererTokenSalle(roomId: string, schoolId: string, ttlSeconds: number): string {
    return jwt.sign(
      { roomId, schoolId, tokenType: 'ROOM_QR' },
      SECRET,
      { algorithm: 'HS512', expiresIn: `${ttlSeconds}s` },
    );
  }

  verifierToken(token: string): QrTokenVerification {
    try {
      const decoded = jwt.verify(token, SECRET, { algorithms: ['HS512'] }) as JwtPayload & { roomId?: string; schoolId?: string; tokenType?: string };
      if (decoded.tokenType !== 'ROOM_QR' || typeof decoded.roomId !== 'string' || typeof decoded.schoolId !== 'string') {
        return { ok: false, raison: 'TYPE_INVALIDE' };
      }
      return { ok: true, payload: { roomId: decoded.roomId, schoolId: decoded.schoolId, tokenType: 'ROOM_QR' } };
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) return { ok: false, raison: 'EXPIRED' };
      return { ok: false, raison: 'SIGNATURE_INVALIDE' };
    }
  }
}