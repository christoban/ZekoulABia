import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { UserRole, StaffPermissionType } from '@domain/types/enums';
import type { TokenService } from '@domain/ports/services/TokenService';

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export const ACCESS_COOKIE_MAX_AGE_MS = process.env.NODE_ENV === 'development'
  ? 7 * 24 * 60 * 60 * 1000 // 7 jours en dev local pour éviter les déconnexions intempestives
  : 12 * 60 * 60 * 1000;   // 12 heures en production

const REFRESH_COOKIE_MAX_AGE_MS_PAR_ROLE: Record<string, number> = {
  ADMIN: 7 * 24 * 60 * 60 * 1000,
  STAFF: 7 * 24 * 60 * 60 * 1000,
  TEACHER: 30 * 24 * 60 * 60 * 1000,
  STUDENT: 30 * 24 * 60 * 60 * 1000,
  PARENT: 30 * 24 * 60 * 60 * 1000,
};
const REFRESH_COOKIE_MAX_AGE_MS_DEFAUT = 7 * 24 * 60 * 60 * 1000;

export function dureeCookieRefreshMs(role: string): number {
  return REFRESH_COOKIE_MAX_AGE_MS_PAR_ROLE[role.toUpperCase()] ?? REFRESH_COOKIE_MAX_AGE_MS_DEFAUT;
}

export const MFA_REQUIRED_ROLES = ['ADMIN', 'STAFF', 'TEACHER'];

export interface PendingLoginPayload {
  userId: string;
  schoolId: string;
  role: string;
  permissions: string[];
  nomComplet: string;
  mustChangePassword: boolean;
  roleMismatch: boolean;
  redirectTo?: string | null;
  tokenType: 'pending_login' | 'pending_mfa' | 'pending_mfa_setup';
}

export function signPendingToken(
  payload: Omit<PendingLoginPayload, 'tokenType'>,
  tokenType: PendingLoginPayload['tokenType'],
  expiresIn: string,
): string {
  return jwt.sign({ ...payload, tokenType }, process.env.JWT_SECRET!, {
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function setPendingCookie(res: Response, token: string, maxAgeMs: number): void {
  res.cookie('pending_login_token', token, { ...COOKIE_OPTIONS, maxAge: maxAgeMs });
}

export function readPendingToken(req: Request, expectedType: PendingLoginPayload['tokenType']): PendingLoginPayload {
  const raw = req.cookies?.pending_login_token;
  if (!raw) throw new Error('Session de connexion expirée. Veuillez recommencer.');
  let decoded: PendingLoginPayload & { exp?: number; iat?: number; nbf?: number };
  try {
    decoded = jwt.verify(raw, process.env.JWT_SECRET!) as PendingLoginPayload & {
      exp?: number;
      iat?: number;
      nbf?: number;
    };
  } catch {
    throw new Error('Session de connexion expirée. Veuillez recommencer.');
  }
  if (decoded.tokenType !== expectedType) {
    throw new Error('Session de connexion invalide. Veuillez recommencer.');
  }
  const { exp, iat, nbf, ...clean } = decoded;
  return clean as PendingLoginPayload;
}

export function issueFinalSession(
  res: Response,
  tokenService: TokenService,
  payload: Omit<PendingLoginPayload, 'tokenType'>,
) {
  const tokens = tokenService.genererTokens({
    userId: payload.userId,
    schoolId: payload.schoolId,
    role: payload.role as UserRole,
    permissions: payload.permissions as StaffPermissionType[],
    tokenType: 'access',
  });
  res.cookie('access_token', tokens.accessToken, { ...COOKIE_OPTIONS, maxAge: ACCESS_COOKIE_MAX_AGE_MS });
  res.cookie('refresh_token', tokens.refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: dureeCookieRefreshMs(payload.role),
  });
  res.clearCookie('pending_login_token', { path: '/' });
  return {
    userId: payload.userId,
    role: payload.role,
    permissions: payload.permissions,
    mustChangePassword: payload.mustChangePassword,
    nomComplet: payload.nomComplet,
    roleMismatch: payload.roleMismatch,
    redirectTo: payload.redirectTo ?? null,
  };
}

export function gererErreurUser(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof Error) {
    if (error.message.includes('existe déjà')) {
      res.status(409).json({ success: false, message: error.message });
      return;
    }
    if (error.message.includes('incorrect') || error.message.includes('expirée')) {
      res.status(401).json({ success: false, message: error.message });
      return;
    }
    if (error.message.includes('refusé')) {
      res.status(403).json({ success: false, message: error.message });
      return;
    }
    if (error.message.includes('introuvable')) {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
  }
  next(error);
}
