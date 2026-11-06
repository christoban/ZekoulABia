/**
 * HTTP LAYER — Contrôleur pour le workflow de validation des bulletins par classe/période.
 * Gère la soumission, validation et publication des bulletins.
 */
import type { Request, Response, NextFunction } from 'express';
import type { SoumettreBulletinsClasseUseCase } from '@application/reportCard/SoumettreBulletinsClasseUseCase';
import type { ValiderBulletinsClasseUseCase } from '@application/reportCard/ValiderBulletinsClasseUseCase';
import type { PublierBulletinsClasseUseCase } from '@application/reportCard/PublierBulletinsClasseUseCase';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { SectionRepository } from '@domain/ports/repositories/SectionRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { BulletinValidationRepository } from '@domain/ports/repositories/BulletinValidationRepository';
import { resolveLanguage } from '../../../domain/policies/LanguagePolicy';
import type { BulletinValidationStatus } from '@domain/types/enums';

type AuthUser = { schoolId: string; userId: string; role: string; permissions?: string[] };

export class BulletinValidationController {
  constructor(
    private readonly soumettreBulletins: SoumettreBulletinsClasseUseCase,
    private readonly validerBulletins: ValiderBulletinsClasseUseCase,
    private readonly publierBulletins: PublierBulletinsClasseUseCase,
    private readonly anneeRepository: AnneeAcademiqueRepository,
    private readonly schoolRepository: SchoolRepository,
    private readonly sectionRepository: SectionRepository,
    private readonly classeRepository: ClasseRepository,
    private readonly bulletinValidationRepository: BulletinValidationRepository,
  ) {}

  private user(req: Request): AuthUser {
    return req.user as AuthUser;
  }

  // GET /api/v2/bulletin-validations
  listerHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = this.user(req);
      const { classId, academicPeriodId, status } = req.query as Record<string, string>;
      const result = await this.bulletinValidationRepository.listerSessions(user.schoolId, {
        classId: classId || undefined,
        academicPeriodId: academicPeriodId || undefined,
        status: (status as BulletinValidationStatus) || undefined,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/bulletin-validations
  soumettreHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = this.user(req);
      const { classId, academicPeriodId } = req.body;

      if (!classId || !academicPeriodId) {
        res.status(400).json({ success: false, message: 'classId et academicPeriodId sont requis' });
        return;
      }

      const result = await this.soumettreBulletins.execute({
        schoolId: user.schoolId,
        classId,
        academicPeriodId,
        demandeurId: user.userId,
        demandeurRole: user.role,
      });
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      if (error instanceof Error && error.message.includes('existe déjà')) {
        res.status(409).json({ success: false, message: error.message });
        return;
      }
      if (error instanceof Error && (error.message.includes('Seul un Admin') || error.message.includes('Professeur Principal'))) {
        res.status(403).json({ success: false, message: error.message });
        return;
      }
      if (error instanceof Error && error.message.includes('bullets ne sont pas encore générés')) {
        res.status(409).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };

  // POST /api/v2/bulletin-validations/:id/validate
  validerHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = this.user(req);
      const result = await this.validerBulletins.execute({
        schoolId: user.schoolId,
        sessionId: req.params.id as string,
        demandeurId: user.userId,
        demandeurRole: user.role,
        demandeurPermissions: user.permissions,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof Error && error.message.includes('introuvable')) {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      if (error instanceof Error && error.message.includes('Impossible de valider')) {
        res.status(409).json({ success: false, message: error.message });
        return;
      }
      if (error instanceof Error && error.message.includes('Permission VALIDATE_GRADES')) {
        res.status(403).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };

  // POST /api/v2/bulletin-validations/:id/publish
  publierHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = this.user(req);

      // Résoudre nomEtablissement et nomPeriode depuis les repositories
      const ecole = await this.schoolRepository.findById(user.schoolId);
      const nomEtablissement = ecole?.name ?? 'Établissement';

      // Résoudre la langue
      const classeId = req.body.classId as string | undefined;
      let langue: 'fr' | 'en' = 'fr';
      if (classeId) {
        const classe = await this.classeRepository.findById(classeId);
        if (classe?.sectionId) {
          const section = await this.sectionRepository.findById(classe.sectionId);
          langue = resolveLanguage(ecole?.subsystem ?? null, section?.code ?? null);
        }
      }

      // Résoudre le nom de la période via la session
      const nomPeriode = req.body.nomPeriode as string ?? 'Période';

      const result = await this.publierBulletins.execute({
        schoolId: user.schoolId,
        sessionId: req.params.id as string,
        demandeurId: user.userId,
        demandeurRole: user.role,
        demandeurPermissions: user.permissions,
        nomEtablissement,
        nomPeriode,
        langue,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof Error && error.message.includes('introuvable')) {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      if (error instanceof Error && error.message.includes('Impossible de publier')) {
        res.status(409).json({ success: false, message: error.message });
        return;
      }
      if (error instanceof Error && error.message.includes('Permission VALIDATE_GRADES')) {
        res.status(403).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };
}