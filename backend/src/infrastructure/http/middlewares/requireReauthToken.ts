import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

/**
 * Jeton de fenêtre de grâce après ré-authentification — Couche 1, PLAN_IMPLEMENTATION_BACKUP.md
 * §1.5. Plutôt qu'une ré-authentification (mot de passe + MFA) à chaque clic, une vérification
 * réussie via `POST /api/v2/users/auth/reauth` (UserController.reauth) ouvre une fenêtre de
 * quelques minutes pendant laquelle plusieurs actions destructives de gravité "complète" peuvent
 * s'enchaîner sans ressaisie. Passé ce délai, ce middleware refuse et redemande la ré-auth.
 *
 * Mécanisme UNIQUE et partagé entre les deux chemins d'exécution (§1.5) : le jeton est un cookie
 * httpOnly posé par le navigateur, donc présent identiquement sur une requête déclenchée par un
 * clic direct OU par l'assistant IA (même requête HTTP `/assistant/execute`, mêmes cookies) —
 * `possedeJetonReauthValide()` est appelée directement par AssistantController pour les actions
 * du catalogue qui l'exigent, sans réimplémentation séparée.
 */

const JWT_SECRET = process.env.JWT_SECRET || 'zekoulabia-secret-change-in-production';
const REAUTH_WINDOW_MINUTES = parseInt(process.env.REAUTH_WINDOW_MINUTES || '10', 10);
export const REAUTH_COOKIE_NAME = 'reauth_token';

interface ReauthPayload {
  userId: string;
  tokenType: 'reauth';
}

export function emettreJetonReauth(res: Response, userId: string): void {
  const token = jwt.sign({ userId, tokenType: 'reauth' } satisfies ReauthPayload, JWT_SECRET, {
    algorithm: 'HS512',
    expiresIn: `${REAUTH_WINDOW_MINUTES}m`,
  });
  res.cookie(REAUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: REAUTH_WINDOW_MINUTES * 60 * 1000,
  });
}

export function possedeJetonReauthValide(req: Request, userId: string): boolean {
  const token = req.cookies?.[REAUTH_COOKIE_NAME];
  if (!token) return false;
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS512'] }) as ReauthPayload;
    return payload.tokenType === 'reauth' && payload.userId === userId;
  } catch {
    return false;
  }
}

export const requireReauthToken = (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, message: 'Non authentifié' });
    return;
  }
  if (!possedeJetonReauthValide(req, userId)) {
    res.status(401).json({
      success: false,
      code: 'REAUTH_REQUIRED',
      message: 'Cette action nécessite une ré-authentification récente (mot de passe + code MFA).',
    });
    return;
  }
  next();
};
