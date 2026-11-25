/**
 * APPLICATION LAYER — Use Case : vérifier le code MFA (TOTP ou récupération) lors de la connexion
 *
 * Miroir de VerifyMfaUseCase (module masterAdmin) pour les comptes école ADMIN/STAFF/TEACHER.
 */
import bcrypt from 'bcryptjs';
import { verifySync } from 'otplib';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';

export class VerifierMfaConnexionUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(userId: string, code: string): Promise<void> {
    const user = await this.userRepository.findAuthDataById(userId);

    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      throw new Error('MFA non configuré');
    }

    try {
      const totpValid = verifySync({ token: code, secret: user.mfaSecret, epochTolerance: 60 }).valid;
      if (totpValid) return;
    } catch {
      /* code mal formé — on retombe sur les codes de récupération */
    }

    const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const hashes = user.mfaRecoveryCodeHashes || [];

    for (let i = 0; i < hashes.length; i++) {
      const hash = hashes[i];
      if (!hash) continue;
      const matches = await bcrypt.compare(normalized, hash);
      if (matches) {
        const updated = [...hashes];
        updated.splice(i, 1);
        await this.userRepository.updateMfaRecoveryCodeHashes(user.id, updated);
        return;
      }
    }

    throw new Error('Code MFA invalide');
  }
}
