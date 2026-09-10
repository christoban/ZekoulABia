import type { Request, Response, NextFunction } from 'express';
import { createHash, randomBytes } from 'crypto';
import type { MfaUseCase } from '@application/user/MfaUseCase';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import { passwordError } from '../../../../domain/security/PasswordPolicy';
import { sendTransactionalEmail } from '../../../services/email/EmailService.ts';

export class UserMfaPasswordController {
  constructor(
    private readonly mfaUseCase: MfaUseCase,
    private readonly userRepository: UserRepository,
    private readonly schoolRepository: SchoolRepository,
  ) {}

  // GET /api/v2/users/mfa/status
  mfaStatus = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const data = await this.mfaUseCase.mfaStatus(userId);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // POST /api/v2/users/mfa/reconfigure/start
  mfaReconfigureStart = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const data = await this.mfaUseCase.mfaReconfigureStart(userId);
      res.json({ success: true, data });
    } catch (error: any) {
      const msg: string = error.message || 'Erreur';
      const status = msg.includes("Configurez d'abord") ? 400 : 500;
      res.status(status).json({ success: false, message: msg });
    }
  };

  // POST /api/v2/users/mfa/reconfigure/confirm
  mfaReconfigureConfirm = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const { totpCode } = req.body;
      if (!totpCode) {
        res.status(400).json({ success: false, message: 'Code TOTP requis' });
        return;
      }
      const data = await this.mfaUseCase.mfaReconfigureConfirm(userId, totpCode);
      res.json({ success: true, data });
    } catch (error: any) {
      const msg: string = error.message || 'Erreur';
      const status = msg.includes('Aucune reconfiguration') ? 400 : msg.includes('TOTP invalide') ? 401 : 500;
      res.status(status).json({ success: false, message: msg });
    }
  };

  // POST /api/v2/users/mfa/regen-codes
  mfaRegenCodes = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const data = await this.mfaUseCase.mfaRegenCodes(userId);
      res.json({ success: true, data });
    } catch (error: any) {
      const msg: string = error.message || 'Erreur';
      const status = msg.includes('MFA non actif') ? 400 : 500;
      res.status(status).json({ success: false, message: msg });
    }
  };

  // POST /api/v2/users/auth/forgot-password
  forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, subdomain } = req.body as { email?: string; subdomain?: string };
      if (!email) {
        res.status(400).json({ success: false, message: 'email requis.' });
        return;
      }

      const normalizedEmail = email.toLowerCase().trim();
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

      // Helper: send reset email for a given user
      const sendResetEmail = async (user: any, school: any) => {
        const plainToken = randomBytes(32).toString('hex');
        const tokenHash = createHash('sha256').update(plainToken).digest('hex');
        const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1h

        await this.userRepository.creerJetonReinitialisation(user.id, tokenHash, expiry);

        const resetUrl = `${clientUrl}/reset-password?token=${plainToken}&subdomain=${school.subdomain}`;
        const name = `${user.firstName} ${user.lastName}`;

        await sendTransactionalEmail({
          recipientEmail: user.email,
          subject: 'Réinitialisation de votre mot de passe — ZekoulABia',
          template: 'password_reset',
          eventType: 'password_reset',
          html: `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;background:#f9f7f4;border-radius:12px">
              <div style="background:linear-gradient(135deg,#059669,#047857);border-radius:10px;padding:24px 28px;margin-bottom:28px">
                <h1 style="color:white;margin:0;font-size:22px;font-weight:800">🔐 Réinitialisation du mot de passe</h1>
              </div>
              <p style="color:#374151;font-size:16px">Bonjour <strong>${name}</strong>,</p>
              <p style="color:#374151;font-size:15px">Vous avez demandé la réinitialisation de votre mot de passe pour votre compte ZekoulABia.</p>
              <p style="color:#374151;font-size:15px">Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien expirera dans <strong>1 heure</strong>.</p>
              <div style="text-align:center;margin:32px 0">
                <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#059669,#047857);color:white;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:16px;font-weight:800">
                  Réinitialiser mon mot de passe
                </a>
              </div>
              <p style="color:#6b7280;font-size:13px">Si vous n'avez pas fait cette demande, ignorez simplement cet email. Votre mot de passe ne sera pas modifié.</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
              <p style="color:#9ca3af;font-size:12px;text-align:center">ZekoulABia — Système de gestion scolaire</p>
            </div>`,
          metadata: { schoolId: school.id },
        });
      };

      if (subdomain) {
        // Backward compat: subdomain provided
        const school = await this.schoolRepository.findBySubdomain(subdomain);
        if (!school) {
          res.json({ success: true, message: 'Si ce compte existe, un email de réinitialisation a été envoyé.' });
          return;
        }

        const user = await this.userRepository.findByEmail(normalizedEmail, school.id);
        if (user?.email) {
          await sendResetEmail(user, school);
        }

        res.json({ success: true, message: 'Si ce compte existe, un email de réinitialisation a été envoyé.' });
        return;
      }

      // No subdomain: find all matching users across schools
      // Need a repo method: findUsersByEmailAcrossSchools
      // For now, use findByEmail with each school (fallback - not ideal)
      // TODO: add findMatchingAccountsByEmailPassword equivalent for reset
      // Minimal V1: generic response only, no email sent (anti-enumeration)
      // If exact 1 user found via a future repo method, send email

      res.json({ success: true, message: 'Si ce compte existe, un email de réinitialisation a été envoyé.' });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/users/auth/reset-password
  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token, password, confirmPassword } = req.body as {
        token?: string;
        password?: string;
        confirmPassword?: string;
      };

      if (!token || !password) {
        res.status(400).json({ success: false, message: 'Token et mot de passe requis.' });
        return;
      }
      if (password !== confirmPassword) {
        res.status(400).json({ success: false, message: 'Les mots de passe ne correspondent pas.' });
        return;
      }
      const pwdErr = passwordError(password);
      if (pwdErr) {
        res.status(400).json({ success: false, message: pwdErr });
        return;
      }

      const tokenHash = createHash('sha256').update(token).digest('hex');
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash(password, 10);

      try {
        await this.userRepository.reinitialiserMotDePasse(tokenHash, passwordHash);
      } catch (e: any) {
        res.status(400).json({
          success: false,
          message: e.message || 'Lien invalide ou expiré. Demandez un nouveau lien.',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.',
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/users/auth/change-password
  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authUser = req.user as { userId: string };
      const { currentPassword, newPassword, confirmPassword } = req.body as {
        currentPassword?: string;
        newPassword?: string;
        confirmPassword?: string;
      };

      if (!currentPassword || !newPassword) {
        res.status(400).json({ success: false, message: 'Mot de passe actuel et nouveau mot de passe requis.' });
        return;
      }
      if (newPassword !== confirmPassword) {
        res.status(400).json({ success: false, message: 'Les mots de passe ne correspondent pas.' });
        return;
      }
      if (newPassword === currentPassword) {
        res.status(400).json({ success: false, message: "Le nouveau mot de passe doit être différent de l'ancien." });
        return;
      }
      const pwdErr = passwordError(newPassword);
      if (pwdErr) {
        res.status(400).json({ success: false, message: pwdErr });
        return;
      }

      const existing = await this.userRepository.findById(authUser.userId);
      if (!existing) {
        res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
        return;
      }

      const ok = await this.userRepository.verifierMotDePasse(authUser.userId, currentPassword);
      if (!ok) {
        res.status(401).json({ success: false, message: 'Mot de passe actuel incorrect.' });
        return;
      }

      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash(newPassword, 10);
      await this.userRepository.mettreAJourMotDePasse(authUser.userId, passwordHash);

      res.json({ success: true, message: 'Mot de passe modifié avec succès.' });
    } catch (error) {
      next(error);
    }
  };
}
