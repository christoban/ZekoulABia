import type { Request, Response, NextFunction } from 'express';
import { CycleResolver } from '@domain/services/CycleResolver';
import type {
  StudentCompletenessRaw,
  StudentPortalQueryRepository,
  StudentProfilePatchData,
} from '@domain/ports/repositories/StudentPortalQueryRepository';

interface ProfileBodyPayload {
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  photoUrl?: string;
}

interface OrientationSummary {
  isEligible: boolean;
  checkpointKey: 'LV2' | 'FIN_TROISIEME' | 'FIN_SECONDE_C' | null;
  title: string | null;
  subtitle: string | null;
}

interface MissingFieldItem {
  key: string;
  labelFr: string;
  labelEn: string;
}

function resolveOrientationCheckpoint(
  activeClass: { name: string; level: string | null; serie: string | null } | null,
  countLv2: number,
): OrientationSummary {
  const levelNorm = (activeClass?.level || '').trim().toLowerCase();
  const nameNorm = (activeClass?.name || '').trim().toLowerCase();
  const serieNorm = (activeClass?.serie || '').trim().toUpperCase();

  let checkpointKey: 'LV2' | 'FIN_TROISIEME' | 'FIN_SECONDE_C' | null = null;
  let title: string | null = null;
  let subtitle: string | null = null;

  const isTroisieme =
    levelNorm === '3e' ||
    levelNorm === '3eme' ||
    nameNorm.startsWith('3e') ||
    nameNorm.startsWith('3ème') ||
    nameNorm.includes(' 3e') ||
    nameNorm.includes(' 3ème') ||
    nameNorm.includes('troisieme') ||
    nameNorm.includes('troisième');

  const isSeconde =
    levelNorm === '2nde' ||
    levelNorm === '2nd' ||
    levelNorm === 'seconde' ||
    nameNorm.startsWith('2nde') ||
    nameNorm.startsWith('2nd') ||
    nameNorm.startsWith('seconde') ||
    nameNorm.includes(' 2nde') ||
    nameNorm.includes(' seconde');

  const isSerieC =
    serieNorm === 'C' ||
    nameNorm.includes(' 2nde c') ||
    nameNorm.includes(' 2nd c') ||
    nameNorm.includes(' 2ndec') ||
    nameNorm.endsWith(' c') ||
    nameNorm.includes('seconde c');

  const isCinquieme =
    levelNorm === '5e' ||
    levelNorm === '5eme' ||
    nameNorm.startsWith('5e') ||
    nameNorm.startsWith('5ème') ||
    nameNorm.includes(' 5e') ||
    nameNorm.includes(' 5ème') ||
    nameNorm.includes('cinquieme') ||
    nameNorm.includes('cinquième');

  const isQuatrieme =
    levelNorm === '4e' ||
    levelNorm === '4eme' ||
    nameNorm.startsWith('4e') ||
    nameNorm.startsWith('4ème') ||
    nameNorm.includes(' 4e') ||
    nameNorm.includes(' 4ème') ||
    nameNorm.includes('quatrieme') ||
    nameNorm.includes('quatrième');

  if (isTroisieme) {
    checkpointKey = 'FIN_TROISIEME';
    title = 'Orientation Fin de 3ème · Vers le Second Cycle';
    subtitle = 'Choix de votre filière pour la classe de Seconde (Seconde A, Seconde C ou Technique)';
  } else if (isSeconde && isSerieC) {
    checkpointKey = 'FIN_SECONDE_C';
    title = 'Orientation Fin de Seconde C · Spécialisation Scientifique';
    subtitle = 'Choix de votre filière de Première (Première C, Première D ou Première TI)';
  } else if (countLv2 > 0 && (isCinquieme || isQuatrieme)) {
    checkpointKey = 'LV2';
    title = 'Orientation Linguistique · Choix de la Langue Vivante 2 (LV2)';
    subtitle = isCinquieme
      ? 'Sélectionnez votre LV2 (Allemand, Espagnol, Chinois, Italien...) pour la classe de 4ème'
      : 'Sélectionnez votre LV2 pour la classe de 3ème';
  }

  return {
    isEligible: checkpointKey !== null,
    checkpointKey,
    title,
    subtitle,
  };
}

