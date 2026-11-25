import type { Request, Response, NextFunction } from 'express';
import type { FeeType, InvoiceStatus, UserRole } from '@domain/types/enums';
import type { StaffDirectoryQueryRepository } from '@domain/ports/repositories/StaffDirectoryQueryRepository';
import type { ParentRepository } from '@domain/ports/repositories/ParentRepository';
import type { FileStoragePort } from '@domain/ports/services/FileStoragePort';
import {
  parseImageDataUri,
  storeStudentPhoto,
  toStudentPhotoApiUrl,
} from '@application/student/studentPhotoService';
import { detectMimeTypeByMagicBytes } from '@domain/services/storage/fileStorageValidation';
import {
  resolveScopedStorageKeyOrRespond,
  respondFileStorageValidationError,
} from '../helpers/fileStorageHttpHelper';

export class StaffDirectoryQueriesController {
  constructor(
    private readonly repo: StaffDirectoryQueryRepository,
    private readonly fileStorage: FileStoragePort,
    private readonly parentRepository?: ParentRepository,
  ) {}

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

      const mappedUsers = users.map((u) => {
        if (!u.studentProfile) return u;
        return {
          ...u,
          studentProfile: {
            ...u.studentProfile,
            photoUrl: toStudentPhotoApiUrl(u.studentProfile.photoUrl, u.id),
          },
        };
      });

      res.json({
        success: true,
        data: mappedUsers,
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
          photoUrl: toStudentPhotoApiUrl(u.studentProfile?.photoUrl, u.id),
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
      const { photoUrl } = (req.body ?? {}) as { photoUrl?: string | null };
      const uploadedFile = req.file as Express.Multer.File | undefined;

      const eleve = await this.repo.findStudentForOfficialPhoto(studentUserId, schoolId);
      if (!eleve || !eleve.studentProfile) {
        res.status(404).json({ success: false, message: 'Élève ou profil introuvable dans cet établissement' });
        return;
      }

      let newPhotoRef: string | null = null;
      let storedInFileStorage = false;

      if (uploadedFile) {
        const stored = await storeStudentPhoto({
          schoolId,
          studentUserId: eleve.id,
          uploadedBy: req.user!.userId,
          fileStorage: this.fileStorage,
          buffer: uploadedFile.buffer,
          originalName: uploadedFile.originalname,
          declaredMime: uploadedFile.mimetype,
        });
        newPhotoRef = stored.storageKey;
        storedInFileStorage = true;
      } else if (photoUrl && typeof photoUrl === 'string' && photoUrl.startsWith('data:image/')) {
        const parsed = parseImageDataUri(photoUrl);
        if (!parsed) {
          res.status(400).json({ success: false, message: 'Format de photo invalide' });
          return;
        }
        const stored = await storeStudentPhoto({
          schoolId,
          studentUserId: eleve.id,
          uploadedBy: req.user!.userId,
          fileStorage: this.fileStorage,
          buffer: parsed.buffer,
          originalName: 'official-photo',
          declaredMime: parsed.declaredMime,
        });
        newPhotoRef = stored.storageKey;
        storedInFileStorage = true;
      } else if (photoUrl && typeof photoUrl === 'string' && (photoUrl.startsWith('http://') || photoUrl.startsWith('https://'))) {
        newPhotoRef = photoUrl;
      } else if (photoUrl !== null && photoUrl !== '' && photoUrl !== undefined) {
        res.status(400).json({ success: false, message: 'Format de photo invalide' });
        return;
      }

      const updatedProfile = await this.repo.updateStudentOfficialPhoto(eleve.studentProfile.id, newPhotoRef);

      await this.repo.logOfficialPhotoUpdate({
        schoolId,
        actorUserId: req.user!.userId,
        description: `Photo d'identité officielle mise à jour pour l'élève ${eleve.lastName} ${eleve.firstName} (ID: ${eleve.id}) par ${req.user!.role}`,
        studentUserId: eleve.id,
        hasPhoto: Boolean(newPhotoRef),
      });

      const responsePhotoUrl = storedInFileStorage
        ? `/api/v2/students/${encodeURIComponent(eleve.id)}/photo?v=${Date.now()}`
        : toStudentPhotoApiUrl(updatedProfile.photoUrl, eleve.id);

      res.json({
        success: true,
        data: {
          photoUrl: responsePhotoUrl,
          storageKey: storedInFileStorage ? newPhotoRef : undefined,
          matricule: updatedProfile.matricule,
        },
      });
    } catch (err) {
      if (
        respondFileStorageValidationError(res, err, {
          invalidFormatMessage: 'Format de photo invalide (PNG, JPG ou WebP uniquement)',
          tooLargeMessage: 'Photo trop volumineuse (maximum 3 Mo)',
        })
      ) {
        return;
      }
      next(err);
    }
  };

  // GET /api/v2/students/:id/photo — lecture authentifiée (FileStoragePort + rétrocompatibilité data:)
  getStudentPhoto = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const schoolId = user.schoolId;
      const studentUserId = String(req.params.id);
      const role = String(user.role).toUpperCase();

      if (role === 'STUDENT' && user.userId !== studentUserId) {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
      }
      if (role === 'PARENT') {
        if (!this.parentRepository || !(await this.parentRepository.aAccesEleve(user.userId, studentUserId))) {
          res.status(403).json({ success: false, message: 'Accès refusé' });
          return;
        }
      }

      const eleve = await this.repo.findStudentForOfficialPhoto(studentUserId, schoolId);
      const rawPhoto = eleve?.studentProfile?.photoUrl?.trim();
      if (!eleve || !rawPhoto) {
        res.status(404).json({ success: false, message: 'Photo introuvable' });
        return;
      }

      // Rétrocompatibilité : ancienne photo stockée en Data URI Base64 dans PostgreSQL
      if (rawPhoto.startsWith('data:image/')) {
        const parsed = parseImageDataUri(rawPhoto);
        if (!parsed) {
          res.status(404).json({ success: false, message: 'Photo corrompue ou introuvable' });
          return;
        }
        const mime = detectMimeTypeByMagicBytes(parsed.buffer) ?? parsed.declaredMime ?? 'image/jpeg';
        res.setHeader('Content-Type', mime);
        res.setHeader('Cache-Control', 'private, max-age=300');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.send(parsed.buffer);
        return;
      }

      const validKey = resolveScopedStorageKeyOrRespond(
        res,
        rawPhoto,
        schoolId,
        'Photo élève indisponible sur le stockage.',
      );
      if (!validKey) return;

      const stored = await this.fileStorage.get(validKey);
      if (!stored) {
        res.status(404).json({ success: false, message: 'Photo introuvable sur le stockage' });
        return;
      }

      const mime = stored.contentType ?? detectMimeTypeByMagicBytes(stored.buffer) ?? 'image/jpeg';
      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.send(stored.buffer);
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
