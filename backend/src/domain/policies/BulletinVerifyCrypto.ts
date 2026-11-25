import { createHash } from 'node:crypto';
import type { StudentBulletinSnapshot } from '@domain/types/bulletinSnapshot';

function sortKeysDeep(val: unknown): unknown {
  if (val === null || typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.map(sortKeysDeep);
  const obj = val as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortKeysDeep(obj[key]);
  }
  return sorted;
}

export function canonicalHashSnapshot(snapshot: StudentBulletinSnapshot): string {
  return createHash('sha256').update(JSON.stringify(sortKeysDeep(snapshot))).digest('hex');
}

/**
 * Code court public (ex. ZK-8F2A-19C4) dérivé unidirectionnellement du verifyToken ou ID.
 * Ne divulgue jamais le jeton cryptographique complet sur le document imprimé.
 */
export function deriveShortVerifyCode(tokenOrId: string): string {
  const digest = createHash('sha256').update(tokenOrId).digest('hex').slice(0, 8).toUpperCase();
  return `ZK-${digest.slice(0, 4)}-${digest.slice(4, 8)}`;
}

/** Vérifie qu'un jeton de QR code possède au moins 128 bits d'entropie hexadécimale (32+ chars hex). */
export function isLongVerifyToken(token: string | null | undefined): boolean {
  if (!token) return false;
  return /^[0-9a-f]{32,128}$/i.test(token.trim());
}

/** Reconnaît le format court imprimé lisible (ZK-XXXX-XXXX) sans le confondre avec le jeton long. */
export function isShortVerifyCode(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^ZK-[0-9A-F]{4}-[0-9A-F]{4}$/i.test(value.trim());
}

/** Construit l'URL officielle encodée dans le QR code : uniquement basée sur le jeton long cryptographique. */
export function buildLongTokenVerifyUrl(baseUrl: string, verifyToken: string): string {
  if (!isLongVerifyToken(verifyToken)) {
    throw new Error(
      `URL QR refusée : verifyToken doit être un jeton cryptographique >= 128 bits (reçu "${verifyToken}").`,
    );
  }
  const cleanBase = baseUrl.trim().replace(/\/+$/, '');
  return `${cleanBase}/verify/${verifyToken.trim()}`;
}

/**
 * Masque l'identité complète sur la page publique /verify : "KAMGA Jean-Baptiste" -> "KAMGA J."
 */
export function maskStudentPublicName(firstName: string | null | undefined, lastName: string | null | undefined): string {
  const cleanLast = (lastName ?? '').trim().toUpperCase();
  const cleanFirst = (firstName ?? '').trim();
  const initial = cleanFirst.length > 0 ? `${cleanFirst[0]!.toUpperCase()}.` : '';
  if (cleanLast && initial) return `${cleanLast} ${initial}`;
  if (cleanLast) return cleanLast;
  if (initial) return initial;
  return 'Élève';
}

