import rateLimit from "express-rate-limit";
import { logMasterAuthAudit } from '../../services/audit/MasterAuthAuditService.ts';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many authentication attempts. Please try again in 15 minutes.",
  },
});

export const masterAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    void logMasterAuthAudit({
      req,
      outcome: "failure",
      reason: "rate_limit_exceeded",
      email: req.body?.email,
    });
    res.status(options.statusCode).json(options.message);
  },
  message: {
    message: "Too many login attempts. Please try again later.",
  },
});

export const masterMfaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many MFA attempts. Please try again later.",
  },
});

export const masterEmailOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many email verification attempts. Please try again later.",
  },
});

export const groupAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many login attempts. Please try again later.",
  },
});

export const groupMfaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many MFA attempts. Please try again later.",
  },
});

export const groupEmailOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many email verification attempts. Please try again later.",
  },
});

export const userEmailOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many email verification attempts. Please try again later.",
  },
});

export const userMfaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many MFA attempts. Please try again later.",
  },
});

export const sensitiveWriteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many requests on sensitive operations. Please retry shortly.",
  },
});

export const resultatsConcoursLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Trop de tentatives de consultation. Veuillez réessayer dans 15 minutes.",
  },
});

