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

export interface SendSmsOTP {
  (params: { recipientPhone: string; otp: string }): Promise<void>;
}

export interface EnvoiOtpResultat {
  channel: 'EMAIL' | 'SMS';
  emailMasked: string | null;
  phoneMasked: string | null;
  hasPhone: boolean;
}

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const prefix = local?.[0] ?? '';
  const suffix = local.length > 2 ? local[local.length - 1] : '';
  return `${prefix}***${suffix}@${domain}`;
}

function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const clean = phone.replace(/\s+/g, '');
  if (clean.length < 6) return '••••••';
  const start = clean.slice(0, clean.startsWith('+') ? 5 : 3);
  const end = clean.slice(-2);
  return `${start} ••• ••• •${end}`;
}

export class LoginEmailOtpUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly sendEmail: SendEmailOTP,
    private readonly sendSms?: SendSmsOTP,
  ) {}

  async envoyer(userId: string): Promise<EnvoiOtpResultat> {
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

    return {
      channel: 'EMAIL',
      emailMasked: maskEmail(user.email),
      phoneMasked: maskPhone(user.phone ?? null),
      hasPhone: Boolean(user.phone && user.phone.trim().length >= 8),
    };
  }

  async envoyerSms(userId: string): Promise<EnvoiOtpResultat> {
    const user = await this.userRepository.findAuthDataById(userId);
    if (!user || !user.isActive) {
      throw new Error('Compte introuvable');
    }

    if (user.accessMode && user.accessMode !== 'FULL_ACCESS') {
      throw new Error("Ce compte ne dispose pas d'un accès de connexion direct.");
    }

    if (!user.phone || user.phone.trim().length < 8) {
      throw new Error("Aucun numéro de téléphone n'est associé à ce compte. Veuillez contacter l'administration de l'établissement.");
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHashed = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.userRepository.saveLoginEmailOtp(user.id, { hash: otpHashed, expiresAt });

    if (this.sendSms) {
      void this.sendSms({ recipientPhone: user.phone, otp }).catch(err =>
        console.error('[SMS] Échec OTP connexion utilisateur:', (err as Error)?.message),
      );
    }

    return {
      channel: 'SMS',
      emailMasked: maskEmail(user.email),
      phoneMasked: maskPhone(user.phone),
      hasPhone: true,
    };
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
