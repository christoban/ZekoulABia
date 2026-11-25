import type { Request, Response, NextFunction } from 'express';
import type { OnboarderEcoleUseCase } from '@application/school/OnboarderEcoleUseCase';
import type { ApprouverEcoleUseCase } from '@application/school/ApprouverEcoleUseCase';
import type { SchoolSubsystem, EducationType, SchoolOwnership } from '@domain/types/enums';

export class SchoolOnboardingController {
  constructor(
    private readonly onboarder: OnboarderEcoleUseCase,
    private readonly approuver: ApprouverEcoleUseCase,
  ) {}

  // POST /api/onboarding/register
  inscrire = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        nom, subdomain, adresse, ville, region, telephone, email,
        subsystem, educationType, ownership, templateCode,
        adminPrenom, adminNom, adminEmail, adminPasswordHash,
      } = req.body;

      const champRequis = ['nom', 'subdomain', 'subsystem', 'educationType',
                           'ownership', 'adminPrenom', 'adminNom',
                           'adminEmail', 'adminPasswordHash'];
      const manquants = champRequis.filter(c => !req.body[c]);
      if (manquants.length > 0) {
        res.status(400).json({
          success: false,
          message: `Champs manquants : ${manquants.join(', ')}`,
        });
        return;
      }

      const resultat = await this.onboarder.execute({
        nom, subdomain, adresse, ville, region, telephone, email,
        subsystem: subsystem as SchoolSubsystem,
        educationType: educationType as EducationType,
        ownership: ownership as SchoolOwnership,
        templateCode,
        adminPrenom, adminNom, adminEmail, adminPasswordHash,
      });

      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('sous-domaine')) {
          res.status(409).json({ success: false, message: error.message });
          return;
        }
        if (error.message.includes('invalide')) {
          res.status(400).json({ success: false, message: error.message });
          return;
        }
      }
      next(error);
    }
  };

  // POST /api/master/schools/:id/approve
  approuverEcole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.masterUser;
      const resultat = await this.approuver.execute({
        schoolId: req.params.id as string,
        masterAdminId: user.id,
      });
      res.json({ success: true, data: resultat });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('introuvable')) {
          res.status(404).json({ success: false, message: error.message });
          return;
        }
        if (error.message.includes('approuvé') || error.message.includes('activé')) {
          res.status(422).json({ success: false, message: error.message });
          return;
        }
      }
      next(error);
    }
  };
}
