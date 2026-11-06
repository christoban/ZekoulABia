import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import { logMasterAuthAudit } from '../../services/audit/MasterAuthAuditService';
import { LoginMasterUseCase } from '../../../application/masterAdmin/LoginMasterUseCase';
import { VerifyMfaUseCase } from '../../../application/masterAdmin/VerifyMfaUseCase';
import type { MasterUserAuthRepository } from '@domain/ports/repositories/MasterUserAuthRepository';
import { messageErreur } from '@application/shared/messageErreur';

const getMasterSecret = (): string =>
  process.env.MASTER_JWT_SECRET || process.env.JWT_SECRET || '';

export class MasterAuthController {
  constructor(
    private readonly loginUseCase: LoginMasterUseCase,
    private readonly verifyMfaUseCase: VerifyMfaUseCase,
    private readonly masterUserAuthRepository: MasterUserAuthRepository,
  ) {}

  login = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ success: false, message: 'Email et mot de passe requis' });
        return;
      }
      await this.loginUseCase.executeLogin(email, password);
      void logMasterAuthAudit({ req, outcome: 'success', reason: 'login_otp_sent', email });
      res.json({ success: true, message: 'Code de vérification envoyé par email' });
    } catch (error) {
      void logMasterAuthAudit({ req, outcome: 'failure', reason: 'login_failed', email: req.body?.email });
      res.status(401).json({ success: false, message: messageErreur(error) || 'Erreur de connexion' });
    }
  };

  verifyOtp = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) {
        res.status(400).json({ success: false, message: 'Email et code OTP requis' });
        return;
      }
      const result = await this.loginUseCase.executeVerifyOtp(email, otp);
      void logMasterAuthAudit({ req, outcome: 'success', reason: 'otp_verified', email });

      const secret = getMasterSecret();

      if (!result.mfaRequired) {
        const token = jwt.sign(
          { id: result.masterUserId, email: result.masterUserEmail, role: result.isSuperAdmin ? 'super_admin' : result.role.toLowerCase(), tokenType: 'master' },
          secret,
          { expiresIn: '30d', algorithm: 'HS512' },
        );
        res.cookie('master_jwt', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 30 * 24 * 60 * 60 * 1000,
          path: '/',
        });
        res.json({ success: true, mfaRequired: false });
      } else {
        const tempToken = jwt.sign(
          { id: result.masterUserId, email: result.masterUserEmail, tokenType: 'master_temp' },
          secret,
          { expiresIn: '10m', algorithm: 'HS512' },
        );
        res.cookie('temp_master_token', tempToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 10 * 60 * 1000,
          path: '/',
        });
        res.json({ success: true, mfaRequired: true, email: result.masterUserEmail });
      }
    } catch (error) {
      void logMasterAuthAudit({ req, outcome: 'failure', reason: 'otp_verification_failed', email: req.body?.email });
      res.status(401).json({ success: false, message: messageErreur(error) || 'Code invalide' });
    }
  };

  verifyMfa = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const rawTempToken = req.cookies?.temp_master_token;
      if (!rawTempToken) {
        res.status(401).json({ success: false, message: 'Session temporaire expirée. Veuillez vous reconnecter.' });
        return;
      }

      let decoded: { id: string; email: string; tokenType: string };
      try {
        decoded = jwt.verify(rawTempToken, getMasterSecret(), { algorithms: ['HS512'] }) as typeof decoded;
      } catch {
        res.status(401).json({ success: false, message: 'Session temporaire expirée. Veuillez vous reconnecter.' });
        return;
      }

      if (decoded.tokenType !== 'master_temp') {
        res.status(401).json({ success: false, message: 'Token temporaire invalide' });
        return;
      }

      const { code } = req.body;
      if (!code) {
        res.status(400).json({ success: false, message: 'Code MFA requis' });
        return;
      }

      const result = await this.verifyMfaUseCase.execute(decoded.id, code);
      void logMasterAuthAudit({ req, outcome: 'success', reason: 'mfa_verified', email: result.email });

      const token = jwt.sign(
        { id: decoded.id, email: result.email, role: result.isSuperAdmin ? 'super_admin' : result.role.toLowerCase(), tokenType: 'master' },
        getMasterSecret(),
        { expiresIn: '30d', algorithm: 'HS512' },
      );
      res.cookie('master_jwt', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: '/',
      });
      res.clearCookie('temp_master_token', { path: '/' });
      res.json({ success: true, message: 'Authentification réussie' });
    } catch (error) {
      void logMasterAuthAudit({ req, outcome: 'failure', reason: 'mfa_verification_failed', email: req.body?.email });
      res.status(401).json({ success: false, message: messageErreur(error) || 'Code MFA invalide' });
    }
  };

  resendOtp = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).json({ success: false, message: 'Email requis' });
        return;
      }
      await this.loginUseCase.executeResendOtp(email);
      void logMasterAuthAudit({ req, outcome: 'success', reason: 'otp_resend', email });
      res.json({ success: true, message: 'Nouveau code de vérification envoyé' });
    } catch (error) {
      res.status(400).json({ success: false, message: messageErreur(error) || 'Erreur lors du renvoi' });
    }
  };

  me = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      res.json({ success: true, data: req.masterUser });
    } catch (error) {
      res.status(500).json({ success: false, message: messageErreur(error) });
    }
  };

  mfaStatus = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const user = await this.verifyMfaUseCase.getMfaStatus(req.masterUser!.id);
      res.json({ success: true, data: user });
    } catch (error) {
      res.status(500).json({ success: false, message: messageErreur(error) });
    }
  };

  // ── Étape 1 : vérifier identité (via requireMasterSensitiveAuth) → envoyer OTP email ──
  initiatePasswordChange = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const result = await this.loginUseCase.executeSendPasswordChangeOtp(req.masterUser!.id);
      void logMasterAuthAudit({ req, outcome: 'success', reason: 'password_change_otp_sent', email: req.masterUser?.email });
      res.json({ success: true, message: `Code de vérification envoyé à ${result.email}` });
    } catch (error) {
      res.status(400).json({ success: false, message: messageErreur(error) || 'Erreur' });
    }
  };

  // ── Forgot password — Étape 1 : envoie un OTP email (sans authentification) ──
  forgotPassword = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).json({ success: false, message: 'Email requis' });
        return;
      }
      const result = await this.loginUseCase.executeForgotPasswordOtp(email);
      void logMasterAuthAudit({ req, outcome: 'success', reason: 'forgot_password_otp_sent', email });
      res.json({ success: true, message: `Code de vérification envoyé à ${result.email}` });
    } catch (error) {
      void logMasterAuthAudit({ req, outcome: 'failure', reason: 'forgot_password_request_failed', email: req.body?.email });
      res.status(400).json({ success: false, message: messageErreur(error) || 'Erreur' });
    }
  };

  // ── Forgot password — Étape 2 : vérifie l'OTP email et applique le nouveau mot de passe ──
  forgotPasswordConfirm = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { email, otp, newPassword } = req.body;
      if (!email || !otp || !newPassword) {
        res.status(400).json({ success: false, message: 'Email, code OTP et nouveau mot de passe requis' });
        return;
      }
      await this.loginUseCase.executeResetForgottenPassword(email, newPassword, String(otp).trim());
      void logMasterAuthAudit({ req, outcome: 'success', reason: 'password_reset_via_forgot_password', email });
      res.json({ success: true, message: 'Mot de passe réinitialisé avec succès' });
    } catch (error) {
      void logMasterAuthAudit({ req, outcome: 'failure', reason: 'forgot_password_confirm_failed', email: req.body?.email });
      res.status(400).json({ success: false, message: messageErreur(error) || 'Erreur' });
    }
  };

  // ── Étape 2 : vérifier OTP email + appliquer le nouveau mot de passe ────────
  changePassword = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { newPassword, otp } = req.body;
      if (!newPassword || !otp) {
        res.status(400).json({ success: false, message: 'Nouveau mot de passe et code OTP requis' });
        return;
      }
      await this.loginUseCase.executeChangePassword(req.masterUser!.id, newPassword, String(otp).trim());
      void logMasterAuthAudit({ req, outcome: 'success', reason: 'password_changed_from_security_dashboard', email: req.masterUser?.email });
      res.json({ success: true, message: 'Mot de passe modifié avec succès' });
    } catch (error) {
      void logMasterAuthAudit({ req, outcome: 'failure', reason: 'password_change_failed', email: req.masterUser?.email });
      res.status(400).json({ success: false, message: messageErreur(error) || 'Erreur' });
    }
  };

  // ── Génère un secret temporaire + QR code (appelé avant mfaEnable) ─────────
  mfaSetup = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const masterUser = await this.masterUserAuthRepository.findById(req.masterUser!.id);
      if (!masterUser) { res.status(404).json({ success: false, message: 'Compte introuvable' }); return; }
      if (masterUser.mfaEnabled) { res.status(400).json({ success: false, message: 'MFA déjà activé sur ce compte.' }); return; }

      const secret: string = generateSecret();

      await this.masterUserAuthRepository.setMfaTempSecret(masterUser.id, secret);

      const otpauthUrl: string = generateURI({ issuer: 'ZekoulABia Admin', label: masterUser.email, secret });
      const qrDataUri: string = await QRCode.toDataURL(otpauthUrl);

      res.json({ success: true, data: { qrDataUri, manualKey: secret, otpauthUrl } });
    } catch (error) {
      res.status(500).json({ success: false, message: messageErreur(error) || 'Erreur' });
    }
  };

  // ── Vérifie le code TOTP et active le MFA — retourne les codes de récup. ───
  mfaEnable = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { totpCode } = req.body;
      if (!totpCode) { res.status(400).json({ success: false, message: 'Code TOTP requis' }); return; }

      const masterUser = await this.masterUserAuthRepository.findById(req.masterUser!.id);
      if (!masterUser?.mfaTempSecret) {
        res.status(400).json({ success: false, message: 'Aucune configuration MFA en cours. Recommencez depuis l\'étape 1.' });
        return;
      }
      if (masterUser.mfaEnabled) {
        res.status(400).json({ success: false, message: 'MFA déjà activé.' });
        return;
      }

      const valid: boolean = verifySync({ token: String(totpCode).trim(), secret: masterUser.mfaTempSecret }).valid;
      if (!valid) {
        res.status(401).json({ success: false, message: 'Code TOTP invalide. Vérifiez que votre application est synchronisée.' });
        return;
      }

      // Générer 8 codes de récupération
      const rawCodes = Array.from({ length: 8 }, () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      });
      const formatted = rawCodes.map(c => `${c.slice(0,4)}-${c.slice(4,8)}-${c.slice(8,12)}-${c.slice(12,16)}`);
      const hashed = await Promise.all(rawCodes.map(c => bcrypt.hash(c, 10)));

      await this.masterUserAuthRepository.activateMfa(masterUser.id, {
        mfaSecret: masterUser.mfaTempSecret,
        recoveryCodeHashes: hashed,
      });

      void logMasterAuthAudit({ req, outcome: 'success', reason: 'mfa_enabled', email: masterUser.email });
      res.json({ success: true, data: { recoveryCodes: formatted } });
    } catch (error) {
      res.status(500).json({ success: false, message: messageErreur(error) || 'Erreur' });
    }
  };

  // ── Désactive le MFA (password + code TOTP via requireMasterSensitiveAuth) ─
  mfaDisable = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const masterUser = await this.masterUserAuthRepository.findById(req.masterUser!.id);
      if (!masterUser?.mfaEnabled) { res.status(400).json({ success: false, message: 'MFA non actif sur ce compte.' }); return; }

      await this.masterUserAuthRepository.deactivateMfa(masterUser.id);

      void logMasterAuthAudit({ req, outcome: 'success', reason: 'mfa_disabled', email: masterUser.email });
      res.json({ success: true, message: 'MFA désactivé.' });
    } catch (error) {
      res.status(500).json({ success: false, message: messageErreur(error) || 'Erreur' });
    }
  };

  // ── Régénère les codes de récupération (password + TOTP via middleware) ────
  mfaRegenCodes = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const masterUser = await this.masterUserAuthRepository.findById(req.masterUser!.id);
      if (!masterUser?.mfaEnabled) { res.status(400).json({ success: false, message: 'MFA non actif.' }); return; }

      const rawCodes = Array.from({ length: 8 }, () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      });
      const formatted = rawCodes.map(c => `${c.slice(0,4)}-${c.slice(4,8)}-${c.slice(8,12)}-${c.slice(12,16)}`);
      const hashed = await Promise.all(rawCodes.map(c => bcrypt.hash(c, 10)));

      await this.masterUserAuthRepository.updateMfaRecoveryCodes(masterUser.id, hashed);

      void logMasterAuthAudit({ req, outcome: 'success', reason: 'recovery_codes_regenerated', email: masterUser.email });
      res.json({ success: true, data: { recoveryCodes: formatted } });
    } catch (error) {
      res.status(500).json({ success: false, message: messageErreur(error) || 'Erreur' });
    }
  };

  logout = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      void logMasterAuthAudit({ req, outcome: 'success', reason: 'logout', email: req.masterUser?.email });
      res.clearCookie('master_jwt', { path: '/' });
      res.clearCookie('temp_master_token', { path: '/' });
      res.json({ success: true, message: 'Déconnexion réussie' });
    } catch (error) {
      res.status(500).json({ success: false, message: messageErreur(error) });
    }
  };
}
