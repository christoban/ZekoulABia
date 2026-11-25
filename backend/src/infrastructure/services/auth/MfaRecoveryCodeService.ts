import bcrypt from 'bcryptjs';

/** Génère 8 codes de récupération MFA à usage unique (même format que le flux Master). */
export async function genererCodesRecuperation(): Promise<{ formatted: string[]; hashed: string[] }> {
  const rawCodes = Array.from({ length: 8 }, () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  });
  const formatted = rawCodes.map(c => `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}-${c.slice(12, 16)}`);
  const hashed = await Promise.all(rawCodes.map(c => bcrypt.hash(c, 10)));
  return { formatted, hashed };
}
