/**
 * DOMAIN LAYER — Port Service MFA
 * Génération / vérification TOTP + QR code + codes de récupération.
 * Aucune dépendance Prisma / HTTP.
 */
export interface MfaService {
  genererSecret(): string;
  genererURI(params: { issuer: string; label: string; secret: string }): string;
  genererQRCode(otpauthUrl: string): Promise<string>;
  genererCodesRecuperation(): Promise<{ formatted: string[]; hashed: string[] }>;
  verifierTotp(token: string, secret: string): boolean;
}
