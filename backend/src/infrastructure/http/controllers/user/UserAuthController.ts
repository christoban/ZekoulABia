import type { Request, Response, NextFunction } from 'express';
import type { ConnecterUtilisateurUseCase, RoleMismatchError, SchoolSuspendedError, MultipleAccountsError } from '@application/user/ConnecterUtilisateurUseCase';
import type { LoginEmailOtpUseCase } from '@application/user/LoginEmailOtpUseCase';
import type { VerifierMfaConnexionUseCase } from '@application/user/VerifierMfaConnexionUseCase';
import type { MfaUseCase } from '@application/user/MfaUseCase';
import type { DeconnecterUtilisateurUseCase } from '@application/user/DeconnecterUtilisateurUseCase';
import type { RafraichirTokenUseCase } from '@application/user/RafraichirTokenUseCase';
import type { TokenService, PayloadToken } from '@domain/ports/services/TokenService';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import { verifierMotDePasseEtMfa } from '../../middlewares/requireUserSensitiveAuth.ts';
import { emettreJetonReauth } from '../../middlewares/requireReauthToken.ts';
import {
  MFA_REQUIRED_ROLES,
  ACCESS_COOKIE_MAX_AGE_MS,
  COOKIE_OPTIONS,
  dureeCookieRefreshMs,
  signPendingToken,
  setPendingCookie,
  readPendingToken,
  issueFinalSession,
  gererErreurUser,
  type PendingLoginPayload,
} from './userAuthHelper';

export class UserAuthController {
  constructor(
    private readonly connecter: ConnecterUtilisateurUseCase,
    private readonly loginEmailOtp: LoginEmailOtpUseCase,
    private readonly verifierMfaConnexion: VerifierMfaConnexionUseCase,
    private readonly mfaUseCase: MfaUseCase,
    private readonly deconnecter: DeconnecterUtilisateurUseCase,
    private readonly rafraichir: RafraichirTokenUseCase,
    private readonly tokenService: TokenService,
    private readonly schoolRepository: SchoolRepository,
    private readonly userRepository: UserRepository,
  ) {}

