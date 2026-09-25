import type { Application } from 'express';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { creerContainer } from '@infrastructure/config/container';
import { requireAuth, requireRole } from '../../http/middlewares/auth';
import { getTemplateMeta } from '@application/school/schoolTemplateConfig';
import { isNiveauPrimaireOuMaternelle } from '../../../lib/classSerieValidator';
import { CYCLE2_LEVELS as SYNC_CYCLE2_LEVELS, parseSerie as syncParseSerie } from '@application/school/SubjectAssignmentHelper';
import { whereElevesParClasse } from '@application/shared/studentEnrollment';


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
            id: true, firstName: true, lastName: true, email: true, role: true,
            isActive: true, lastLogin: true, createdAt: true,
            studentProfile: {
              select: {
                id: true, dateOfBirth: true, gender: true,
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
          id: true, firstName: true, lastName: true, email: true, role: true, isActive: true,
          teacherProfile: {
            select: {
              id: true, specialization: true,
              teacherSubjects: { select: { subject: { select: { id: true, name: true } } } },
            },
          },
           studentProfile: {
             select: {
               id: true,
               enrollmentsYearScoped: {
                 where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
                 select: { class: { select: { id: true, name: true } } },
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
            payments: { select: { id: true, amount: true, status: true, paidAt: true, method: true } },
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

}
