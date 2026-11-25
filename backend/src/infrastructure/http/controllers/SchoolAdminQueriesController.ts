import type { Request, Response, NextFunction } from 'express';
import type { SchoolAdminQueriesRepository } from '@domain/ports/repositories/SchoolAdminQueriesRepository';
import type { ObtenirAnomaliesEtablissementUseCase } from '@application/school/ObtenirAnomaliesEtablissementUseCase';
import { getTemplateMeta } from '@application/school/schoolTemplateConfig';
import { getStaffTitlesForTemplate } from '@domain/rules/StaffPermissionRules';
import { getLatestSchoolBackup } from '@infrastructure/backup/SchoolBackupService';

export class SchoolAdminQueriesController {
  constructor(
    private readonly repo: SchoolAdminQueriesRepository,
    private readonly obtenirAnomaliesUseCase: ObtenirAnomaliesEtablissementUseCase,
  ) {}

  // GET /api/v2/school/me
  getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const school = await this.repo.findSchoolMe(schoolId);
      if (!school) {
        res.status(404).json({ success: false, message: 'École introuvable' });
        return;
      }
      // isPrimaire pilote l-affichage MINESEC (secondaire) vs MINEDUB (maternelle/primaire)
      // dans la sidebar admin — les deux menus etaient affiches sans distinction jusqu-ici.
      // templateCode absent (écoles créées avant l-introduction du champ, ou artefacts de
      // tests) : on ne devine pas "secondaire" par défaut, on renvoie null pour que le
      // frontend garde les deux menus visibles plutôt que d-en masquer un à tort. Même repli
      // pour COMPLEXE_SCOLAIRE : une école multi-cycles a des élèves des deux types, donc les
      // deux menus doivent rester visibles plutôt que d'en masquer un.
      const isPrimaire = school.templateCode && school.templateCode !== 'COMPLEXE_SCOLAIRE'
        ? getTemplateMeta(school.templateCode).isPrimaire
        : null;
      res.json({ success: true, data: { ...school, isPrimaire } });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v2/school/anomalies
  getAnomalies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const anomalies = await this.obtenirAnomaliesUseCase.execute({
        schoolId: req.user!.schoolId,
        userId: req.user!.userId,
      });
      res.json({ success: true, data: anomalies });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v2/school/last-backup
  getLastBackup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const settings = await this.repo.findLastBackupSettings(schoolId);
      const latest = await getLatestSchoolBackup(schoolId);
      res.json({
        success: true,
        data: {
          lastBackupAt: settings?.lastBackupAt ?? latest?.createdAt ?? null,
          lastBackupFile: settings?.lastBackupFile ?? latest?.filePath ?? null,
          latestFileExists: Boolean(settings?.lastBackupFile || latest),
        },
      });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v2/school/export
  exportData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const bundle = await this.repo.findExportBundle(schoolId);
      if (!bundle) {
        res.status(404).json({ success: false, message: 'École introuvable' });
        return;
      }

      const exportedAt = new Date().toISOString().replace(/[:.]/g, '-');
      const safeName = bundle.schoolName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'ecole';

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}-rgpd-${exportedAt}.json"`);
      res.send(JSON.stringify({
        success: true,
        data: {
          exportedAt: new Date().toISOString(),
          schoolId,
          schoolName: bundle.schoolName,
          export: bundle.exportPayload,
        },
      }, null, 2));
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v2/school/staff-titles
  getStaffTitles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const school = await this.repo.findTemplateAndOnboarding(req.user!.schoolId);
      const onboardingConfig = school?.onboardingConfig as Record<string, unknown> | null | undefined;
      const templateCode = school?.templateCode
        ?? (onboardingConfig?.templateCode as string | undefined)
        ?? undefined;
      const meta = getTemplateMeta(templateCode);
      const titles = getStaffTitlesForTemplate(meta, templateCode);
      res.json({ success: true, data: titles });
    } catch (err) {
      next(err);
    }
  };

  // PATCH /api/v2/school/logo
  updateLogo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { logoBase64 } = req.body as { logoBase64?: string };
      // Suppression si chaîne vide
      if (logoBase64 === '' || logoBase64 === null || logoBase64 === undefined) {
        const school = await this.repo.updateLogo(schoolId, null);
        res.json({ success: true, data: { logoUrl: school.logoUrl } });
        return;
      }
      if (!logoBase64.startsWith('data:image/')) {
        res.status(400).json({ success: false, message: 'Format de logo invalide. Envoyez une image en base64.' });
        return;
      }
      if (logoBase64.length > 2_000_000) {
        res.status(400).json({ success: false, message: 'Logo trop volumineux (max 1.5 MB).' });
        return;
      }
      const school = await this.repo.updateLogo(schoolId, logoBase64);
      res.json({ success: true, data: { logoUrl: school.logoUrl } });
    } catch (err) {
      next(err);
    }
  };

  // PATCH /api/v2/school/profile
  updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { name, city, phone, email, minesecSchoolCode } = req.body as {
        name?: string;
        city?: string;
        phone?: string;
        email?: string;
        minesecSchoolCode?: string;
      };
      const data: {
        name?: string;
        city?: string;
        phone?: string;
        email?: string;
        minesecSchoolCode?: string;
      } = {};
      if (name) data.name = name;
      if (city) data.city = city;
      if (phone) data.phone = phone;
      if (email) data.email = email;
      if (minesecSchoolCode !== undefined) data.minesecSchoolCode = minesecSchoolCode.trim();
      const school = await this.repo.updateProfile(schoolId, data);
      res.json({ success: true, data: school });
    } catch (err) {
      next(err);
    }
  };
}