function evaluateProfileCompleteness(
  student: StudentCompletenessRaw,
  isSecondCycle: boolean,
): { completenessScore: number; missingFields: MissingFieldItem[] } {
  const missingFields: MissingFieldItem[] = [];
  const totalChecks = 6;
  let filledCount = 0;

  if (student.dateOfBirth) filledCount++;
  else missingFields.push({ key: 'dateOfBirth', labelFr: 'Date de naissance', labelEn: 'Date of birth' });

  if (student.gender) filledCount++;
  else missingFields.push({ key: 'gender', labelFr: 'Sexe / Genre', labelEn: 'Gender' });

  if (student.photoUrl) filledCount++;
  else missingFields.push({ key: 'photoUrl', labelFr: "Photo d'identité", labelEn: 'ID Photo' });

  if (student.user.phone || (student.user.email && !student.user.email.includes('@placeholder'))) filledCount++;
  else missingFields.push({ key: 'phone', labelFr: 'Téléphone de contact', labelEn: 'Contact phone' });

  const hasParent =
    student.parents.length > 0 && student.parents.some((par) => Boolean(par.parentProfile?.user?.phone));
  if (hasParent) filledCount++;
  else missingFields.push({ key: 'parentContact', labelFr: 'Contact parent / urgence', labelEn: 'Parent / emergency contact' });

  if (student.lv2SubjectId || student.pebsFiliere || !isSecondCycle) filledCount++;
  else missingFields.push({ key: 'lv2OrFiliere', labelFr: 'Choix de LV2 ou série', labelEn: 'LV2 or Track choice' });

  return {
    completenessScore: Math.round((filledCount / totalChecks) * 100),
    missingFields,
  };
}

import type { FileStoragePort } from '@domain/ports/services/FileStoragePort';
import {
  parseImageDataUri,
  storeStudentPhoto,
  toStudentPhotoApiUrl,
} from '@application/student/studentPhotoService';
import { respondFileStorageValidationError } from '../helpers/fileStorageHttpHelper';

async function buildStudentProfilePatchData(
  body: ProfileBodyPayload,
  ctx?: { schoolId: string; studentUserId: string; uploadedBy: string; fileStorage?: FileStoragePort },
): Promise<StudentProfilePatchData> {
  const profileData: StudentProfilePatchData = {};
  if (body.dateOfBirth !== undefined) {
    profileData.dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null;
  }
  if (body.gender !== undefined && ['M', 'F', 'HOMME', 'FEMME'].includes(body.gender.toUpperCase())) {
    profileData.gender = body.gender.toUpperCase().startsWith('F') ? 'F' : 'M';
  }
  if (body.photoUrl !== undefined) {
    const raw = typeof body.photoUrl === 'string' ? body.photoUrl.trim() : '';
    if (!raw) {
      profileData.photoUrl = null;
    } else if (raw.startsWith('/api/v2/students/')) {
      // L'URL d'affichage renvoyée par l'API ne doit pas écraser la clé stockée en base.
    } else if (raw.startsWith('data:image/') && ctx?.fileStorage) {
      const parsed = parseImageDataUri(raw);
      if (parsed) {
        const stored = await storeStudentPhoto({
          schoolId: ctx.schoolId,
          studentUserId: ctx.studentUserId,
          uploadedBy: ctx.uploadedBy,
          fileStorage: ctx.fileStorage,
          buffer: parsed.buffer,
          originalName: 'profile-photo',
          declaredMime: parsed.declaredMime,
        });
        profileData.photoUrl = stored.storageKey;
      }
    } else {
      profileData.photoUrl = raw;
    }
  }
  return profileData;
}

export class StudentPortalQueriesController {
  constructor(
    private readonly repo: StudentPortalQueryRepository,
    private readonly fileStorage?: FileStoragePort,
  ) {}

