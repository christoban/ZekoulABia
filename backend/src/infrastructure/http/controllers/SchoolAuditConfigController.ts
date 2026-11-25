import type { Request, Response, NextFunction } from 'express';
import type {
  SchoolAdminQueriesRepository,
  SchoolNotificationSettingsFlags,
  SchoolSecuritySettingsData,
} from '@domain/ports/repositories/SchoolAdminQueriesRepository';
import { buildPreviewClassesFromConfig } from './helpers/schoolStructureSyncHelper';

export class SchoolAuditConfigController {
  constructor(private readonly repo: SchoolAdminQueriesRepository) {}

  // GET /api/v2/schools/:id/configuration/preview
  getConfigurationPreview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.params.id as string;
      if (req.user!.schoolId !== schoolId) {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
      }
      const school = await this.repo.findOnboardingConfig(schoolId);
      if (!school) {
        res.status(404).json({ success: false, message: 'École introuvable' });
        return;
      }

      const cfg = (school.onboardingConfig ?? {}) as Record<string, unknown>;
      const classes = buildPreviewClassesFromConfig(cfg);
      res.json({ success: true, data: { classes, totalClasses: classes.length } });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v2/schools/check-subdomain
  checkSubdomain = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const value = (req.query['value'] as string | undefined)?.trim();
      if (!value) {
        res.status(400).json({ success: false, message: 'Valeur requise' });
        return;
      }
      const taken = await this.repo.isSubdomainTakenByOther(value, req.user!.schoolId);
      res.json({ success: true, available: !taken });
    } catch (err) {
      next(err);
    }
  };

  // PATCH /api/v2/schools/:id/subdomain
  updateSubdomain = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.params['id'] as string;
      if (req.user!.schoolId !== schoolId) {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
      }
      const { newSubdomain } = req.body as { newSubdomain?: string };
      if (!newSubdomain?.trim()) {
        res.status(400).json({ success: false, message: 'Sous-domaine requis' });
        return;
      }
      const v = newSubdomain.trim();
      if (v.length < 3) {
        res.status(400).json({ success: false, message: 'Minimum 3 caractères' });
        return;
      }
      if (v.length > 30) {
        res.status(400).json({ success: false, message: 'Maximum 30 caractères' });
        return;
      }
      if (!/^[a-z0-9-]+$/.test(v)) {
        res.status(400).json({ success: false, message: 'Format invalide : lettres, chiffres et tirets uniquement' });
        return;
      }
      const taken = await this.repo.isSubdomainTakenByOther(v, schoolId);
      if (taken) {
        res.status(400).json({ success: false, message: 'Ce sous-domaine est déjà utilisé' });
        return;
      }
      await this.repo.updateSubdomain(schoolId, v);
      res.json({ success: true, newSubdomain: v });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v2/schools/:id/notification-settings
  getNotificationSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.params['id'] as string;
      if (req.user!.schoolId !== schoolId) {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
      }
      const settings = await this.repo.upsertNotificationSettings(schoolId);
      res.json({ success: true, data: settings });
    } catch (err) {
      next(err);
    }
  };

  // PATCH /api/v2/schools/:id/notification-settings
  updateNotificationSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.params['id'] as string;
      if (req.user!.schoolId !== schoolId) {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
      }
      const { smsAbsences, smsPayments, smsBulletins, emailDigestAdmin, smsLowBalance } = req.body as {
        smsAbsences?: unknown;
        smsPayments?: unknown;
        smsBulletins?: unknown;
        emailDigestAdmin?: unknown;
        smsLowBalance?: unknown;
      };
      const data: Partial<SchoolNotificationSettingsFlags> = {};
      if (smsAbsences !== undefined) data.smsAbsences = Boolean(smsAbsences);
      if (smsPayments !== undefined) data.smsPayments = Boolean(smsPayments);
      if (smsBulletins !== undefined) data.smsBulletins = Boolean(smsBulletins);
      if (emailDigestAdmin !== undefined) data.emailDigestAdmin = Boolean(emailDigestAdmin);
      if (smsLowBalance !== undefined) data.smsLowBalance = Boolean(smsLowBalance);
      const updated = await this.repo.upsertNotificationSettings(schoolId, data);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v2/schools/:id/security-settings
  getSecuritySettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.params['id'] as string;
      if (req.user!.schoolId !== schoolId) {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
      }
      const config = await this.repo.findSecuritySettings(schoolId);
      res.json({
        success: true,
        data: {
          passwordMinLength: config?.passwordMinLength ?? 8,
          passwordRequireUpper: config?.passwordRequireUpper ?? false,
          passwordRequireDigit: config?.passwordRequireDigit ?? true,
          sessionTimeoutMin: config?.sessionTimeoutMin ?? 60,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  // PATCH /api/v2/schools/:id/security-settings
  updateSecuritySettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.params['id'] as string;
      if (req.user!.schoolId !== schoolId) {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
      }
      const { passwordMinLength, passwordRequireUpper, passwordRequireDigit, sessionTimeoutMin } = req.body as {
        passwordMinLength?: unknown;
        passwordRequireUpper?: unknown;
        passwordRequireDigit?: unknown;
        sessionTimeoutMin?: unknown;
      };
      const data: Partial<SchoolSecuritySettingsData> = {};
      if (passwordMinLength !== undefined) {
        const v = parseInt(String(passwordMinLength));
        if (isNaN(v) || v < 6 || v > 16) {
          res.status(400).json({ success: false, message: 'Longueur doit être entre 6 et 16' });
          return;
        }
        data.passwordMinLength = v;
      }
      if (passwordRequireUpper !== undefined) data.passwordRequireUpper = Boolean(passwordRequireUpper);
      if (passwordRequireDigit !== undefined) data.passwordRequireDigit = Boolean(passwordRequireDigit);
      if (sessionTimeoutMin !== undefined) {
        const v = parseInt(String(sessionTimeoutMin));
        if (isNaN(v) || v < 15 || v > 480) {
          res.status(400).json({ success: false, message: 'Timeout doit être entre 15 et 480 minutes' });
          return;
        }
        data.sessionTimeoutMin = v;
      }
      const updated = await this.repo.upsertSecuritySettings(schoolId, data);
      res.json({
        success: true,
        data: {
          passwordMinLength: updated.passwordMinLength ?? 8,
          passwordRequireUpper: updated.passwordRequireUpper ?? false,
          passwordRequireDigit: updated.passwordRequireDigit ?? true,
          sessionTimeoutMin: updated.sessionTimeoutMin ?? 60,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v2/schools/:id/audit-logs
  getAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.params['id'] as string;
      if (req.user!.schoolId !== schoolId) {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
      }
      const page = Math.max(1, parseInt(req.query['page'] as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query['limit'] as string) || 20));
      const action = (req.query['action'] as string | undefined)?.trim();
      const userId = (req.query['userId'] as string | undefined)?.trim();
      const fromDate = (req.query['from'] as string | undefined)?.trim();
      const toDate = (req.query['to'] as string | undefined)?.trim();

      const { logs, total } = await this.repo.findAuditLogs({
        schoolId,
        page,
        limit,
        action,
        userId,
        fromDate,
        toDate,
      });

      res.json({
        success: true,
        logs,
        total,
        page,
        pages: Math.ceil(total / limit),
      });
    } catch (err) {
      next(err);
    }
  };
}
