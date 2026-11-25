import type { Request, Response, NextFunction } from 'express';
import type { FeeType, InvoiceStatus, UserRole } from '@domain/types/enums';
import type { StaffDirectoryQueryRepository } from '@domain/ports/repositories/StaffDirectoryQueryRepository';

export class StaffDirectoryQueriesController {
  constructor(private readonly repo: StaffDirectoryQueryRepository) {}

  // GET /api/v2/users — liste paginée
  listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { role, classId, page = '1', limit = '50', search } = req.query as Record<string, string>;
      const isAdmin = req.user!.role === 'ADMIN';
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

      if (!isAdmin && role !== 'STUDENT' && req.user!.role !== 'TEACHER') {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
      }

      const { total, users, roleCounts } = await this.repo.listUsers({
        schoolId,
        role: role ? (role as UserRole) : undefined,
        classId,
        search,
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        includeRoleCounts: !role,
      });

      res.json({
        success: true,
        data: users,
        pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) },
        roleCounts,
      });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v2/classes/:id/students-directory — annuaire complet de la classe avec photos pour le secrétariat
  getClassStudentsDirectory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const classId = req.params.id as string;

      const classe = await this.repo.findClassSummary(classId, schoolId);
      if (!classe) {
        res.status(404).json({ success: false, message: 'Classe introuvable' });
        return;
      }

      const users = await this.repo.listClassStudentsDirectory(classId, schoolId);
      const data = users.map((u) => {
        const parentUser = u.studentProfile?.parents?.[0]?.parentProfile?.user;
        return {
          id: u.id,
          userId: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          name: `${u.firstName} ${u.lastName}`.trim(),
          email: u.email,
          phone: u.phone,
          avatarUrl: u.avatarUrl,
          matricule: u.studentProfile?.matricule || u.studentProfile?.numeroInterne || null,
          photoUrl: u.studentProfile?.photoUrl || null,
          gender: u.studentProfile?.gender || null,
          dateOfBirth: u.studentProfile?.dateOfBirth ? u.studentProfile.dateOfBirth.toISOString().split('T')[0] : null,
          className: classe.name,
          parentName: parentUser ? `${parentUser.firstName} ${parentUser.lastName}`.trim() : null,
          parentPhone: parentUser?.phone || null,
          parentEmail: parentUser?.email || null,
          parentHasDevice: Boolean(parentUser?.email || parentUser?.phone),
        };
      });

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  // PATCH /api/v2/students/:id/official-photo — mise à jour de la photo officielle par le secrétariat
  updateStudentOfficialPhoto = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const studentUserId = req.params.id as string;
      const { photoUrl } = req.body as { photoUrl?: string | null };

      const eleve = await this.repo.findStudentForOfficialPhoto(studentUserId, schoolId);
      if (!eleve || !eleve.studentProfile) {
        res.status(404).json({ success: false, message: 'Élève ou profil introuvable dans cet établissement' });
        return;
      }

      let newPhotoUrl: string | null = null;
      if (
        photoUrl &&
        typeof photoUrl === 'string' &&
        (photoUrl.startsWith('data:image/') || photoUrl.startsWith('http://') || photoUrl.startsWith('https://'))
      ) {
        if (photoUrl.length > 3_000_000) {
          res.status(400).json({ success: false, message: 'Photo trop volumineuse (maximum 2 Mo)' });
          return;
        }
        newPhotoUrl = photoUrl;
      } else if (photoUrl !== null && photoUrl !== '') {
        res.status(400).json({ success: false, message: 'Format de photo invalide' });
        return;
      }

      const updatedProfile = await this.repo.updateStudentOfficialPhoto(eleve.studentProfile.id, newPhotoUrl);

      await this.repo.logOfficialPhotoUpdate({
        schoolId,
        actorUserId: req.user!.userId,
        description: `Photo d'identité officielle mise à jour pour l'élève ${eleve.lastName} ${eleve.firstName} (ID: ${eleve.id}) par ${req.user!.role}`,
        studentUserId: eleve.id,
        hasPhoto: Boolean(newPhotoUrl),
      });

      res.json({
        success: true,
        data: { photoUrl: updatedProfile.photoUrl, matricule: updatedProfile.matricule },
      });
    } catch (err) {
      next(err);
    }
  };

  // PATCH /api/v2/school/profile — mise à jour du profil de l'école (ADMIN)
  updateSchoolProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { name, city, phone, email } = req.body as {
        name?: string;
        city?: string;
        phone?: string;
        email?: string;
      };
      const updated = await this.repo.updateSchoolProfile(schoolId, { name, city, phone, email });
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v2/finance/fee-plans?academicYearId= — liste des plans de frais (ADMIN ou STAFF avec MANAGE_FINANCE)
  listFeePlans = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { academicYearId } = req.query as Record<string, string>;
      const plans = await this.repo.listFeePlans(schoolId, academicYearId);
      res.json({ success: true, data: plans });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v2/finance/invoices?status=&feeType=&page= — liste des factures (ADMIN ou STAFF finance)
  listInvoices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      if (req.user!.role === 'STAFF') {
        const perms = await this.repo.getStaffPermissionsByUserId(req.user!.userId);
        if (!perms.includes('MANAGE_FINANCE') && !perms.includes('VALIDATE_PAYMENTS')) {
          res.status(403).json({
            success: false,
            message: 'Permission MANAGE_FINANCE ou VALIDATE_PAYMENTS requise',
          });
          return;
        }
      }

      const { status, feeType, page = '1', limit = '50' } = req.query as Record<string, string>;
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

      const { total, invoices } = await this.repo.listInvoices({
        schoolId,
        status: status ? (status as InvoiceStatus) : undefined,
        feeType: feeType ? (feeType as FeeType) : undefined,
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      });

      res.json({
        success: true,
        data: invoices,
        pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) },
      });
    } catch (err) {
      next(err);
    }
  };
}
