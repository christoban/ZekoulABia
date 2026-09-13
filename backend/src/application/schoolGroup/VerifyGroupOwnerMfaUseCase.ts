/**
 * APPLICATION LAYER — Use Case : vérification MFA du Fondateur de Groupe
 * Miroir de VerifyMfaUseCase (MasterUser) — voir Plan_Groupe_Scolaire_ZekoulABia.md Section 3.
 */
import bcrypt from 'bcryptjs';
import { verifySync } from 'otplib';
import type { SchoolGroupOwnerAuthRepository } from '@domain/ports/repositories/SchoolGroupOwnerAuthRepository';

export class VerifyGroupOwnerMfaUseCase {
  constructor(private readonly ownerRepository: SchoolGroupOwnerAuthRepository) {}

  async getMfaStatus(ownerId: string): Promise<{ mfaEnabled: boolean }> {
    return this.ownerRepository.getMfaStatus(ownerId);
  }

  async execute(
    ownerId: string,
    code: string,
  ): Promise<{ email: string; name: string }> {
    const owner = await this.ownerRepository.findById(ownerId);

    if (!owner || !owner.mfaEnabled) {
      throw new Error('MFA non configuré');
    }

    if (owner.mfaSecret) {
      try {
        const totpValid = verifySync({ token: code, secret: owner.mfaSecret, epochTolerance: 60 }).valid;
        if (totpValid) {
          return { email: owner.email, name: owner.name };
        }
      } catch {
        /* fall through to recovery code check */
      }
    }

    const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const hashes = owner.mfaRecoveryCodeHashes || [];

    for (let i = 0; i < hashes.length; i++) {
      const hash = hashes[i];
      if (!hash) continue;
      const matches = await bcrypt.compare(normalized, hash);
      if (matches) {
        const updated = [...hashes];
        updated.splice(i, 1);
        await this.ownerRepository.updateMfaRecoveryCodes(owner.id, updated);
        return { email: owner.email, name: owner.name };
      }
    }

    throw new Error('Code MFA invalide');
  }
}
