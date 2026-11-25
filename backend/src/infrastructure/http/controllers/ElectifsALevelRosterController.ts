import type { Request, Response, NextFunction } from 'express';
import type { ResoudreParticipantsSeanceUseCase } from '@application/timetable/ResoudreParticipantsSeanceUseCase';
import type { AffecterMatieresALevelEleveUseCase } from '@application/student/AffecterMatieresALevelEleveUseCase';
import type { PreremplirDepuisCombinaisonUseCase } from '@application/student/PreremplirDepuisCombinaisonUseCase';
import type { GetElevesParMatiereALevelUseCase } from '@application/student/GetElevesParMatiereALevelUseCase';
import type { ClassStudentRosterRecord, ElectifsQueryRepository } from '@domain/ports/repositories/ElectifsQueryRepository';

export class ElectifsALevelRosterController {
  constructor(
    private readonly resoudreParticipantsSeanceUseCase: ResoudreParticipantsSeanceUseCase,
    private readonly affecterALevelUseCase: AffecterMatieresALevelEleveUseCase,
    private readonly preremplirALevelUseCase: PreremplirDepuisCombinaisonUseCase,
    private readonly getElevesALevelUseCase: GetElevesParMatiereALevelUseCase,
    private readonly electifsRepo: ElectifsQueryRepository,
  ) {}

