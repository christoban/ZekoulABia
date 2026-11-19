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

