import type { Request, Response, NextFunction } from 'express';
import type { SchoolStructureSyncRepository } from '@domain/ports/repositories/SchoolStructureSyncRepository';
import type { SubjectAssignmentRepository } from '@domain/ports/repositories/SubjectAssignmentRepository';
import { getTemplateMeta } from '@application/school/schoolTemplateConfig';
import { assignerMatieresPourClasse } from '@application/school/SubjectAssignmentHelper';
import {
  buildExpectedStructureClasses,
  executerSyncSubjects,
} from './helpers/schoolStructureSyncHelper';

export class SchoolStructureSyncController {
  constructor(
    private readonly repo: SchoolStructureSyncRepository,
    private readonly subjectAssignmentRepo: SubjectAssignmentRepository,
  ) {}

  // POST /api/v2/schools/:id/sync-subjects
  // Crée rétroactivement les SubjectCoefficients pour les classes qui n'en ont pas
  syncSubjects = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.params['id'] as string;
      if (req.user!.schoolId !== schoolId) {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
      }

      const school = await this.repo.findSchoolTemplateAndConfig(schoolId);
      if (!school) {
        res.status(404).json({ success: false, message: 'École introuvable' });
        return;
      }

      const config = (school.onboardingConfig ?? {}) as Record<string, unknown>;
      const templateCode = (config['templateCode'] as string | undefined) ?? school.templateCode ?? '';
      const result = await executerSyncSubjects(
        this.repo,
        this.subjectAssignmentRepo,
        schoolId,
        config,
        templateCode,
      );

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  // PATCH /api/v2/schools/:id/structure
  // Met à jour le nombre de classes par niveau et crée les nouvelles classes manquantes.
  // Non-destructif : ne supprime jamais de classes existantes.
  // Les nouvelles classes héritent automatiquement des SubjectCoefficients du niveau
  // (qui sont partagés par niveau, pas par classe individuelle).
  updateStructure = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.params['id'] as string;
      if (req.user!.schoolId !== schoolId) {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
      }

      const school = await this.repo.findSchoolTemplateAndConfig(schoolId);
      if (!school) {
        res.status(404).json({ success: false, message: 'École introuvable' });
        return;
      }

      const anneeCouranteId = await this.repo.findCurrentAcademicYearId(schoolId);
      if (!anneeCouranteId) {
        res.status(400).json({
          success: false,
          message: 'Aucune année académique courante — impossible de créer une classe.',
        });
        return;
      }

      const currentConfig = (school.onboardingConfig ?? {}) as Record<string, unknown>;
      const body = req.body as {
        classesParNiveau?: Record<string, number>;
        classesParNiveauPrimaire?: Record<string, number>;
      };

      if (!body.classesParNiveau && !body.classesParNiveauPrimaire) {
        res.status(400).json({ success: false, message: 'Aucune mise à jour fournie' });
        return;
      }

      const newConfig: Record<string, unknown> = { ...currentConfig };
      if (body.classesParNiveau) {
        newConfig['classesParNiveau'] = {
          ...((currentConfig['classesParNiveau'] as Record<string, number> | undefined) ?? {}),
          ...body.classesParNiveau,
        };
      }
      if (body.classesParNiveauPrimaire) {
        newConfig['classesParNiveauPrimaire'] = {
          ...((currentConfig['classesParNiveauPrimaire'] as Record<string, number> | undefined) ?? {}),
          ...body.classesParNiveauPrimaire,
        };
      }

      await this.repo.updateOnboardingConfig(schoolId, newConfig);

      const expectedClasses = buildExpectedStructureClasses(newConfig);
      const existingNames = new Set(await this.repo.findExistingClassNames(schoolId));
      const toCreate = expectedClasses.filter((c) => !existingNames.has(c.name));
      const created: string[] = [];

      if (toCreate.length > 0) {
        const templateCode = (newConfig['templateCode'] as string | undefined) ?? school.templateCode ?? '';
        const isAnglophone = getTemplateMeta(templateCode).isAnglophone;
        const schoolSubjects = await this.repo.findSubjectsSummary(schoolId);
        const subjectByName = new Map(schoolSubjects.map((s) => [s.name, s.id]));
        const subjectCountRef = { value: 0 };

        for (const cls of toCreate) {
          await this.repo.createClass({
            schoolId,
            academicYearId: anneeCouranteId,
            name: cls.name,
            level: cls.level,
          });
          created.push(cls.name);

          // Si aucun SubjectCoefficient n'existe encore pour ce niveau, bootstrapper depuis le template.
          // Sinon, la nouvelle classe hérite automatiquement des coefficients existants du niveau.
          const existingCoeffs = await this.repo.countSubjectCoefficients(schoolId, {
            classLevel: cls.level,
          });
          if (existingCoeffs === 0) {
            await assignerMatieresPourClasse(
              this.subjectAssignmentRepo,
              { name: cls.name, level: cls.level, filiere: null },
              schoolId,
              newConfig,
              isAnglophone,
              subjectByName,
              subjectCountRef,
              templateCode,
            );
          }
        }
      }

      res.json({
        success: true,
        message: created.length > 0
          ? `${created.length} classe(s) créée(s) avec succès.`
          : 'Aucune nouvelle classe à créer.',
        data: { classesCreated: created, totalCreated: created.length },
      });
    } catch (err) {
      next(err);
    }
  };
}