  // GET /api/v2/timetable-slots/:id/students
  getTimetableSlotStudents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const slotId = req.params['id'] as string;
      const resultat = await this.resoudreParticipantsSeanceUseCase.execute(slotId, schoolId);
      res.json({ success: true, data: resultat });
    } catch (err) {
      if (err instanceof Error && err.message === 'Créneau introuvable') {
        res.status(404).json({ success: false, message: err.message });
        return;
      }
      if (err instanceof Error && err.message === 'Accès refusé') {
        res.status(403).json({ success: false, message: err.message });
        return;
      }
      next(err);
    }
  };

  // PUT /api/v2/students/:id/alevel-subjects
  remplacerALevelSubjects = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { subjectIds } = req.body as { subjectIds?: string[] };
      const result = await this.affecterALevelUseCase.execute({
        studentUserId: req.params['id'] as string,
        schoolId: req.user!.schoolId,
        subjectIds: Array.isArray(subjectIds) ? subjectIds : [],
      });
      res.json({ success: true, data: result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      if (/au moins|plus de|introuvable|non A-Level/.test(msg)) {
        res.status(400).json({ success: false, message: msg });
        return;
      }
      next(err);
    }
  };

  // POST /api/v2/students/:id/alevel-subjects/from-combination
  preremplirALevelDepuisCombinaison = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { combinationCode } = req.body as { combinationCode?: string };
      if (!combinationCode) {
        res.status(400).json({ success: false, message: 'combinationCode requis' });
        return;
      }
      const result = await this.preremplirALevelUseCase.execute({
        studentUserId: req.params['id'] as string,
        schoolId: req.user!.schoolId,
        combinationCode,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      if (/introuvable/.test(msg)) {
        res.status(404).json({ success: false, message: msg });
        return;
      }
      next(err);
    }
  };

  // GET /api/v2/students/:id/alevel-subjects
  getStudentALevelSubjects = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const studentUserId = req.params['id'] as string;
      const profileId = await this.electifsRepo.findStudentProfileIdByUserId(studentUserId, schoolId);
      if (!profileId) {
        res.status(404).json({ success: false, message: 'Élève introuvable' });
        return;
      }

      const subjects = await this.electifsRepo.listStudentALevelSubjects(profileId);
      res.json({ success: true, data: { subjects, count: subjects.length } });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v2/classes/:id/alevel-overview
  getClassALevelOverview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const classId = req.params['id'] as string;

      const classe = await this.electifsRepo.findClassById(classId, schoolId);
      if (!classe) {
        res.status(404).json({ success: false, message: 'Classe introuvable' });
        return;
      }

      const availableSubjects = await this.electifsRepo.listAvailableALevelSubjects(schoolId);
      const students = await this.electifsRepo.listClassStudentsALevel(classId, schoolId);

      res.json({
        success: true,
        data: {
          className: classe.name,
          availableSubjects,
          students: students.map((s) => ({
            id: s.id,
            firstName: s.firstName,
            lastName: s.lastName,
            subjects: s.subjects,
            count: s.subjects.length,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v2/subjects/:id/alevel-students?classId=
  getALevelStudentsBySubject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const classId = typeof req.query['classId'] === 'string' ? (req.query['classId'] as string) : undefined;
      const result = await this.getElevesALevelUseCase.execute(req.params['id'] as string, req.user!.schoolId, classId);
      res.json({ success: true, data: result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      if (/introuvable/.test(msg)) {
        res.status(404).json({ success: false, message: msg });
        return;
      }
      next(err);
    }
  };

  // POST /api/v2/classes/:id/alevel-subjects/bulk-from-combination
  bulkALevelFromCombination = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const classId = req.params['id'] as string;
      const { combinationCode } = req.body as { combinationCode?: string };
      if (!combinationCode) {
        res.status(400).json({ success: false, message: 'combinationCode requis' });
        return;
      }

      const classe = await this.electifsRepo.findClassById(classId, schoolId);
      if (!classe) {
        res.status(404).json({ success: false, message: 'Classe introuvable' });
        return;
      }

      const studentIds = await this.electifsRepo.listActiveClassStudentIds(classId, schoolId);

      let modifies = 0;
      for (const studentUserId of studentIds) {
        try {
          await this.preremplirALevelUseCase.execute({ studentUserId, schoolId, combinationCode });
          modifies++;
        } catch {
          /* élève ignoré si erreur individuelle */
        }
      }
      res.json({ success: true, data: { modifies, total: studentIds.length } });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v2/teacher/roster?classId=&subjectId=
  getTeacherRoster = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const classId = req.query['classId'] as string | undefined;
      const subjectId = req.query['subjectId'] as string | undefined;
      if (!classId) {
        res.status(400).json({ success: false, message: 'classId requis' });
        return;
      }

      const classe = await this.electifsRepo.findClassById(classId, schoolId);
      if (!classe) {
        res.status(404).json({ success: false, message: 'Classe introuvable' });
        return;
      }

      const allStudents = await this.electifsRepo.listClassStudentsRoster(classId, schoolId);
      const total = allStudents.length;
      let mode: 'FULL' | 'LV2' | 'ALEVEL' = 'FULL';
      let filtered: ClassStudentRosterRecord[] = allStudents;
      let lv2Fallback = false;
      let subjectName = '';

      if (subjectId) {
        const subject = await this.electifsRepo.findSubjectForRoster(subjectId, schoolId);
        if (subject) {
          subjectName = subject.name;
          if (subject.isLV2) {
            mode = 'LV2';
            const assigned = allStudents.filter((s) => s.lv2SubjectId === subjectId);
            const anyLv2InClass = allStudents.some((s) => s.lv2SubjectId);
            // Repli (Situation 1) : si la classe n'a AUCUNE affectation LV2 individuelle,
            // toute la classe est présumée faire cette langue.
            if (assigned.length === 0 && !anyLv2InClass) {
              filtered = allStudents;
              lv2Fallback = true;
            } else {
              filtered = assigned;
            }
          } else {
            const isOfficialALevel = await this.electifsRepo.isOfficialALevelSubject(subject.name);
            if (isOfficialALevel) {
              mode = 'ALEVEL';
              filtered = allStudents.filter((s) => s.alevelSubjectIds.includes(subjectId));
            }
          }
        }
      }

      const label = mode === 'LV2'
        ? (lv2Fallback
            ? `Cours LV2 — ${subjectName} — ${classe.name} (toute la classe — ${total} élèves, LV2 non répartie)`
            : `Cours LV2 — ${subjectName} — ${classe.name} (${filtered.length} élèves sur ${total})`)
        : mode === 'ALEVEL'
          ? `A-Level — ${subjectName} — ${classe.name} (${filtered.length} élèves sur ${total})`
          : null;

      res.json({
        success: true,
        data: {
          mode,
          filtered: mode !== 'FULL',
          lv2Fallback,
          label,
          total,
          className: classe.name,
          students: filtered.map((s) => ({
            id: s.id,
            firstName: s.firstName,
            lastName: s.lastName,
            name: `${s.firstName} ${s.lastName}`.trim(),
            className: classe.name,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  };
}
