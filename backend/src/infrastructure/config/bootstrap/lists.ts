import type { Application } from 'express';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { creerContainer } from '@infrastructure/config/container';
import { requireAuth, requireRole } from '../../http/middlewares/auth';
import { getTemplateMeta } from '@application/school/schoolTemplateConfig';
import { isNiveauPrimaireOuMaternelle } from '../../../lib/classSerieValidator';
import { CYCLE2_LEVELS as SYNC_CYCLE2_LEVELS, parseSerie as syncParseSerie } from '@application/school/SubjectAssignmentHelper';
import { whereElevesParClasse } from '@application/shared/studentEnrollment';
import { CycleResolver } from '../../../domain/services/CycleResolver';


type Container = ReturnType<typeof creerContainer>;

export function registerListsRoutes(app: Application, p: typeof prisma = prisma, c: Container): void {
  // ── GET list endpoints (Prisma direct, thin routes) ─────────────────────

  // GET /api/v2/users — liste paginée
  app.get('/api/v2/users', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { role, classId, page = '1', limit = '50', search } = req.query as Record<string, string>;
      const isAdmin = req.user!.role === 'ADMIN';
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const where: any = {
        schoolId,
        ...(role ? { role } : {}),
        ...(classId && role === 'STUDENT' ? whereElevesParClasse(classId) : {}),
        ...(search ? { OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ] } : {}),
      };
      if (!isAdmin && role !== 'STUDENT' && req.user!.role !== 'TEACHER') {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
      }
      const [total, rawUsers, roleGroups] = await Promise.all([
        p.user.count({ where }),
        p.user.findMany({
          where,
          select: {
            id: true, firstName: true, lastName: true, email: true, role: true, avatarUrl: true,
            isActive: true, lastLogin: true, createdAt: true,
            studentProfile: {
              select: {
                id: true, dateOfBirth: true, gender: true, photoUrl: true, matricule: true,
                enrollmentsYearScoped: {
                  where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
                  select: { classId: true, class: { select: { name: true } } },
                  take: 1,
                },
              },
            },
            staffProfile: { select: { title: true } },
            teacherProfile: {
              select: {
                teacherSubjects: {
                  select: { subjectId: true, subject: { select: { name: true } } },
                },
              },
            },
            classesProfessorPrincipal: { select: { id: true, name: true } },
          },
          orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
        // Counts per role (sans filtre rôle seulement, pour l'affichage des onglets)
        !role
          ? p.user.groupBy({ by: ['role'], where: { schoolId }, _count: { id: true } })
          : Promise.resolve(null),
      ]);

      // Mapper pour préserver le contrat API (studentProfile.classId + studentProfile.class.name)
      const users = rawUsers.map(u => {
        if (!u.studentProfile) return u;
        const enrollment = u.studentProfile.enrollmentsYearScoped?.[0];
        const { enrollmentsYearScoped: _enr, ...profileRest } = u.studentProfile;
        return {
          ...u,
          studentProfile: {
            ...profileRest,
            classId: enrollment?.classId ?? null,
            class: enrollment?.class ?? null,
          },
        };
      });

      const roleCounts = roleGroups
        ? Object.fromEntries(roleGroups.map(g => [g.role, g._count.id]))
        : undefined;
      res.json({ success: true, data: users, pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) }, roleCounts });
    } catch (err) { next(err); }
  });

  // GET /api/v2/users/me — infos de l'utilisateur connecté
  app.get('/api/v2/users/me', requireAuth, async (req, res, next) => {
    try {
      const rawUser = await p.user.findUnique({
        where: { id: req.user!.userId },
        select: {
          id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true, role: true, isActive: true,
          school: {
            select: { id: true, name: true, subdomain: true, type: true, ownership: true },
          },
          teacherProfile: {
            select: {
              id: true, specialization: true,
              teacherSubjects: { select: { subject: { select: { id: true, name: true } } } },
            },
          },
          studentProfile: {
            select: {
              id: true,
              matricule: true,
              numeroInterne: true,
              dateOfBirth: true,
              gender: true,
              photoUrl: true,
              healthScore: true,
              pebsFiliere: true,
              lv2Subject: { select: { id: true, name: true } },
              enrollmentsYearScoped: {
                where: { status: 'ACTIVE' },
                orderBy: { createdAt: 'desc' },
                select: { class: { select: { id: true, name: true, level: true, serie: true, filiere: true } } },
                take: 1,
              },
              groupMemberships: {
                where: { academicYear: { isCurrent: true } },
                select: { groupId: true },
              },
            },
          },
          staffProfile: { select: { id: true, title: true } },
          classesProfessorPrincipal: {
            select: {
              id: true, name: true,
              _count: {
                select: {
                  enrollments: {
                    where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
                  },
                },
              },
            },
          },
          headedDepartments: { select: { id: true, name: true, color: true, subjects: { select: { id: true, name: true } } } },
        },
      });

      if (!rawUser) { res.status(404).json({ success: false, message: 'Utilisateur introuvable' }); return; }

      // Mapper pour préserver le contrat API
      const user = {
        ...rawUser,
        studentProfile: rawUser.studentProfile
          ? {
               id: rawUser.studentProfile.id,
               matricule: rawUser.studentProfile.matricule ?? null,
               numeroInterne: rawUser.studentProfile.numeroInterne ?? null,
               dateOfBirth: rawUser.studentProfile.dateOfBirth ?? null,
               gender: rawUser.studentProfile.gender ?? null,
               photoUrl: rawUser.studentProfile.photoUrl ?? null,
               healthScore: rawUser.studentProfile.healthScore ?? null,
               pebsFiliere: rawUser.studentProfile.pebsFiliere ?? null,
               lv2Subject: rawUser.studentProfile.lv2Subject ?? null,
               class: rawUser.studentProfile.enrollmentsYearScoped?.[0]?.class ?? null,
               groupIds: rawUser.studentProfile.groupMemberships.map(membership => membership.groupId),
             }
          : null,
        classesProfessorPrincipal: rawUser.classesProfessorPrincipal?.map(c => ({
          id: c.id,
          name: c.name,
          _count: { students: c._count.enrollments }, // préserve la clé "students" pour le frontend
        })),
      };

      res.json({ success: true, data: user });
    } catch (err) { next(err); }
  });

  // ── GET /api/v2/students/me/profile-completeness — Diagnostic complétude & autorisations ──
  app.get('/api/v2/students/me/profile-completeness', requireAuth, requireRole('STUDENT'), async (req, res, next) => {
    try {
      const userId = req.user!.userId;
      const student = await p.studentProfile.findUnique({
        where: { userId },
        include: {
          user: { select: { firstName: true, lastName: true, email: true, phone: true } },
          enrollmentsYearScoped: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            select: { class: { select: { id: true, name: true, level: true, serie: true, filiere: true } } },
            take: 1,
          },
          parents: {
            include: {
              parentProfile: {
                include: { user: { select: { firstName: true, lastName: true, phone: true } } },
              },
            },
          },
          lv2Subject: { select: { id: true, name: true } },
        },
      });

      if (!student) {
        res.status(404).json({ success: false, message: 'Profil élève introuvable' });
        return;
      }

      const activeClass = student.enrollmentsYearScoped?.[0]?.class ?? null;
      const cycle = CycleResolver.resolveCycle(activeClass?.name || activeClass?.level || '');
      const isSecondCycle = cycle === 'SECOND_CYCLE';
      const profileManagedBy = isSecondCycle ? 'STUDENT' : 'PARENT';
      const canEdit = isSecondCycle;

      // Résolution du palier d'orientation éligible selon les règles officielles
      const countLv2 = await p.subject.count({ where: { schoolId: req.user!.schoolId, isLV2: true } });
      const levelNorm = (activeClass?.level || '').trim().toLowerCase();
      const nameNorm = (activeClass?.name || '').trim().toLowerCase();
      const serieNorm = (activeClass?.serie || '').trim().toUpperCase();

      let orientationCheckpoint: 'LV2' | 'FIN_TROISIEME' | 'FIN_SECONDE_C' | null = null;
      let orientationTitle: string | null = null;
      let orientationSubtitle: string | null = null;

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
        orientationCheckpoint = 'FIN_TROISIEME';
        orientationTitle = 'Orientation Fin de 3ème · Vers le Second Cycle';
        orientationSubtitle = 'Choix de votre filière pour la classe de Seconde (Seconde A, Seconde C ou Technique)';
      } else if (isSeconde && isSerieC) {
        orientationCheckpoint = 'FIN_SECONDE_C';
        orientationTitle = 'Orientation Fin de Seconde C · Spécialisation Scientifique';
        orientationSubtitle = 'Choix de votre filière de Première (Première C, Première D ou Première TI)';
      } else if (countLv2 > 0 && (isCinquieme || isQuatrieme)) {
        orientationCheckpoint = 'LV2';
        orientationTitle = 'Orientation Linguistique · Choix de la Langue Vivante 2 (LV2)';
        orientationSubtitle = isCinquieme
          ? 'Sélectionnez votre LV2 (Allemand, Espagnol, Chinois, Italien...) pour la classe de 4ème'
          : 'Sélectionnez votre LV2 pour la classe de 3ème';
      }

      // Diagnostic des champs requis
      const missingFields: { key: string; labelFr: string; labelEn: string }[] = [];
      const totalChecks = 6;
      let filledCount = 0;

      // 1. Date de naissance
      if (student.dateOfBirth) filledCount++;
      else missingFields.push({ key: 'dateOfBirth', labelFr: 'Date de naissance', labelEn: 'Date of birth' });

      // 2. Genre / Sexe
      if (student.gender) filledCount++;
      else missingFields.push({ key: 'gender', labelFr: 'Sexe / Genre', labelEn: 'Gender' });

      // 3. Photo d'identité
      if (student.photoUrl) filledCount++;
      else missingFields.push({ key: 'photoUrl', labelFr: 'Photo d\'identité', labelEn: 'ID Photo' });

      // 4. Contact élève (téléphone ou email)
      if (student.user.phone || (student.user.email && !student.user.email.includes('@placeholder'))) filledCount++;
      else missingFields.push({ key: 'phone', labelFr: 'Téléphone de contact', labelEn: 'Contact phone' });

      // 5. Contact d'urgence / Parent
      const hasParent = student.parents.length > 0 && student.parents.some(par => Boolean(par.parentProfile?.user?.phone));
      if (hasParent) filledCount++;
      else missingFields.push({ key: 'parentContact', labelFr: 'Contact parent / urgence', labelEn: 'Parent / emergency contact' });

      // 6. Choix de langue / filière (selon cycle)
      if (student.lv2SubjectId || student.pebsFiliere || !isSecondCycle) filledCount++;
      else missingFields.push({ key: 'lv2OrFiliere', labelFr: 'Choix de LV2 ou série', labelEn: 'LV2 or Track choice' });

      const completenessScore = Math.round((filledCount / totalChecks) * 100);

      res.json({
        success: true,
        data: {
          completenessScore,
          missingCount: missingFields.length,
          missingFields,
          profileManagedBy,
          cycle,
          canEdit,
          orientation: {
            isEligible: orientationCheckpoint !== null,
            checkpointKey: orientationCheckpoint,
            title: orientationTitle,
            subtitle: orientationSubtitle,
          },
          student: {
            id: student.id,
            firstName: student.user.firstName,
            lastName: student.user.lastName,
            email: student.user.email,
            phone: student.user.phone,
            dateOfBirth: student.dateOfBirth,
            gender: student.gender,
            photoUrl: student.photoUrl,
            matricule: student.matricule,
            className: activeClass?.name ?? '—',
            classLevel: activeClass?.level ?? null,
            classSerie: activeClass?.serie ?? null,
            parents: student.parents.map(ps => ({
              relation: ps.relation,
              name: `${ps.parentProfile.user.firstName} ${ps.parentProfile.user.lastName}`,
              phone: ps.parentProfile.user.phone,
            })),
          },
        },
      });
    } catch (err) { next(err); }
  });

  // ── PATCH /api/v2/students/me/profile — Mise à jour autonome (Second cycle uniquement) ──
  app.patch('/api/v2/students/me/profile', requireAuth, requireRole('STUDENT'), async (req, res, next) => {
    try {
      const userId = req.user!.userId;
      const student = await p.studentProfile.findUnique({
        where: { userId },
        include: {
          enrollmentsYearScoped: {
            where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
            select: { class: { select: { name: true, level: true } } },
            take: 1,
          },
        },
      });

      if (!student) {
        res.status(404).json({ success: false, message: 'Profil élève introuvable' });
        return;
      }

      const activeClass = student.enrollmentsYearScoped?.[0]?.class ?? null;
      const cycle = CycleResolver.resolveCycle(activeClass?.name || activeClass?.level || '');
      if (cycle !== 'SECOND_CYCLE') {
        res.status(403).json({
          success: false,
          message: 'Les élèves du 1er cycle et du primaire ne peuvent pas modifier leur profil directement. Ce dossier est géré par le parent ou le secrétariat.',
        });
        return;
      }

      const { phone, dateOfBirth, gender, photoUrl } = req.body as {
        phone?: string;
        dateOfBirth?: string;
        gender?: string;
        photoUrl?: string;
      };

      if (phone !== undefined) {
        await p.user.update({
          where: { id: userId },
          data: { phone: phone || null },
        });
      }

      const profileData: any = {};
      if (dateOfBirth !== undefined) {
        profileData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
      }
      if (gender !== undefined && ['M', 'F', 'HOMME', 'FEMME'].includes(gender.toUpperCase())) {
        profileData.gender = gender.toUpperCase().startsWith('F') ? 'F' : 'M';
      }
      if (photoUrl !== undefined) {
        profileData.photoUrl = photoUrl || null;
      }

      if (Object.keys(profileData).length > 0) {
        await p.studentProfile.update({
          where: { id: student.id },
          data: profileData,
        });
      }

      res.json({ success: true, message: 'Profil mis à jour avec succès' });
    } catch (err) { next(err); }
  });

  // ── PATCH /api/v2/parent/children/:id/profile — Mise à jour par le parent titulaire ──
  app.patch('/api/v2/parent/children/:id/profile', requireAuth, requireRole('PARENT'), async (req, res, next) => {
    try {
      const parentUserId = req.user!.userId;
      const studentId = req.params.id;

      const parent = await p.parentProfile.findUnique({
        where: { userId: parentUserId },
        select: { id: true },
      });
      if (!parent) {
        res.status(404).json({ success: false, message: 'Profil parent introuvable' });
        return;
      }

      const link = await p.parentStudent.findFirst({
        where: {
          parentProfileId: parent.id,
          OR: [{ studentProfileId: studentId }, { studentProfile: { userId: studentId } }],
        },
        include: { studentProfile: true },
      });

      if (!link) {
        res.status(403).json({ success: false, message: 'Vous n\'avez pas les droits de gestion sur cet élève' });
        return;
      }

      const { phone, dateOfBirth, gender, photoUrl } = req.body;
      const targetStudentProfileId = link.studentProfileId;
      const targetUserId = link.studentProfile.userId;

      if (phone !== undefined) {
        await p.user.update({
          where: { id: targetUserId },
          data: { phone: phone || null },
        });
      }

      const profileData: any = {};
      if (dateOfBirth !== undefined) {
        profileData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
      }
      if (gender !== undefined && ['M', 'F', 'HOMME', 'FEMME'].includes(gender.toUpperCase())) {
        profileData.gender = gender.toUpperCase().startsWith('F') ? 'F' : 'M';
      }
      if (photoUrl !== undefined) {
        profileData.photoUrl = photoUrl || null;
      }

      if (Object.keys(profileData).length > 0) {
        await p.studentProfile.update({
          where: { id: targetStudentProfileId },
          data: profileData,
        });
      }

      res.json({ success: true, message: 'Profil de votre enfant mis à jour avec succès' });
    } catch (err) { next(err); }
  });

  // GET /api/v2/classes — classes visibles selon le rôle
  //   TEACHER → uniquement les classes où il a un TeachingAssignment ou est professeur principal
  //   Autres  → toutes les classes de l'école
  app.get('/api/v2/classes', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const userId   = req.user!.userId;
      const role     = req.user!.role;

      let whereClause: any = { schoolId };

      if (role === 'TEACHER') {
        const assignments = await p.teachingAssignment.findMany({
          where: { teacherId: userId, schoolId },
          select: { classId: true },
          distinct: ['classId'],
        });
        const assignedClassIds = assignments.map((a) => a.classId);
        whereClause = {
          schoolId,
          OR: [
            { id: { in: assignedClassIds } },
            { professorPrincipalId: userId },
          ],
        };
      }

      const classes = await p.class.findMany({
        where: whereClause,
        include: {
          professorPrincipal: { select: { id: true, firstName: true, lastName: true } },
          _count: {
            select: {
              enrollments: {
                where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      // Le niveau RÉEL de chaque classe (Class.level) tranche en priorité — nécessaire pour
      // COMPLEXE_SCOLAIRE où primaire et secondaire coexistent dans la même école. Repli sur le
      // template de l'école si le niveau n'est pas reconnu (inchangé pour tout établissement
      // mono-cycle, où toutes les classes ont de toute façon le même cycle).
      const ecole = await p.school.findUnique({ where: { id: schoolId }, select: { templateCode: true } });
      const ecoleEstPrimaire = getTemplateMeta(ecole?.templateCode).isPrimaire;
      const cycleDeClasse = (level: string | null | undefined): 'primaire' | 'secondaire' =>
        isNiveauPrimaireOuMaternelle(level) ? 'primaire' : (ecoleEstPrimaire ? 'primaire' : 'secondaire');

      // Nombre d'élèves PEBS par classe (une seule requête groupée via Enrollment)
      const classIds = classes.map(c => c.id);
      const pebsCounts = classIds.length > 0
        ? await p.enrollment.groupBy({
            by: ['classId'],
            where: {
              classId: { in: classIds },
              status: 'ACTIVE',
              academicYear: { isCurrent: true },
              student: { pebsFiliere: { not: null } },
            },
            _count: { _all: true },
          })
        : [];
      const pebsCountByClass = new Map(pebsCounts.map(p => [p.classId, p._count._all]));

      // Enrichir chaque classe avec pebsBadge (3 états : PEBS / MIXTE / GENERAL)
      const data = classes.map(cls => {
        const total = cls._count.enrollments;
        const pebsN = pebsCountByClass.get(cls.id) ?? 0;
        const pebsMixte = cls.pebsMixte === true;
        let pebsBadge: 'PEBS' | 'MIXTE' | 'GENERAL' | null = null;
        if (cls.filiere === 'FR_PEBS' || cls.filiere === 'EN_PEBS') {
          pebsBadge = 'PEBS';
        } else if (cls.filiere === 'FR_GENERAL' || cls.filiere === 'EN_GENERAL') {
          pebsBadge = total === 0
            ? (pebsMixte ? 'MIXTE' : 'GENERAL')
            : (pebsN === 0 ? 'GENERAL' : pebsN === total ? 'PEBS' : 'MIXTE');
        }
        return {
          ...cls,
          _count: { students: cls._count.enrollments }, // préserve la clé attendue par le frontend
          pebsBadge,
          cycle: cycleDeClasse(cls.level),
        };
      });

      res.json({ success: true, data });
    } catch (err) { next(err); }
  });

  // GET /api/v2/subjects — matières visibles selon le rôle
  //   ?classId=xxx → Vue par Classe : retourne les SubjectCoefficients de cette classe
  //   TEACHER      → uniquement ses matières assignées (TeacherSubject)
  //   Autres       → toutes les matières de l'école
  app.get('/api/v2/subjects', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const userId   = req.user!.userId;
      const role     = req.user!.role;
      const classId  = req.query['classId'] as string | undefined;

      // ── Vue par Classe ──
      if (classId) {
        const cls = await p.class.findFirst({
          where: { id: classId, schoolId },
          select: { name: true, level: true, serie: true, filiere: true },
        });
        if (!cls) {
          res.status(404).json({ success: false, message: 'Classe introuvable' });
          return;
        }

        const resolvedSerie: string | null =
          cls.serie ??
          cls.filiere ??
          ((cls.level && (SYNC_CYCLE2_LEVELS as string[]).includes(cls.level))
            ? syncParseSerie(cls.name, cls.level)
            : null);

        // 1er cycle FR : stocké avec serieCode='FR_GENERAL' (ou filière si définie)
        const isCycle1 = cls.level != null && (['6e','5e','4e','3e'] as string[]).includes(cls.level);
        const cycle1Filiere = cls.filiere ?? 'FR_GENERAL';

        const [coefficients, overrides] = await Promise.all([
          p.subjectCoefficient.findMany({
            where: {
              schoolId,
              classLevel: cls.level ?? undefined,
              OR: isCycle1
                ? [{ serieCode: cycle1Filiere }, { serieCode: null }]
                : resolvedSerie
                  ? [{ serieCode: resolvedSerie }, { serieCode: null }]
                  : [{ serieCode: null }],
            },
            include: { subject: { select: { id: true, name: true, code: true } } },
            orderBy: { subject: { name: 'asc' } },
          }),
          p.classSubjectOverride.findMany({
            where: { classId, schoolId },
            include: { subject: { select: { id: true, name: true, code: true } } },
            orderBy: { subject: { name: 'asc' } },
          }),
        ]);

        // Les overrides prennent priorité : on exclut les matières déjà couvertes par un override
        const overrideSubjectIds = new Set(overrides.map(o => o.subjectId));
        const sharedCoeffs = coefficients.filter(c => !overrideSubjectIds.has(c.subjectId));

        const data = [
          ...sharedCoeffs.map(c => ({
            id:          c.id,
            subjectId:   c.subjectId,
            name:        c.subject.name,
            code:        c.subject.code,
            coefficient: c.coefficient,
            classLevel:  c.classLevel,
            serieCode:   c.serieCode,
            classOnly:   false,
          })),
          ...overrides.map(o => ({
            id:          o.id,
            subjectId:   o.subjectId,
            name:        o.subject.name,
            code:        o.subject.code,
            coefficient: o.coefficient,
            classLevel:  cls.level ?? null,
            serieCode:   null,
            classOnly:   true,
          })),
        ].sort((a, b) => a.name.localeCompare(b.name));

        res.json({ success: true, data, className: cls.name });
        return;
      }

      // ── Vue Catalogue ──
      let whereClause: any = { schoolId };

      if (role === 'TEACHER') {
        whereClause = {
          schoolId,
          teacherSubjects: { some: { teacherProfile: { userId } } },
        };
      }

      const subjects = await p.subject.findMany({
        where: whereClause,
        include: {
          teacherSubjects: {
            include: {
              teacherProfile: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
            },
          },
        },
        orderBy: { name: 'asc' },
      });
      res.json({ success: true, data: subjects });
    } catch (err) { next(err); }
  });

  // GET /api/v2/rooms — catalogue des salles de l'établissement (aucun filtrage par rôle : une
  // salle est une donnée de référence, pas une donnée sensible par utilisateur).
  app.get('/api/v2/rooms', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const rooms = await p.room.findMany({
        where: { schoolId },
        orderBy: { name: 'asc' },
      });
      res.json({ success: true, data: rooms });
    } catch (err) { next(err); }
  });

  // GET /api/v2/student-groups — catalogue des GroupSet + leurs Group (référence, aucun
  // filtrage par rôle, même principe que /rooms et /subjects).
  app.get('/api/v2/student-groups', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const groupSets = await p.studentGroupSet.findMany({
        where: { schoolId },
        include: { groups: { orderBy: { name: 'asc' } } },
        orderBy: { name: 'asc' },
      });
      res.json({ success: true, data: groupSets });
    } catch (err) { next(err); }
  });

  // GET /api/v2/class-room-assignments?academicYearId= — salles habituelles par classe
  app.get('/api/v2/class-room-assignments', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const academicYearId = req.query['academicYearId'] as string | undefined;
      if (!academicYearId) {
        res.status(400).json({ success: false, message: 'academicYearId requis' });
        return;
      }
      const assignments = await p.classRoomAssignment.findMany({
        where: { schoolId, academicYearId },
        include: { class: { select: { id: true, name: true } }, room: { select: { id: true, name: true, capacity: true } } },
      });
      res.json({ success: true, data: assignments });
    } catch (err) { next(err); }
  });

  // GET /api/v2/academic-years — liste des années scolaires avec périodes et séquences
  app.get('/api/v2/academic-years', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const years = await p.academicYear.findMany({
        where: { schoolId },
        include: {
          periods: {
            include: { sequences: { orderBy: { orderIndex: 'asc' } } },
            orderBy: { startDate: 'asc' },
          },
        },
        orderBy: { startDate: 'desc' },
      });
      res.json({ success: true, data: years });
    } catch (err) { next(err); }
  });

  // GET /api/v2/timetables?classId= — emploi du temps d'une classe
  app.get('/api/v2/timetables', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const classId = req.query.classId as string | undefined;
      const timetables = await p.timetable.findMany({
        where: { schoolId, ...(classId ? { classId } : {}) },
        include: {
          class: { select: { id: true, name: true } },
          slots: {
            include: {
              subject: { select: { id: true, name: true } },
              teacher: { select: { id: true, firstName: true, lastName: true } },
              room: { select: { id: true, name: true } },
            },
            orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      // roomId (relation) → conserve le champ `room: string | null` attendu par le frontend
      // (dashboards élève/enseignant) — room était un texte libre avant migration V2.3, aucun
      // changement de contrat côté client.
      const data = timetables.map(tt => ({
        ...tt,
        slots: tt.slots.map(s => ({ ...s, room: s.room?.name ?? null })),
      }));
      res.json({ success: true, data });
    } catch (err) { next(err); }
  });

  // GET /api/v2/finance/fee-plans?academicYearId= — liste des plans de frais (ADMIN ou STAFF avec MANAGE_FINANCE)
  app.get('/api/v2/finance/fee-plans', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { academicYearId } = req.query as Record<string, string>;
      const plans = await p.feePlan.findMany({
        where: { schoolId, ...(academicYearId ? { academicYearId } : {}) },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ success: true, data: plans });
    } catch (err) { next(err); }
  });

  // GET /api/v2/finance/invoices?status=&feeType=&page= — liste des factures (ADMIN ou STAFF)
  app.get('/api/v2/finance/invoices', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { status, feeType, page = '1', limit = '50' } = req.query as Record<string, string>;
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const where: any = {
        schoolId,
        ...(status ? { status } : {}),
        ...(feeType ? { feePlan: { feeType } } : {}),
      };
      const [total, invoices] = await Promise.all([
        p.invoice.count({ where }),
        p.invoice.findMany({
          where,
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
            feePlan: { select: { id: true, name: true, feeType: true, amount: true } },
            payments: { select: { id: true, amount: true, status: true, paidAt: true, method: true, feeType: true, cautionStatus: true, refundedAt: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
      ]);
      res.json({ success: true, data: invoices, pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) } });
    } catch (err) { next(err); }
  });

  // PATCH /api/v2/school/profile — mise à jour du profil de l'école (ADMIN)
  app.patch('/api/v2/school/profile', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { name, city, phone, email } = req.body as { name?: string; city?: string; phone?: string; email?: string };
      const updated = await p.school.update({
        where: { id: schoolId },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(city !== undefined ? { city } : {}),
          ...(phone !== undefined ? { phone } : {}),
          ...(email !== undefined ? { email } : {}),
        },
        select: { id: true, name: true, city: true, phone: true, email: true, logoUrl: true, subdomain: true },
      });
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  });

  // PATCH /api/v2/users/me/avatar — mise à jour de l'avatar du compte utilisateur connecté
  app.patch('/api/v2/users/me/avatar', requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.userId;
      const { avatarUrl } = req.body as { avatarUrl?: string | null };

      if (avatarUrl === '' || avatarUrl === null || avatarUrl === undefined) {
        const updated = await p.user.update({
          where: { id: userId },
          data: { avatarUrl: null },
          select: { id: true, avatarUrl: true },
        });
        res.json({ success: true, data: { avatarUrl: updated.avatarUrl } });
        return;
      }

      if (typeof avatarUrl !== 'string' || (!avatarUrl.startsWith('data:image/') && !avatarUrl.startsWith('http://') && !avatarUrl.startsWith('https://'))) {
        res.status(400).json({ success: false, message: "Format d'image invalide (data:image/... ou URL attendue)" });
        return;
      }

      if (avatarUrl.length > 2_000_000) {
        res.status(400).json({ success: false, message: 'Image trop volumineuse (maximum 1.5 Mo)' });
        return;
      }

      const updated = await p.user.update({
        where: { id: userId },
        data: { avatarUrl },
        select: { id: true, avatarUrl: true },
      });

      res.json({ success: true, data: { avatarUrl: updated.avatarUrl } });
    } catch (err) { next(err); }
  });

  // PATCH /api/v2/students/:id/official-photo — mise à jour de la photo officielle par le secrétariat
  app.patch('/api/v2/students/:id/official-photo', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const studentUserId = req.params.id as string;
      const { photoUrl } = req.body as { photoUrl?: string | null };

      const eleve = await p.user.findFirst({
        where: { id: studentUserId, schoolId, role: 'STUDENT' },
        include: { studentProfile: true },
      });

      if (!eleve || !eleve.studentProfile) {
        res.status(404).json({ success: false, message: 'Élève ou profil introuvable dans cet établissement' });
        return;
      }

      let newPhotoUrl: string | null = null;
      if (photoUrl && typeof photoUrl === 'string' && (photoUrl.startsWith('data:image/') || photoUrl.startsWith('http://') || photoUrl.startsWith('https://'))) {
        if (photoUrl.length > 3_000_000) {
          res.status(400).json({ success: false, message: 'Photo trop volumineuse (maximum 2 Mo)' });
          return;
        }
        newPhotoUrl = photoUrl;
      } else if (photoUrl !== null && photoUrl !== '') {
        res.status(400).json({ success: false, message: 'Format de photo invalide' });
        return;
      }

      const updatedProfile = await p.studentProfile.update({
        where: { id: eleve.studentProfile.id },
        data: { photoUrl: newPhotoUrl },
        select: { id: true, photoUrl: true, matricule: true },
      });

      await p.activitiesLog.create({
        data: {
          schoolId,
          userId: req.user!.userId,
          action: 'STUDENT_OFFICIAL_PHOTO_UPDATE',
          description: `Photo d'identité officielle mise à jour pour l'élève ${eleve.lastName} ${eleve.firstName} (ID: ${eleve.id}) par ${req.user!.role}`,
          metadata: { studentUserId: eleve.id, hasPhoto: Boolean(newPhotoUrl) },
        },
      });

      res.json({ success: true, data: { photoUrl: updatedProfile.photoUrl, matricule: updatedProfile.matricule } });
    } catch (err) { next(err); }
  });

  // GET /api/v2/classes/:id/students-directory — annuaire complet de la classe avec photos pour le secrétariat
  app.get('/api/v2/classes/:id/students-directory', requireAuth, requireRole('ADMIN', 'STAFF', 'TEACHER'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const classId = req.params.id as string;

      const classe = await p.class.findFirst({
        where: { id: classId, schoolId },
        select: { id: true, name: true, level: true },
      });

      if (!classe) {
        res.status(404).json({ success: false, message: 'Classe introuvable' });
        return;
      }

      const users = await p.user.findMany({
        where: {
          schoolId,
          role: 'STUDENT',
          isActive: true,
          ...whereElevesParClasse(classId),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          avatarUrl: true,
          createdAt: true,
          studentProfile: {
            select: {
              id: true,
              matricule: true,
              numeroInterne: true,
              photoUrl: true,
              gender: true,
              dateOfBirth: true,
              healthScore: true,
              parents: {
                select: {
                  parentProfile: {
                    select: {
                      user: {
                        select: {
                          id: true,
                          firstName: true,
                          lastName: true,
                          phone: true,
                          email: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });

      const data = users.map(u => {
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
    } catch (err) { next(err); }
  });

}
