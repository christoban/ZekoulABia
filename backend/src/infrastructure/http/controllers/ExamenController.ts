import type { Request, Response, NextFunction } from 'express';
import { PrepareExamDossierUseCase } from '@application/examen/PrepareExamDossierUseCase';
import type { ExamDossierRepository } from '@domain/ports/repositories/ExamDossierRepository';

export class ExamenController {
  constructor(
    private readonly _prepareDossier: PrepareExamDossierUseCase,
    private readonly examDossierRepository: ExamDossierRepository,
  ) {}

  // POST /api/v2/examens/register
  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const { studentUserId, typeExamen, anneeScolaire } = req.body as {
        studentUserId: string; typeExamen: string; anneeScolaire: string;
      };
      if (!studentUserId || !typeExamen || !anneeScolaire) {
        res.status(400).json({ success: false, message: 'studentUserId, typeExamen, anneeScolaire requis' });
        return;
      }
      const result = await this._prepareDossier.execute({ schoolId, studentUserId, typeExamen, anneeScolaire });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  // GET /api/v2/examens/:studentId
  listByStudent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const studentId = String(req.params['studentId']);

      const belongs = await this.examDossierRepository.studentProfileBelongsToSchool(studentId, schoolId);
      if (!belongs) {
        res.status(404).json({ success: false, message: 'Élève introuvable' });
        return;
      }

      const registrations = await this.examDossierRepository.findExamRegistrationsByStudent(studentId);

      res.json({ success: true, data: registrations });
    } catch (err) { next(err); }
  };

  // PATCH /api/v2/examens/:id/set-candidate-number
  setCandidateNumber = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const examId = String(req.params['id']);
      const { numeroCandidatExamen } = req.body as { numeroCandidatExamen: string };
      if (!numeroCandidatExamen) {
        res.status(400).json({ success: false, message: 'numeroCandidatExamen requis' });
        return;
      }

      // Le count à 0 signifie « inexistante OU hors de mon école » — volontairement
      // indiscernables, pour ne pas révéler l'existence d'un examen d'une autre école.
      const maj = await this.examDossierRepository.setNumeroCandidat(examId, req.user!.schoolId, numeroCandidatExamen);
      if (maj === 0) {
        res.status(404).json({ success: false, message: 'Inscription à l\'examen introuvable' });
        return;
      }

      res.json({ success: true, message: 'Numéro candidat enregistré' });
    } catch (err) { next(err); }
  };

  // PATCH /api/v2/examens/:id/result
  setResult = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const examId = String(req.params['id']);
      const { resultatStatus, resultatMention, resultatScore, resultatSource } = req.body as {
        resultatStatus: string; resultatMention?: string; resultatScore?: number; resultatSource?: string;
      };
      if (!resultatStatus) {
        res.status(400).json({ success: false, message: 'resultatStatus requis' });
        return;
      }

      // count 0 : voir le commentaire de setCandidateNumber.
      const maj = await this.examDossierRepository.setExamResult(examId, req.user!.schoolId, {
        resultatStatus,
        resultatMention: resultatMention ?? null,
        resultatScore: resultatScore ?? null,
        resultatSource: resultatSource ?? 'MANUAL_IMPORT',
      });
      if (maj === 0) {
        res.status(404).json({ success: false, message: 'Inscription à l\'examen introuvable' });
        return;
      }

      res.json({ success: true, message: 'Résultat enregistré' });
    } catch (err) { next(err); }
  };
}
