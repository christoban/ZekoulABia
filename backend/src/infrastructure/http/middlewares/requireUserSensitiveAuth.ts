import { type NextFunction, type Request, type Response } from "express";
import { messageErreur } from '@application/shared/messageErreur';
import bcrypt from "bcryptjs";
import { verifySync } from "otplib";

import { prisma } from '../../../config/prisma.ts';

/**
 * Miroir de masterSensitiveAuth.ts pour les comptes école (ADMIN/STAFF/TEACHER).
 * Exige le mot de passe + (TOTP ou code de récupération) si le MFA est actif sur le compte,
 * avant d'autoriser une action sensible (reconfigurer le MFA, régénérer les codes de récupération).
 */

const extractSensitiveAuthPayload = (req: Request) => {
  const body = req.body || {};
  const nested = body.sensitiveAuth || {};
  return {
    password: String(nested.password ?? body.password ?? "").trim(),
    code: String(nested.code ?? body.code ?? "").trim(),
  };
};

const verifyTotpCode = (token: string, secret: string): boolean => {
  try {
    return verifySync({ token, secret }).valid;
  } catch {
    return false;
  }
};

const verifyRecoveryCode = async (
  candidate: string,
  hashes: string[]
): Promise<{ matched: boolean; updatedHashes: string[] }> => {
  const normalized = candidate.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  for (let i = 0; i < hashes.length; i++) {
    const hash = hashes[i] ?? "";
    if (!hash) continue;
    const matches = await bcrypt.compare(normalized, hash);
    if (matches) {
      const updated = [...hashes];
      updated.splice(i, 1);
      return { matched: true, updatedHashes: updated };
    }
  }
  return { matched: false, updatedHashes: hashes };
};

export type ResultatVerificationSensible =
  | { ok: true }
  | { ok: false; statusCode: number; message: string };

/**
 * Cœur de la vérification mot de passe + MFA/récupération — extrait pour être réutilisé à la
 * fois par le middleware `requireUserSensitiveAuth` (ré-authentification à chaque appel, MFA
 * reconfigure/regen-codes) et par le flux `POST /auth/reauth` (Couche 1, PLAN_IMPLEMENTATION_
 * BACKUP.md §1.5 — délivre un jeton de fenêtre de grâce après une vérification réussie, pour ne
 * pas re-demander mot de passe+MFA à chaque action destructive enchaînée). Même logique, deux
 * façons de la déclencher.
 */
export const verifierMotDePasseEtMfa = async (
  userId: string,
  password: string,
  code: string
): Promise<ResultatVerificationSensible> => {
  if (!password) {
    return { ok: false, statusCode: 400, message: "Mot de passe requis" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      passwordHash: true,
      mfaEnabled: true,
      mfaSecret: true,
      mfaRecoveryCodeHashes: true,
    },
  });

  if (!user || !user.passwordHash) {
    return { ok: false, statusCode: 401, message: "Non autorisé" };
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    return { ok: false, statusCode: 401, message: "Mot de passe incorrect" };
  }

  if (user.mfaEnabled && user.mfaSecret) {
    if (!code) {
      return { ok: false, statusCode: 400, message: "Mot de passe et code MFA/récupération requis" };
    }

    const totpValid = verifyTotpCode(code, user.mfaSecret);
    if (totpValid) return { ok: true };

    if (user.mfaRecoveryCodeHashes.length > 0) {
      const { matched, updatedHashes } = await verifyRecoveryCode(code, user.mfaRecoveryCodeHashes);
      if (matched) {
        await prisma.user.update({
          where: { id: user.id },
          data: { mfaRecoveryCodeHashes: updatedHashes },
        });
        return { ok: true };
      }
    }

    return { ok: false, statusCode: 401, message: "Code MFA invalide" };
  }

  return { ok: true };
};

export const requireUserSensitiveAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ success: false, message: "Non authentifié" });
    }

    const { password, code } = extractSensitiveAuthPayload(req);
    const resultat = await verifierMotDePasseEtMfa(req.user.userId, password, code);
    if (!resultat.ok) {
      const echec = resultat as { ok: false; statusCode: number; message: string };
      return res.status(echec.statusCode).json({ success: false, message: echec.message });
    }
    return next();
  } catch (error) {
    return res.status(500).json({ success: false, message: messageErreur(error) || "Erreur serveur" });
  }
};