  // POST /api/v2/auth/login
  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password, subdomain, role, userId } = req.body;
      if (!email || !password) {
        res.status(400).json({ success: false, message: 'email et password requis' });
        return;
      }

      let schoolId: string | undefined;
      if (subdomain) {
        // Compatibilité rétro (ancien client) — optionnel
        const school = await this.schoolRepository.findBySubdomain(subdomain);
        if (!school) {
          res.status(404).json({ success: false, message: 'Établissement introuvable' });
          return;
        }
        schoolId = school.id;
      }

      const resultat = await this.connecter.execute({
        email,
        plainPassword: password,
        schoolId,
        role: role || undefined,
        userId: userId || undefined,
      });

      await this.loginEmailOtp.envoyer(resultat.userId);

      const pendingPayload: Omit<PendingLoginPayload, 'tokenType'> = {
        userId: resultat.userId,
        schoolId: resultat.schoolId,
        role: resultat.role,
        permissions: resultat.permissions,
        nomComplet: resultat.nomComplet,
        mustChangePassword: resultat.mustChangePassword,
        roleMismatch: resultat.roleMismatch ?? false,
        redirectTo: resultat.redirectTo ?? null,
      };
      const token = signPendingToken(pendingPayload, 'pending_login', '10m');
      setPendingCookie(res, token, 10 * 60 * 1000);

      res.json({ success: true, step: 'email_otp', message: 'Code de vérification envoyé par email' });
    } catch (error) {
      if (error instanceof Error && (error as SchoolSuspendedError).code === 'SCHOOL_SUSPENDED') {
        res.status(403).json({
          success: false,
          error: 'SCHOOL_SUSPENDED',
          message: 'Votre établissement a été suspendu. Contactez le support ZekoulABia.',
        });
        return;
      }
      if (error instanceof Error && (error as MultipleAccountsError).code === 'MULTIPLE_ACCOUNTS') {
        res.status(409).json({
          success: false,
          code: 'MULTIPLE_ACCOUNTS',
          message: 'Plusieurs comptes correspondent. Choisissez celui avec lequel vous voulez vous connecter.',
          accounts: (error as MultipleAccountsError).accounts,
        });
        return;
      }
      if (error instanceof Error && error.message === 'ROLE_MISMATCH_MULTIPLE') {
        res.status(422).json({
          success: false,
          code: 'ROLE_MISMATCH_MULTIPLE',
          message: 'Le rôle sélectionné ne correspond à aucun compte dans cet établissement.',
          availableRoles: (error as RoleMismatchError).availableRoles,
        });
        return;
      }
      gererErreurUser(error, res, next);
    }
  };

  // POST /api/v2/users/auth/verify-login-otp
  verifyLoginOtp = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const decoded = readPendingToken(req, 'pending_login');
      const { otp } = req.body;
      if (!otp) {
        res.status(400).json({ success: false, message: 'Code OTP requis' });
        return;
      }

      await this.loginEmailOtp.verifier(decoded.userId, otp);
      const base = { ...decoded };

      if (MFA_REQUIRED_ROLES.includes(decoded.role)) {
        const mfaEnabled = await this.userRepository.isMfaEnabled(decoded.userId);

        if (mfaEnabled) {
          const token = signPendingToken(base, 'pending_mfa', '10m');
          setPendingCookie(res, token, 10 * 60 * 1000);
          res.json({ success: true, step: 'totp_required' });
          return;
        }

        const token = signPendingToken(base, 'pending_mfa_setup', '20m');
        setPendingCookie(res, token, 20 * 60 * 1000);
        res.json({ success: true, step: 'mfa_setup_required' });
        return;
      }

      const data = issueFinalSession(res, this.tokenService, base);
      res.json({ success: true, step: 'done', data });
    } catch (error: any) {
      res.status(401).json({ success: false, message: error.message || 'Code invalide' });
    }
  };

  // POST /api/v2/users/auth/resend-login-otp
  resendLoginOtp = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const decoded = readPendingToken(req, 'pending_login');
      await this.loginEmailOtp.envoyer(decoded.userId);
      const token = signPendingToken(decoded, 'pending_login', '10m');
      setPendingCookie(res, token, 10 * 60 * 1000);
      res.json({ success: true, message: 'Nouveau code de vérification envoyé' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Erreur lors du renvoi' });
    }
  };

  // POST /api/v2/users/auth/verify-login-mfa
  verifyLoginMfa = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const decoded = readPendingToken(req, 'pending_mfa');
      const { code } = req.body;
      if (!code) {
        res.status(400).json({ success: false, message: 'Code MFA requis' });
        return;
      }

      await this.verifierMfaConnexion.execute(decoded.userId, code);
      const data = issueFinalSession(res, this.tokenService, decoded);
      res.json({ success: true, step: 'done', data });
    } catch (error: any) {
      res.status(401).json({ success: false, message: error.message || 'Code MFA invalide' });
    }
  };

  // POST /api/v2/users/auth/mfa/first-setup
  firstMfaSetup = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const decoded = readPendingToken(req, 'pending_mfa_setup');
      const data = await this.mfaUseCase.firstMfaSetup(decoded.userId);
      res.json({ success: true, data });
    } catch (error: any) {
      const msg: string = error.message || 'Erreur';
      const status = msg.includes('introuvable')
        ? 404
        : msg.includes('déjà activé')
          ? 400
          : msg.includes('expirée') || msg.includes('invalide')
            ? 401
            : 500;
      res.status(status).json({ success: false, message: msg });
    }
  };

  // POST /api/v2/users/auth/mfa/first-enable
  firstMfaEnable = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const decoded = readPendingToken(req, 'pending_mfa_setup');
      const { totpCode } = req.body;
      if (!totpCode) {
        res.status(400).json({ success: false, message: 'Code TOTP requis' });
        return;
      }

      const { recoveryCodes } = await this.mfaUseCase.firstMfaEnable(decoded.userId, totpCode);
      const data = issueFinalSession(res, this.tokenService, decoded);
      res.json({ success: true, data: { ...data, recoveryCodes } });
    } catch (error: any) {
      const msg: string = error.message || 'Erreur';
      const status = msg.includes('Aucune configuration')
        ? 400
        : msg.includes('déjà activé')
          ? 400
          : msg.includes('TOTP invalide')
            ? 401
            : 500;
      res.status(status).json({ success: false, message: msg });
    }
  };

  // POST /api/v2/users/auth/reauth
  reauth = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const { password, code } = req.body as { password?: string; code?: string };
      const resultat = await verifierMotDePasseEtMfa(userId, String(password ?? '').trim(), String(code ?? '').trim());
      if (!resultat.ok) {
        const echec = resultat as { ok: false; statusCode: number; message: string };
        res.status(echec.statusCode).json({ success: false, message: echec.message });
        return;
      }
      emettreJetonReauth(res, userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Erreur' });
    }
  };

  // POST /api/v2/auth/logout
  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (user?.userId) {
        await this.deconnecter.execute(user.userId);
      }
      res.clearCookie('access_token', { path: '/' });
      res.clearCookie('refresh_token', { path: '/' });
      res.json({ success: true, message: 'Déconnecté avec succès' });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/auth/refresh
  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken = req.cookies?.refresh_token;
      if (!refreshToken) {
        res.status(401).json({ success: false, message: 'Token de rafraîchissement manquant' });
        return;
      }

      const payload = this.tokenService.verifierRefreshToken(refreshToken) as PayloadToken & {
        refreshTokenVersion: number;
      };
      const tokens = await this.rafraichir.execute(payload);

      res.cookie('access_token', tokens.accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: ACCESS_COOKIE_MAX_AGE_MS,
      });
      res.cookie('refresh_token', tokens.refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: dureeCookieRefreshMs(payload.role),
      });

      res.json({ success: true, message: 'Tokens rafraîchis' });
    } catch (error) {
      res.status(401).json({ success: false, message: 'Session expirée — reconnectez-vous' });
    }
  };
}
