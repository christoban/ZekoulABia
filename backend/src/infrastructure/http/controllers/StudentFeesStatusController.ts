import type { Request, Response, NextFunction } from 'express';
import type { ConsulterStatutFraisEleveUseCase } from '@application/finance/ConsulterStatutFraisEleveUseCase';

export class StudentFeesStatusController {
  constructor(
    private readonly consulterStatutFraisUseCase: ConsulterStatutFraisEleveUseCase,
  ) {}

  consulterStatutFrais = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ success: false, message: 'Non authentifié' });
        return;
      }

      const studentId = String(req.params['id'] || req.params['studentId']);
      if (!studentId) {
        res.status(400).json({ success: false, message: 'Identifiant élève manquant' });
        return;
      }

      // Contrôle RBAC : ADMIN, STAFF avec MANAGE_ENROLLMENT, MANAGE_FINANCE ou VIEW_FINANCE, ou l'élève lui-même
      const isAdmin = user.role === 'ADMIN';
      const isStaffWithPermission =
        user.role === 'STAFF' &&
        Array.isArray(user.permissions) &&
        (user.permissions.includes('MANAGE_ENROLLMENT') ||
          user.permissions.includes('MANAGE_FINANCE') ||
          user.permissions.includes('VIEW_FINANCE'));
      const isSelf = user.role === 'STUDENT' && user.userId === studentId;

      if (!isAdmin && !isStaffWithPermission && !isSelf) {
        res.status(403).json({
          success: false,
          message: 'Permission insuffisante pour consulter l’état des frais de cet élève',
        });
        return;
      }

      const result = await this.consulterStatutFraisUseCase.execute({
        schoolId: user.schoolId,
        studentId,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };
}
