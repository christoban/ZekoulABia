/**
 * APPLICATION LAYER — Use Case : OTP email lors de la connexion
 *
 * Miroir de LoginMasterUseCase (partie OTP) pour les comptes école. Contrairement au Master
 * (email global unique), l'email de User n'est unique que par école — toutes les opérations
 * sont donc indexées par userId, déjà résolu par ConnecterUtilisateurUseCase en amont.
 */
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';

export interface SendEmailOTP {
  (params: { recipientEmail: string; otp: string }): Promise<void>;
}

export class LoginEmailOtpUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly sendEmail: SendEmailOTP,
  ) {}

  async envoyer(userId: string): Promise<void> {
    const user = await this.userRepository.findAuthDataById(userId);
    if (!user || !user.isActive || !user.email) {
      throw new Error('Compte introuvable');
    }

    if (user.accessMode && user.accessMode !== 'FULL_ACCESS') {
      throw new Error("Ce compte ne dispose pas d'un accès de connexion direct.");
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHashed = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.userRepository.saveLoginEmailOtp(user.id, { hash: otpHashed, expiresAt });

    void this.sendEmail({ recipientEmail: user.email, otp }).catch(err =>
      console.error('[Email] Échec OTP connexion utilisateur:', (err as Error)?.message),
    );
  }

  async verifier(userId: string, otp: string): Promise<void> {
    const user = await this.userRepository.findAuthDataById(userId);
    if (!user) throw new Error('Code de vérification invalide');

    if (user.accessMode && user.accessMode !== 'FULL_ACCESS') {
      throw new Error("Ce compte ne dispose pas d'un accès de connexion direct.");
    }

    if (!user.loginEmailOtpHash || !user.loginEmailOtpExpiresAt) {
      throw new Error('Aucun code de vérification demandé. Veuillez vous reconnecter.');
    }
    if (user.loginEmailOtpAttempts >= 5) {
      throw new Error('Trop de tentatives. Veuillez redemander un nouveau code.');
    }
    if (new Date() > user.loginEmailOtpExpiresAt) {
      throw new Error('Le code de vérification a expiré. Veuillez redemander un nouveau code.');
    }

    const otpOk = await bcrypt.compare(otp, user.loginEmailOtpHash);
    if (!otpOk) {
      await this.userRepository.incrementLoginEmailOtpAttempts(user.id);
      throw new Error('Code de vérification incorrect');
    }

    await this.userRepository.clearLoginEmailOtp(user.id);
  }
}
