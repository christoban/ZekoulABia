import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { MfaService } from '@domain/ports/services/MfaService';

export class MfaUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly mfaService: MfaService,
  ) {}

  async firstMfaSetup(userId: string): Promise<{ qrDataUri: string; manualKey: string }> {
    const auth = await this.userRepository.findAuthDataById(userId);
    if (!auth) throw new Error('Utilisateur introuvable');
    if (auth.mfaEnabled) {
      throw new Error('MFA déjà activé sur ce compte.');
    }

    const secret: string = auth.mfaTempSecret || this.mfaService.genererSecret();
    if (!auth.mfaTempSecret) {
      await this.userRepository.updateMfaTempSecret(userId, secret);
    }

    const otpauthUrl: string = this.mfaService.genererURI({ issuer: 'ZekoulABia', label: auth.email || userId, secret });
    const qrDataUri: string = await this.mfaService.genererQRCode(otpauthUrl);

    return { qrDataUri, manualKey: secret };
  }

  async firstMfaEnable(userId: string, totpCode: string): Promise<{ recoveryCodes: string[] }> {
    const user = await this.userRepository.findAuthDataById(userId);
    if (!user) throw new Error('Compte introuvable');
    if (user.mfaEnabled) {
      throw new Error('MFA déjà activé.');
    }
    if (!user.mfaTempSecret) {
      throw new Error('Aucune configuration MFA en cours. Recommencez depuis l\'étape 1.');
    }

    const valid = this.mfaService.verifierTotp(String(totpCode).trim(), user.mfaTempSecret);
    if (!valid) {
      throw new Error('Code TOTP invalide. Vérifiez que votre application est synchronisée.');
    }

    const { formatted, hashed } = await this.mfaService.genererCodesRecuperation();

    await this.userRepository.updateMfa({
      userId,
      mfaEnabled: true,
      mfaSecret: user.mfaTempSecret,
      mfaTempSecret: null,
      mfaRecoveryCodeHashes: hashed,
      mfaRecoveryCodeGeneratedAt: new Date(),
    });

    return { recoveryCodes: formatted };
  }

  async mfaStatus(userId: string): Promise<{ mfaEnabled: boolean }> {
    return { mfaEnabled: await this.userRepository.isMfaEnabled(userId) };
  }

  async mfaReconfigureStart(userId: string): Promise<{ qrDataUri: string; manualKey: string }> {
    const user = await this.userRepository.findAuthDataById(userId);
    if (!user || !user.mfaEnabled) {
      throw new Error('Configurez d\'abord le MFA depuis la connexion.');
    }

    const secret: string = this.mfaService.genererSecret();
    await this.userRepository.updateMfaTempSecret(userId, secret);

    const otpauthUrl: string = this.mfaService.genererURI({ issuer: 'ZekoulABia', label: user.email || userId, secret });
    const qrDataUri: string = await this.mfaService.genererQRCode(otpauthUrl);

    return { qrDataUri, manualKey: secret };
  }

  async mfaReconfigureConfirm(userId: string, totpCode: string): Promise<{ recoveryCodes: string[] }> {
    const user = await this.userRepository.findAuthDataById(userId);
    if (!user?.mfaTempSecret) {
      throw new Error('Aucune reconfiguration en cours. Recommencez depuis l\'étape 1.');
    }

    const valid = this.mfaService.verifierTotp(String(totpCode).trim(), user.mfaTempSecret);
    if (!valid) {
      throw new Error('Code TOTP invalide.');
    }

    const { formatted, hashed } = await this.mfaService.genererCodesRecuperation();

    await this.userRepository.updateMfa({
      userId,
      mfaSecret: user.mfaTempSecret,
      mfaTempSecret: null,
      mfaRecoveryCodeHashes: hashed,
      mfaRecoveryCodeGeneratedAt: new Date(),
    });

    return { recoveryCodes: formatted };
  }

  async mfaRegenCodes(userId: string): Promise<{ recoveryCodes: string[] }> {
    const user = await this.userRepository.findAuthDataById(userId);
    if (!user?.mfaEnabled) {
      throw new Error('MFA non actif.');
    }

    const { formatted, hashed } = await this.mfaService.genererCodesRecuperation();

    await this.userRepository.updateMfaRecoveryCodeHashes(userId, hashed);

    return { recoveryCodes: formatted };
  }
}
