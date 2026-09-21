import type { Request, Response, NextFunction } from 'express';
import type { GenererRapportsScolariteUseCase } from '@application/rapports/GenererRapportsScolariteUseCase';

export class RapportsStaffController {
  constructor(private readonly useCase: GenererRapportsScolariteUseCase) {}

  private verifierDroitsRapport(req: Request, res: Response): boolean {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Non authentifié' });
      return false;
    }

    const isAdmin = user.role === 'ADMIN';
    const isStaffAutorise =
      user.role === 'STAFF' &&
      Array.isArray(user.permissions) &&
      (user.permissions.includes('GENERATE_REPORTS') ||
        user.permissions.includes('MANAGE_ENROLLMENT') ||
        user.permissions.includes('MANAGE_STUDENTS'));

    if (!isAdmin && !isStaffAutorise) {
      res.status(403).json({
        success: false,
        message: 'Permission insuffisante pour accéder aux rapports de scolarité',
      });
      return false;
    }

    return true;
  }

  getRapportGlobal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.verifierDroitsRapport(req, res)) return;
      const schoolId = req.user!.schoolId;
      const academicYearId = req.query['academicYearId'] as string | undefined;

      const data = await this.useCase.getRapportGlobal(schoolId, academicYearId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  getEffectifs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.verifierDroitsRapport(req, res)) return;
      const schoolId = req.user!.schoolId;
      const academicYearId = req.query['academicYearId'] as string | undefined;

      const data = await this.useCase.getEffectifs(schoolId, academicYearId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  getDossiersIncomplets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.verifierDroitsRapport(req, res)) return;
      const schoolId = req.user!.schoolId;

      const data = await this.useCase.getDossiersIncomplets(schoolId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  getStatistiquesConcours = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.verifierDroitsRapport(req, res)) return;
      const schoolId = req.user!.schoolId;

      const data = await this.useCase.getStatistiquesConcours(schoolId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  exporterExcel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.verifierDroitsRapport(req, res)) return;
      const schoolId = req.user!.schoolId;
      const academicYearId = req.query['academicYearId'] as string | undefined;

      const buffer = await this.useCase.genererExportExcel(schoolId, academicYearId);

      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `rapport-scolarite-${dateStr}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  };
}
