import type { Request, Response, NextFunction } from 'express';
import type { ObtenirEnfantsUseCase } from '@application/parent/ObtenirEnfantsUseCase';
import type { VerifierAccesEnfantUseCase } from '@application/parent/VerifierAccesEnfantUseCase';
import type { ObtenirAlertesSoldeUseCase } from '@application/parent/ObtenirAlertesSoldeUseCase';
import type { InitierPaiementMobileMoneyUseCase } from '@application/finance/InitierPaiementMobileMoneyUseCase';
import type { FactureRepository } from '@domain/ports/repositories/FactureRepository';
import type { PaymentMethod } from '@domain/types/enums';
import { journaliserActionIA } from '@infrastructure/services/ai/AIActionAuditLogger';

export class ParentController {
  constructor(
    private readonly obtenirEnfants: ObtenirEnfantsUseCase,
    private readonly verifierAcces: VerifierAccesEnfantUseCase,
    private readonly initierPaiement: InitierPaiementMobileMoneyUseCase,
    private readonly factureRepository: FactureRepository,
    private readonly obtenirAlertesSolde: ObtenirAlertesSoldeUseCase,
  ) {}

  // GET /api/v2/parent/children
  getEnfants = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const enfants = await this.obtenirEnfants.execute({
        parentUserId: user.userId,
        schoolId: user.schoolId,
      });
      journaliserActionIA({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'mes_enfants', origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: {},
      });
      res.json({ success: true, data: enfants });
    } catch (error) {
      const user = req.user;
      journaliserActionIA({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'mes_enfants', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: {},
      });
      next(error);
    }
  };

  // GET /api/v2/parent/alerts/balance
  // Assistant proactif (Section 6.3) : bannière affichée à la connexion, pas de demande
  // de l'utilisateur — indépendant du copilot conversationnel.
  getAlertesSolde = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const alertes = await this.obtenirAlertesSolde.execute({
        parentUserId: user.userId,
        schoolId: user.schoolId,
      });
      res.json({ success: true, data: alertes });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/parent/payments/mobile
  // Le parent initie lui-même son paiement MTN/Orange — son studentId est vérifié ici.
  initierPaiementMobile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { factureId, phoneNumber, method } = req.body;

      if (!factureId || !phoneNumber || !method) {
        res.status(400).json({
          success: false,
          message: 'factureId, phoneNumber et method requis',
        });
        return;
      }

      // Résoudre le studentId à partir de la facture et vérifier que c'est bien son enfant
      const facture = await this.factureRepository.findById(factureId);
      if (!facture) {
        res.status(404).json({ success: false, message: 'Facture introuvable' });
        return;
      }
      if (facture.schoolId !== user.schoolId) {
        res.status(403).json({ success: false, message: 'Accès non autorisé' });
        return;
      }

      // Vérifier que la facture appartient bien à un des enfants du parent
      try {
        await this.verifierAcces.execute(user.userId, facture.studentId);
      } catch {
        res.status(403).json({
          success: false,
          message: "Cette facture ne concerne pas l'un de vos enfants",
        });
        return;
      }

      const digits = phoneNumber.replace(/[\s+]/g, '');
      const numeroNormalise = digits.startsWith('237') ? digits : `237${digits}`;

      const resultat = await this.initierPaiement.execute({
        schoolId: user.schoolId,
        factureId,
        studentId: facture.studentId,
        phoneNumber: numeroNormalise,
        method: method as PaymentMethod,
      });

      journaliserActionIA({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'initier_paiement_enfant', targetType: 'Invoice', targetId: factureId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { factureId, studentId: facture.studentId, method },
      });
      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      const user = req.user;
      journaliserActionIA({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'initier_paiement_enfant', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      next(error);
    }
  };

  // Middleware : vérifie l'accès avant les routes enfant
  verifierAccesEnfant = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = req.user;
      const studentId = req.params.studentId as string;
      await this.verifierAcces.execute(user.userId, studentId);
      next();
    } catch {
      res.status(403).json({
        success: false,
        message: 'Accès non autorisé : cet élève ne fait pas partie de vos enfants',
      });
    }
  };
}
