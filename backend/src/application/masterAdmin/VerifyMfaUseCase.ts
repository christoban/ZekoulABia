import bcrypt from 'bcryptjs';
import { verifySync } from 'otplib';
import type { MasterUserAuthRepository } from '@domain/ports/repositories/MasterUserAuthRepository';

export class VerifyMfaUseCase {
  constructor(private readonly masterUserAuthRepository: MasterUserAuthRepository) {}

  async getMfaStatus(masterUserId: string): Promise<{ mfaEnabled: boolean }> {
    return this.masterUserAuthRepository.getMfaStatus(masterUserId);
  }

  async execute(
    masterUserId: string,
    code: string,
  ): Promise<{
    email: string;
    name: string;
    role: string;
    isSuperAdmin: boolean;
  }> {
    const masterUser = await this.masterUserAuthRepository.findById(masterUserId);

    if (!masterUser || !masterUser.mfaEnabled) {
      throw new Error('MFA non configuré');
    }

    if (masterUser.mfaSecret) {
      try {
        const totpValid = verifySync({ token: code, secret: masterUser.mfaSecret, epochTolerance: 60 }).valid;
        if (totpValid) {
          return {
            email: masterUser.email,
            name: masterUser.name,
            role: masterUser.role,
            isSuperAdmin: masterUser.isSuperAdmin,
          };
        }
      } catch {
        /* fall through to recovery code check */
      }
    }

    const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const hashes = masterUser.mfaRecoveryCodeHashes || [];

    for (let i = 0; i < hashes.length; i++) {
      const hash = hashes[i];
      if (!hash) continue;
      const matches = await bcrypt.compare(normalized, hash);
      if (matches) {
        const updated = [...hashes];
        updated.splice(i, 1);
        await this.masterUserAuthRepository.updateMfaRecoveryCodes(masterUser.id, updated);
        return {
          email: masterUser.email,
          name: masterUser.name,
          role: masterUser.role,
          isSuperAdmin: masterUser.isSuperAdmin,
        };
      }
    }

    throw new Error('Code MFA invalide');
  }
}