  // GET /api/v2/users/me — infos de l'utilisateur connecté
  getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawUser = await this.repo.findCurrentUserPortalInfo(req.user!.userId);
      if (!rawUser) {
        res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
        return;
      }

      const studentGroupIds = rawUser.studentProfile?.groupMemberships.map((m) => m.groupId) ?? [];
      const targetSchoolId = rawUser.school?.id || req.user!.schoolId;

      if (rawUser.studentProfile?.lv2Subject?.id && targetSchoolId) {
        try {
          const matchingGroup = await this.repo.findLv2StudentGroup(
            rawUser.studentProfile.lv2Subject.id,
            targetSchoolId,
          );
          if (matchingGroup && !studentGroupIds.includes(matchingGroup.id)) {
            studentGroupIds.push(matchingGroup.id);
            await this.repo.syncLv2GroupMembershipAsync(
              rawUser.studentProfile.id,
              matchingGroup.id,
              matchingGroup.groupSetId,
              targetSchoolId,
            );
          }
        } catch {}
      }

      if (rawUser.studentProfile?.pebsFiliere && targetSchoolId) {
        try {
          const pebsGroupId = await this.repo.findPebsStudentGroupId(
            rawUser.studentProfile.pebsFiliere,
            targetSchoolId,
          );
          if (pebsGroupId && !studentGroupIds.includes(pebsGroupId)) {
            studentGroupIds.push(pebsGroupId);
          }
        } catch {}
      }

