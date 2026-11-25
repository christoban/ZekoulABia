import type { Request, Response, NextFunction } from 'express';
import type { ObtenirProfilAcademiqueUseCase } from '@application/student/ObtenirProfilAcademiqueUseCase';
import type { VerifierAccesEnfantUseCase } from '@application/parent/VerifierAccesEnfantUseCase';
import type { EnrollmentRepository } from '@domain/ports/repositories/EnrollmentRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';

/**
 * GET /api/v2/students/:studentId/academic-profile
 *
 * RBAC (V1.1 — cf. incident students-health/risk-detection, jamais supposé hérité) :
 * - ADMIN / STAFF  : tous les élèves de leur école
 * - TEACHER        : uniquement Professeur Principal de la classe actuelle de l'élève
 * - PARENT         : uniquement son propre enfant (VerifierAccesEnfantUseCase)
 * - STUDENT        : uniquement lui-même
 * Isolation multi-tenant : schoolId = req.user.schoolId systématique, élève d'une
 * autre école → 404 (sans révéler l'existence).
 */
export class AcademicProfileController {
  constructor(
    private readonly obtenirProfil: ObtenirProfilAcademiqueUseCase,
    private readonly verifierAccesEnfant: VerifierAccesEnfantUseCase,
    private readonly enrollmentRepository: EnrollmentRepository,
    private readonly anneeRepository: AnneeAcademiqueRepository,
  ) {}

  obtenirProfilAcademique = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ success: false, message: 'Non authentifié' });
        return;
      }
      const studentId = String(req.params.studentId ?? '');
      if (!studentId) {
        res.status(400).json({ success: false, message: 'studentId requis' });
        return;
      }

      const role = (user.role as string).toUpperCase();

      if (role === 'STUDENT' && user.userId !== studentId) {
        res.status(403).json({ success: false, message: 'Accès réservé à son propre profil' });
        return;
      }

      if (role === 'PARENT') {
        try {
          await this.verifierAccesEnfant.execute(user.userId, studentId);
        } catch {
          res.status(403).json({ success: false, message: "Accès réservé à son propre enfant" });
          return;
        }
      }

      if (role === 'TEACHER') {
        const classe = await this.enrollmentRepository.getClasseActuelleParStudentId(studentId);
        if (!classe || classe.professorPrincipalId !== user.userId) {
          res.status(403).json({ success: false, message: "Réservé au Professeur Principal de la classe de l'élève" });
          return;
        }
      }

      // Année académique : query param optionnel, sinon l'année courante de l'école
      let academicYearId = typeof req.query.academicYearId === 'string' ? req.query.academicYearId : undefined;
      if (!academicYearId) {
        const anneeCourante = await this.anneeRepository.findCourante(user.schoolId);
        academicYearId = anneeCourante?.id;
      }
      if (!academicYearId) {
        res.status(404).json({ success: false, message: 'Aucune année académique courante' });
        return;
      }

      const profil = await this.obtenirProfil.execute({
        studentId,
        schoolId: user.schoolId,
        academicYearId,
      });

      // Élève d'une autre école ou sans bulletins → même réponse neutre (pas de fuite d'existence)
      res.json({ success: true, data: profil });
    } catch (error) {
      next(error);
    }
  };
}
