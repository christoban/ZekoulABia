/**
 * DOMAIN LAYER — Port Service Token QR de salle (V2.11)
 *
 * Génère et vérifie un token signé horodaté pour le pointage par QR. Le domaine ne connaît pas
 * le mécanisme de signature (JWT/HMAC) — c'est un détail d'infrastructure — il ne dépend que de
 * cette interface.
 */
export interface QrTokenService {
  /** Génère un token QR signé pour une salle, valide `ttlSeconds`. */
  genererTokenSalle(roomId: string, schoolId: string, ttlSeconds: number): string;

  /** Vérifie la signature + expiration + type d'un token QR. */
  verifierToken(token: string): QrTokenVerification;
}

export type QrTokenVerification =
  | { ok: true; payload: { roomId: string; schoolId: string; tokenType: 'ROOM_QR' } }
  | { ok: false; raison: 'SIGNATURE_INVALIDE' | 'EXPIRED' | 'TYPE_INVALIDE' };
