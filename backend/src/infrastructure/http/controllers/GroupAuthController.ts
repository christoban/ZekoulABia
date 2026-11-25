import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import { LoginGroupOwnerUseCase } from '../../../application/schoolGroup/LoginGroupOwnerUseCase';
import { VerifyGroupOwnerMfaUseCase } from '../../../application/schoolGroup/VerifyGroupOwnerMfaUseCase';
import type { SchoolGroupOwnerAuthRepository } from '@domain/ports/repositories/SchoolGroupOwnerAuthRepository';
import { messageErreur } from '@application/shared/messageErreur';

const getGroupOwnerSecret = (): string =>
  process.env.GROUP_OWNER_JWT_SECRET || process.env.JWT_SECRET || '';

export class GroupAuthController {
  constructor(
    private readonly loginUseCase: LoginGroupOwnerUseCase,
    private readonly verifyMfaUseCase: VerifyGroupOwnerMfaUseCase,
    private readonly ownerAuthRepository: SchoolGroupOwnerAuthRepository,
  ) {}

  login = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ success: false, message: 'Email et mot de passe requis' });
        return;
      }
      await this.loginUseCase.executeLogin(email, password);
      res.json({ success: true, message: 'Code de vérification envoyé par email' });
    } catch (error) {
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

      const secret = getGroupOwnerSecret();

      if (!result.mfaRequired) {
        const token = jwt.sign(
          { id: result.ownerId, email: result.ownerEmail, tokenType: 'group_owner' },
          secret,
          { expiresIn: '30d', algorithm: 'HS512' },
        );
        res.cookie('group_jwt', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 30 * 24 * 60 * 60 * 1000,
          path: '/',
        });
        res.json({ success: true, mfaRequired: false });
      } else {
        const tempToken = jwt.sign(
          { id: result.ownerId, email: result.ownerEmail, tokenType: 'group_owner_temp' },
          secret,
          { expiresIn: '10m', algorithm: 'HS512' },
        );
        res.cookie('temp_group_owner_token', tempToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 10 * 60 * 1000,
          path: '/',
        });
        res.json({ success: true, mfaRequired: true, email: result.ownerEmail });
      }
    } catch (error) {
      res.status(401).json({ success: false, message: messageErreur(error) || 'Code invalide' });
    }
  };

  verifyMfa = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const rawTempToken = req.cookies?.temp_group_owner_token;
      if (!rawTempToken) {
        res.status(401).json({ success: false, message: 'Session temporaire expirée. Veuillez vous reconnecter.' });
        return;
      }

      let decoded: { id: string; email: string; tokenType: string };
      try {
        decoded = jwt.verify(rawTempToken, getGroupOwnerSecret(), { algorithms: ['HS512'] }) as typeof decoded;
      } catch {
        res.status(401).json({ success: false, message: 'Session temporaire expirée. Veuillez vous reconnecter.' });
        return;
      }

      if (decoded.tokenType !== 'group_owner_temp') {
        res.status(401).json({ success: false, message: 'Token temporaire invalide' });
        return;
      }

      const { code } = req.body;
      if (!code) {
        res.status(400).json({ success: false, message: 'Code MFA requis' });
        return;
      }

      const result = await this.verifyMfaUseCase.execute(decoded.id, code);

      const token = jwt.sign(
        { id: decoded.id, email: result.email, tokenType: 'group_owner' },
        getGroupOwnerSecret(),
        { expiresIn: '30d', algorithm: 'HS512' },
      );
      res.cookie('group_jwt', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: '/',
      });
      res.clearCookie('temp_group_owner_token', { path: '/' });
      res.json({ success: true, message: 'Authentification réussie' });
    } catch (error) {
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
      res.json({ success: true, message: 'Nouveau code de vérification envoyé' });
    } catch (error) {
      res.status(400).json({ success: false, message: messageErreur(error) || 'Erreur lors du renvoi' });
    }
  };

  me = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      res.json({ success: true, data: req.groupOwner });
    } catch (error) {
      res.status(500).json({ success: false, message: messageErreur(error) });
    }
  };

  mfaStatus = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const data = await this.verifyMfaUseCase.getMfaStatus(req.groupOwner!.id);
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: messageErreur(error) });
    }
  };

  mfaSetup = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const owner = await this.ownerAuthRepository.findById(req.groupOwner!.id);
      if (!owner) { res.status(404).json({ success: false, message: 'Compte introuvable' }); return; }
      if (owner.mfaEnabled) { res.status(400).json({ success: false, message: 'MFA déjà activé sur ce compte.' }); return; }

      const secret: string = generateSecret();

      await this.ownerAuthRepository.setMfaTempSecret(owner.id, secret);

      const otpauthUrl: string = generateURI({ issuer: 'ZekoulABia Groupe Scolaire', label: owner.email, secret });
      const qrDataUri: string = await QRCode.toDataURL(otpauthUrl);

      res.json({ success: true, data: { qrDataUri, manualKey: secret, otpauthUrl } });
    } catch (error) {
      res.status(500).json({ success: false, message: messageErreur(error) || 'Erreur' });
    }
  };

  mfaEnable = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { totpCode } = req.body;
      if (!totpCode) { res.status(400).json({ success: false, message: 'Code TOTP requis' }); return; }

      const owner = await this.ownerAuthRepository.findById(req.groupOwner!.id);
      if (!owner?.mfaTempSecret) {
        res.status(400).json({ success: false, message: "Aucune configuration MFA en cours. Recommencez depuis l'étape 1." });
        return;
      }
      if (owner.mfaEnabled) {
        res.status(400).json({ success: false, message: 'MFA déjà activé.' });
        return;
      }

      const valid: boolean = verifySync({ token: String(totpCode).trim(), secret: owner.mfaTempSecret }).valid;
      if (!valid) {
        res.status(401).json({ success: false, message: 'Code TOTP invalide. Vérifiez que votre application est synchronisée.' });
        return;
      }

      const rawCodes = Array.from({ length: 8 }, () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      });
      const formatted = rawCodes.map(c => `${c.slice(0,4)}-${c.slice(4,8)}-${c.slice(8,12)}-${c.slice(12,16)}`);
      const hashed = await Promise.all(rawCodes.map(c => bcrypt.hash(c, 10)));

      await this.ownerAuthRepository.activateMfa(owner.id, {
        mfaSecret: owner.mfaTempSecret,
        recoveryCodeHashes: hashed,
      });

      res.json({ success: true, data: { recoveryCodes: formatted } });
    } catch (error) {
      res.status(500).json({ success: false, message: messageErreur(error) || 'Erreur' });
    }
  };

  mfaDisable = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const owner = await this.ownerAuthRepository.findById(req.groupOwner!.id);
      if (!owner?.mfaEnabled) { res.status(400).json({ success: false, message: 'MFA non actif sur ce compte.' }); return; }

      await this.ownerAuthRepository.deactivateMfa(owner.id);

      res.json({ success: true, message: 'MFA désactivé.' });
    } catch (error) {
      res.status(500).json({ success: false, message: messageErreur(error) || 'Erreur' });
    }
  };

  mfaRegenCodes = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const owner = await this.ownerAuthRepository.findById(req.groupOwner!.id);
      if (!owner?.mfaEnabled) { res.status(400).json({ success: false, message: 'MFA non actif.' }); return; }

      const rawCodes = Array.from({ length: 8 }, () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      });
      const formatted = rawCodes.map(c => `${c.slice(0,4)}-${c.slice(4,8)}-${c.slice(8,12)}-${c.slice(12,16)}`);
      const hashed = await Promise.all(rawCodes.map(c => bcrypt.hash(c, 10)));

      await this.ownerAuthRepository.updateMfaRecoveryCodes(owner.id, hashed);

      res.json({ success: true, data: { recoveryCodes: formatted } });
    } catch (error) {
      res.status(500).json({ success: false, message: messageErreur(error) || 'Erreur' });
    }
  };

  logout = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      res.clearCookie('group_jwt', { path: '/' });
      res.clearCookie('temp_group_owner_token', { path: '/' });
      res.json({ success: true, message: 'Déconnexion réussie' });
    } catch (error) {
      res.status(500).json({ success: false, message: messageErreur(error) });
    }
  };
}
