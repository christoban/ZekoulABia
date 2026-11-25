import { type NextFunction, type Request, type Response } from "express";
import { logMasterAuthAudit } from '../../services/audit/MasterAuthAuditService.ts';

const normalizeIp = (value?: string | null) => {
  if (!value) return "";
  const trimmed = value.trim();

  // Support IPv4 mapped format such as ::ffff:127.0.0.1
  if (trimmed.startsWith("::ffff:")) {
    return trimmed.replace("::ffff:", "");
  }

  return trimmed;
};

const getClientIp = (req: Request) => {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.length > 0) {
    const first = forwarded.split(",")[0];
    return normalizeIp(first);
  }

  return normalizeIp(req.ip || req.socket.remoteAddress || "");
};

const getAllowedIps = () => {
  const raw = process.env.MASTER_LOGIN_IP_ALLOWLIST?.trim();
  if (!raw) return [];

  return raw
    .split(",")
    .map((item) => normalizeIp(item))
    .filter(Boolean);
};

// Optional hardening layer for the master login endpoint.
// If MASTER_LOGIN_IP_ALLOWLIST is not provided, middleware is transparent.
export const restrictMasterLoginByIp = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const allowedIps = getAllowedIps();

  if (allowedIps.length === 0) {
    return next();
  }

  const clientIp = getClientIp(req);

  if (!clientIp || !allowedIps.includes(clientIp)) {
    void logMasterAuthAudit({
      req,
      outcome: "failure",
      reason: "ip_not_allowlisted",
      email: req.body?.email,
    });
    return res.status(404).json({ message: "Not found" });
  }

  return next();
};
