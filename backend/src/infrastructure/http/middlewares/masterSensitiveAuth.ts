import { type NextFunction, type Request, type Response } from "express";
import { messageErreur } from '@application/shared/messageErreur';
import bcrypt from "bcryptjs";
import { verifySync } from "otplib";

import { prisma } from '../../../config/prisma.ts';
import { logMasterAuthAudit } from '../../services/audit/MasterAuthAuditService.ts';

const extractSensitiveAuthPayload = (req: Request) => {
  const body = req.body || {};
  const nested = body.sensitiveAuth || {};
  return {
    password: String(nested.password ?? body.password ?? "").trim(),
    code:     String(nested.code     ?? body.code     ?? "").trim(),
  };
};

const isSixDigitCode = (value: string) => /^\d{6}$/.test(String(value || "").trim());

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

export const requireMasterSensitiveAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.masterUser?.id) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const { password, code } = extractSensitiveAuthPayload(req);

    if (!password) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "sensitive_auth_missing_factors",
        email: req.masterUser?.email,
      });
      return res.status(400).json({ message: "Password is required" });
    }

    const masterUser = await prisma.masterUser.findUnique({
      where: { id: req.masterUser.id },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        mfaEnabled: true,
        mfaSecret: true,
        mfaRecoveryCodeHashes: true,
      },
    });

    if (!masterUser) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "sensitive_auth_user_not_found",
        email: req.masterUser?.email,
      });
      return res.status(401).json({ message: "Not authorized" });
    }

    const passwordOk = await bcrypt.compare(password, masterUser.passwordHash);
    if (!passwordOk) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "sensitive_auth_invalid_password",
        email: masterUser.email,
      });
      return res.status(401).json({ message: "Invalid security verification" });
    }

    if (masterUser.mfaEnabled && masterUser.mfaSecret) {
      if (!code) {
        void logMasterAuthAudit({
          req,
          outcome: "failure",
          reason: "sensitive_auth_missing_factors",
          email: masterUser.email,
        });
        return res.status(400).json({ message: "Password and MFA/recovery code are required" });
      }

      const totpValid = verifyTotpCode(code, masterUser.mfaSecret);
      if (totpValid) {
        void logMasterAuthAudit({
          req,
          outcome: "success",
          reason: "sensitive_auth_passed_totp",
          email: masterUser.email,
        });
        return next();
      }

      if (masterUser.mfaRecoveryCodeHashes.length > 0) {
        const { matched, updatedHashes } = await verifyRecoveryCode(
          code,
          masterUser.mfaRecoveryCodeHashes
        );

        if (matched) {
          await prisma.masterUser.update({
            where: { id: masterUser.id },
            data: { mfaRecoveryCodeHashes: updatedHashes },
          });
          void logMasterAuthAudit({
            req,
            outcome: "success",
            reason: "sensitive_auth_passed_recovery_code",
            email: masterUser.email,
          });
          return next();
        }
      }

      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "sensitive_auth_invalid_mfa_code",
        email: masterUser.email,
      });
      return res.status(401).json({ message: "Invalid MFA code" });
    }

    void logMasterAuthAudit({
      req,
      outcome: "success",
      reason: "sensitive_auth_passed_no_mfa",
      email: masterUser.email,
    });

    return next();
  } catch (error) {
    return res.status(500).json({ message: messageErreur(error) || "Server error" });
  }
};