      const user = {
        ...rawUser,
        studentProfile: rawUser.studentProfile
          ? {
              id: rawUser.studentProfile.id,
              matricule: rawUser.studentProfile.matricule ?? null,
              numeroInterne: rawUser.studentProfile.numeroInterne ?? null,
              dateOfBirth: rawUser.studentProfile.dateOfBirth ?? null,
              gender: rawUser.studentProfile.gender ?? null,
              photoUrl: toStudentPhotoApiUrl(rawUser.studentProfile.photoUrl, rawUser.id),
              healthScore: rawUser.studentProfile.healthScore ?? null,
              pebsFiliere: rawUser.studentProfile.pebsFiliere ?? null,
              lv2Subject: rawUser.studentProfile.lv2Subject ?? null,
              class: rawUser.studentProfile.enrollmentsYearScoped?.[0]?.class ?? null,
              groupIds: studentGroupIds,
            }
          : null,
        classesProfessorPrincipal: rawUser.classesProfessorPrincipal?.map((c) => ({
          id: c.id,
          name: c.name,
          _count: { students: c._count.enrollments },
        })),
      };

      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  };

  // PATCH /api/v2/users/me/avatar — mise à jour de l'avatar du compte utilisateur connecté
  updateMyAvatar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { avatarUrl } = req.body as { avatarUrl?: string | null };

      if (avatarUrl === '' || avatarUrl === null || avatarUrl === undefined) {
        const updated = await this.repo.updateUserAvatar(userId, null);
        res.json({ success: true, data: { avatarUrl: updated.avatarUrl } });
        return;
      }

      if (
        typeof avatarUrl !== 'string' ||
        (!avatarUrl.startsWith('data:image/') && !avatarUrl.startsWith('http://') && !avatarUrl.startsWith('https://'))
      ) {
        res.status(400).json({ success: false, message: "Format d'image invalide (data:image/... ou URL attendue)" });
        return;
      }

      if (avatarUrl.length > 2_000_000) {
        res.status(400).json({ success: false, message: 'Image trop volumineuse (maximum 1.5 Mo)' });
        return;
      }

      const updated = await this.repo.updateUserAvatar(userId, avatarUrl);
      res.json({ success: true, data: { avatarUrl: updated.avatarUrl } });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v2/students/me/profile-completeness — Diagnostic complétude & autorisations
  getMyProfileCompleteness = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const student = await this.repo.findStudentCompletenessData(userId);
      if (!student) {
        res.status(404).json({ success: false, message: 'Profil élève introuvable' });
        return;
      }

      const activeClass = student.enrollmentsYearScoped?.[0]?.class ?? null;
      const cycle = CycleResolver.resolveCycle(activeClass?.name || activeClass?.level || '');
      const isSecondCycle = cycle === 'SECOND_CYCLE';
      const profileManagedBy = isSecondCycle ? 'STUDENT' : 'PARENT';
      const canEdit = isSecondCycle;

      const countLv2 = await this.repo.countLv2Subjects(req.user!.schoolId);
      const orientation = resolveOrientationCheckpoint(activeClass, countLv2);
      const { completenessScore, missingFields } = evaluateProfileCompleteness(student, isSecondCycle);

      res.json({
        success: true,
        data: {
          completenessScore,
          missingCount: missingFields.length,
          missingFields,
          profileManagedBy,
          cycle,
          canEdit,
          orientation,
          student: {
            id: student.id,
            firstName: student.user.firstName,
            lastName: student.user.lastName,
            email: student.user.email,
            phone: student.user.phone,
            dateOfBirth: student.dateOfBirth,
            gender: student.gender,
            photoUrl: toStudentPhotoApiUrl(student.photoUrl, req.user!.userId),
            matricule: student.matricule,
            className: activeClass?.name ?? '—',
            classLevel: activeClass?.level ?? null,
            classSerie: activeClass?.serie ?? null,
            parents: student.parents.map((ps) => ({
              relation: ps.relation,
              name: `${ps.parentProfile.user.firstName} ${ps.parentProfile.user.lastName}`,
              phone: ps.parentProfile.user.phone,
            })),
          },
        },
      });
    } catch (err) {
      next(err);
    }
  };

  // PATCH /api/v2/students/me/profile — Mise à jour autonome (Second cycle uniquement)
  updateMyProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const student = await this.repo.findStudentCycleContextByUserId(userId);
      if (!student) {
        res.status(404).json({ success: false, message: 'Profil élève introuvable' });
        return;
      }

      const activeClass = student.activeClass;
      const cycle = CycleResolver.resolveCycle(activeClass?.name || activeClass?.level || '');
      if (cycle !== 'SECOND_CYCLE') {
        res.status(403).json({
          success: false,
          message:
            'Les élèves du 1er cycle et du primaire ne peuvent pas modifier leur profil directement. Ce dossier est géré par le parent ou le secrétariat.',
        });
        return;
      }

      const body = req.body as ProfileBodyPayload;
      const profileData = await buildStudentProfilePatchData(body, {
        schoolId: req.user!.schoolId,
        studentUserId: userId,
        uploadedBy: userId,
        fileStorage: this.fileStorage,
      });
      await this.repo.updateStudentContactAndProfile({
        userId,
        studentProfileId: student.id,
        phone: body.phone,
        profileData,
      });

      res.json({ success: true, message: 'Profil mis à jour avec succès' });
    } catch (err) {
      if (respondFileStorageValidationError(res, err)) return;
      next(err);
    }
  };

  // PATCH /api/v2/parent/children/:id/profile — Mise à jour par le parent titulaire
  updateChildProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parentUserId = req.user!.userId;
      const studentId = req.params.id as string;

      const parent = await this.repo.findParentProfileByUserId(parentUserId);
      if (!parent) {
        res.status(404).json({ success: false, message: 'Profil parent introuvable' });
        return;
      }

      const link = await this.repo.findParentStudentLink(parent.id, studentId);
      if (!link) {
        res.status(403).json({ success: false, message: "Vous n'avez pas les droits de gestion sur cet élève" });
        return;
      }

      const body = req.body as ProfileBodyPayload;
      const profileData = await buildStudentProfilePatchData(body, {
        schoolId: req.user!.schoolId,
        studentUserId: link.studentUserId,
        uploadedBy: parentUserId,
        fileStorage: this.fileStorage,
      });
      await this.repo.updateStudentContactAndProfile({
        userId: link.studentUserId,
        studentProfileId: link.studentProfileId,
        phone: body.phone,
        profileData,
      });

      res.json({ success: true, message: 'Profil de votre enfant mis à jour avec succès' });
    } catch (err) {
      if (respondFileStorageValidationError(res, err)) return;
      next(err);
    }
  };
}
