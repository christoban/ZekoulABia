import type { Request, Response, NextFunction } from 'express';
import { CYCLE2_LEVELS, parseSerie } from '@application/school/SubjectAssignmentHelper';
import type { RattachementEnseignantRepository } from '@domain/ports/repositories/RattachementEnseignantRepository';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import type { ActivityLogPort } from '@domain/ports/services/ActivityLogPort';

export class TeachingAssignmentController {
  constructor(
    private readonly rattachementRepository: RattachementEnseignantRepository,
    private readonly audit: AIActionAuditPort,
    private readonly activityLog?: ActivityLogPort,
  ) {}

  // GET /api/v2/teaching-assignments?classId=:id
  getByClass = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { classId } = req.query as { classId?: string };

      if (!classId) {
        res.status(400).json({ success: false, message: 'classId requis' });
        return;
      }

      const cls = await this.rattachementRepository.trouverClasse(classId, schoolId);
      if (!cls) {
        res.status(404).json({ success: false, message: 'Classe introuvable' });
        return;
      }

      // Résoudre le code série/filière : Class.serie (2nd cycle), ou Class.filiere (1er cycle), ou parser depuis le nom
      const resolvedSerie: string | null =
        cls.serie ??
        cls.filiere ??
        ((cls.level && (CYCLE2_LEVELS as string[]).includes(cls.level))
          ? parseSerie(cls.name, cls.level)
          : null);

      // Matières du programme de cette classe : SubjectCoefficient (niveau) + ClassSubjectOverride (classe)
      const [coefficients, overrides] = await Promise.all([
        this.rattachementRepository.listerCoefficients({
          schoolId,
          classLevel: cls.level ?? null,
          serieCode: resolvedSerie,
        }),
        this.rattachementRepository.listerOverrides(classId, schoolId),
      ]);

      // Les overrides prennent priorité : on exclut les matières déjà couvertes
      const overrideSubjectIds = new Set(overrides.map(o => o.subjectId));
      const seenSubjectIds = new Set<string>();
      const sharedCoeffs = coefficients.filter(c => {
        if (overrideSubjectIds.has(c.subjectId)) return false;
        if (seenSubjectIds.has(c.subjectId)) return false;
        seenSubjectIds.add(c.subjectId);
        return true;
      });

      // Fusionner les matières partagées et les overrides
      const allSubjects = [
        ...sharedCoeffs.map(c => ({
          subjectId: c.subjectId,
          subjectName: c.subject.name,
          coefficient: c.coefficient,
        })),
        ...overrides.map(o => ({
          subjectId: o.subjectId,
          subjectName: o.subject.name,
          coefficient: o.coefficient,
        })),
      ];

      // Affectations existantes pour cette classe
      const assignments = await this.rattachementRepository.listerAffectations(classId, schoolId);
      const assignmentMap = new Map(assignments.map(a => [a.subjectId, a]));

      // Pour chaque matière : enseignants éligibles (qui ont déclaré cette matière)
      const data = await Promise.all(
        allSubjects.map(async s => {
          const assignment = assignmentMap.get(s.subjectId);
          const eligibleTeachers = await this.rattachementRepository.listerEnseignantsEligibles(schoolId, s.subjectId);

          return {
            subjectId: s.subjectId,
            subjectName: s.subjectName,
            coefficient: s.coefficient,
            currentTeacherId: assignment?.teacherId ?? null,
            currentTeacherName: assignment?.teacher
              ? `${assignment.teacher.firstName} ${assignment.teacher.lastName}`
              : null,
            eligibleTeachers: eligibleTeachers.map(t => ({
              id: t.id,
              name: `${t.firstName} ${t.lastName}`,
            })),
          };
        }),
      );

      const assigned = data.filter(d => d.currentTeacherId !== null).length;
      res.json({ success: true, data, meta: { total: data.length, assigned } });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/teaching-assignments
  assign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { classId, subjectId, teacherId } = req.body as {
        classId?: string;
        subjectId?: string;
        teacherId?: string | null;
      };

      if (!classId || !subjectId) {
        res.status(400).json({ success: false, message: 'classId et subjectId requis' });
        return;
      }

      // Vérifier que la classe appartient à cette école
      const cls = await this.rattachementRepository.trouverClasse(classId, schoolId);
      if (!cls) {
        res.status(404).json({ success: false, message: 'Classe introuvable' });
        return;
      }

      if (!teacherId) {
        // Désaffecter
        await this.rattachementRepository.retirer({ classId, subjectId, schoolId });
        this.audit.journaliser({
          actorUserId: req.user!.userId,
          actorRole: req.user!.role,
          schoolId,
          actionName: 'retirer_affectation',
          targetType: 'TeachingAssignment',
          targetId: `${classId}:${subjectId}`,
          origin: 'UI_DIRECT',
          outcome: 'SUCCES',
          parametersSummary: { classId, subjectId },
        });
        res.json({ success: true, message: 'Affectation supprimée' });
        return;
      }

      // Vérifier que c'est bien un enseignant de cette école
      const enseignantValide = await this.rattachementRepository.verifierEnseignant(teacherId, schoolId);
      if (!enseignantValide) {
        res.status(400).json({ success: false, message: 'Enseignant introuvable' });
        return;
      }

      await this.rattachementRepository.assigner({
        classId,
        subjectId,
        teacherId,
        schoolId,
        academicYearId: cls.academicYearId,
      });

      this.audit.journaliser({
        actorUserId: req.user!.userId,
        actorRole: req.user!.role,
        schoolId,
        actionName: 'assigner_enseignant',
        targetType: 'TeachingAssignment',
        targetId: `${classId}:${subjectId}`,
        origin: 'UI_DIRECT',
        outcome: 'SUCCES',
        parametersSummary: { classId, subjectId, teacherId },
      });

      void this.activityLog?.log({
        userId: req.user!.userId,
        schoolId,
        action: 'PEDAGOGY_TEACHING_ASSIGN',
        details: `Enseignant ${teacherId} affecté à la matière ${subjectId} dans la classe ${classId}`,
      });

      res.json({ success: true, message: 'Affectation enregistrée' });
    } catch (error) {
      this.audit.journaliser({
        actorUserId: req.user?.userId,
        actorRole: req.user?.role,
        schoolId: req.user?.schoolId,
        actionName: 'assigner_enseignant',
        origin: 'UI_DIRECT',
        outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined,
        parametersSummary: req.body,
      });
      next(error);
    }
  };
}
