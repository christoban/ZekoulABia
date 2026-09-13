import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import type { MfaService } from '@domain/ports/services/MfaService';
import { genererCodesRecuperation } from './MfaRecoveryCodeService';

export class MfaServiceAdapter implements MfaService {
  genererSecret(): string {
    return generateSecret();
  }

  genererURI(params: { issuer: string; label: string; secret: string }): string {
    return generateURI({ issuer: params.issuer, label: params.label, secret: params.secret });
  }

  async genererQRCode(otpauthUrl: string): Promise<string> {
    return QRCode.toDataURL(otpauthUrl);
  }

  async genererCodesRecuperation(): Promise<{ formatted: string[]; hashed: string[] }> {
    return genererCodesRecuperation();
  }

  verifierTotp(token: string, secret: string): boolean {
    return verifySync({ token, secret, epochTolerance: 60 }).valid;
  }
}
