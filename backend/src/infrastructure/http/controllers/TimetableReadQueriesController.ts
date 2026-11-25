import type { Request, Response, NextFunction } from 'express';
import { getTemplateMeta } from '@application/school/schoolTemplateConfig';
import {
  CYCLE2_LEVELS as SYNC_CYCLE2_LEVELS,
  parseSerie as syncParseSerie,
} from '@application/school/SubjectAssignmentHelper';
import type { TimetableReadQueryRepository } from '@domain/ports/repositories/TimetableReadQueryRepository';
import { isNiveauPrimaireOuMaternelle } from '../../../lib/classSerieValidator';

export class TimetableReadQueriesController {
  constructor(private readonly repo: TimetableReadQueryRepository) {}

  // GET /api/v2/classes — classes visibles selon le rôle
  listClasses = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const userId = req.user!.userId;
      const role = req.user!.role;

      let assignedClassIds: string[] | undefined;
      if (role === 'TEACHER') {
        assignedClassIds = await this.repo.findTeacherAssignedClassIds(userId, schoolId);
      }

      const classes = await this.repo.listClasses({
        schoolId,
        teacherUserId: role === 'TEACHER' ? userId : undefined,
        assignedClassIds,
      });

      const templateCode = await this.repo.findSchoolTemplateCode(schoolId);
      const ecoleEstPrimaire = getTemplateMeta(templateCode).isPrimaire;
      const cycleDeClasse = (level: string | null | undefined): 'primaire' | 'secondaire' =>
        isNiveauPrimaireOuMaternelle(level) ? 'primaire' : ecoleEstPrimaire ? 'primaire' : 'secondaire';

      const classIds = classes.map((c) => c.id);
      const pebsCounts = await this.repo.countPebsStudentsByClass(classIds);
      const pebsCountByClass = new Map(pebsCounts.map((item) => [item.classId, item.count]));

      const data = classes.map((cls) => {
        const total = cls._count.enrollments;
        const pebsN = pebsCountByClass.get(cls.id) ?? 0;
        const pebsMixte = cls.pebsMixte === true;
        let pebsBadge: 'PEBS' | 'MIXTE' | 'GENERAL' | null = null;
        if (cls.filiere === 'FR_PEBS' || cls.filiere === 'EN_PEBS') {
          pebsBadge = 'PEBS';
        } else if (cls.filiere === 'FR_GENERAL' || cls.filiere === 'EN_GENERAL') {
          pebsBadge =
            total === 0
              ? pebsMixte
                ? 'MIXTE'
                : 'GENERAL'
              : pebsN === 0
                ? 'GENERAL'
                : pebsN === total
                  ? 'PEBS'
                  : 'MIXTE';
        }
        return {
          ...cls,
          _count: { students: cls._count.enrollments },
          pebsBadge,
          cycle: cycleDeClasse(cls.level),
        };
      });

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v2/subjects — matières visibles selon le rôle ou vue par classe (?classId=)
  listSubjects = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const userId = req.user!.userId;
      const role = req.user!.role;
      const classId = req.query['classId'] as string | undefined;

      if (classId) {
        const cls = await this.repo.findClassForSubjects(classId, schoolId);
        if (!cls) {
          res.status(404).json({ success: false, message: 'Classe introuvable' });
          return;
        }

        const resolvedSerie: string | null =
          cls.serie ??
          cls.filiere ??
          (cls.level && (SYNC_CYCLE2_LEVELS as string[]).includes(cls.level)
            ? syncParseSerie(cls.name, cls.level)
            : null);

        const isCycle1 = cls.level != null && (['6e', '5e', '4e', '3e'] as string[]).includes(cls.level);
        const cycle1Filiere = cls.filiere ?? 'FR_GENERAL';

        const { coefficients, overrides } = await this.repo.listClassSubjectCoefficients({
          schoolId,
          classId,
          classLevel: cls.level,
          isCycle1,
          cycle1Filiere,
          resolvedSerie,
        });

        const overrideSubjectIds = new Set(overrides.map((o) => o.subjectId));
        const sharedCoeffs = coefficients.filter((c) => !overrideSubjectIds.has(c.subjectId));

        const data = [
          ...sharedCoeffs.map((c) => ({
            id: c.id,
            subjectId: c.subjectId,
            name: c.subject.name,
            code: c.subject.code,
            coefficient: c.coefficient,
            classLevel: c.classLevel,
            serieCode: c.serieCode,
            classOnly: false,
          })),
          ...overrides.map((o) => ({
            id: o.id,
            subjectId: o.subjectId,
            name: o.subject.name,
            code: o.subject.code,
            coefficient: o.coefficient,
            classLevel: cls.level ?? null,
            serieCode: null,
            classOnly: true,
          })),
        ].sort((a, b) => a.name.localeCompare(b.name));

        res.json({ success: true, data, className: cls.name });
        return;
      }

      const subjects = await this.repo.listCatalogSubjects(
        schoolId,
        role === 'TEACHER' ? userId : undefined,
      );
      res.json({ success: true, data: subjects });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v2/rooms — catalogue des salles de l'établissement
  listRooms = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rooms = await this.repo.listRooms(req.user!.schoolId);
      res.json({ success: true, data: rooms });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v2/student-groups — catalogue des GroupSet + leurs Group
  listStudentGroups = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const groupSets = await this.repo.listStudentGroupSets(req.user!.schoolId);
      res.json({ success: true, data: groupSets });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v2/class-room-assignments?academicYearId= — salles habituelles par classe
  listClassRoomAssignments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const academicYearId = req.query['academicYearId'] as string | undefined;
      if (!academicYearId) {
        res.status(400).json({ success: false, message: 'academicYearId requis' });
        return;
      }
      const assignments = await this.repo.listClassRoomAssignments(schoolId, academicYearId);
      res.json({ success: true, data: assignments });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v2/academic-years — liste des années scolaires avec périodes et séquences
  listAcademicYears = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const years = await this.repo.listAcademicYears(req.user!.schoolId);
      res.json({ success: true, data: years });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v2/timetables?classId= — emploi du temps d'une classe
  listTimetables = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const classId = req.query.classId as string | undefined;
      const timetables = await this.repo.listTimetables(schoolId, classId);
      const data = timetables.map((tt) => ({
        ...tt,
        slots: tt.slots.map((s) => ({ ...s, room: s.room?.name ?? null })),
      }));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
}
