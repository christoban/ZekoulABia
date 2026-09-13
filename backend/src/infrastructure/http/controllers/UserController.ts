import type { Request, Response, NextFunction } from 'express';
import type { ConnecterUtilisateurUseCase } from '@application/user/ConnecterUtilisateurUseCase';
import type { InscrireUtilisateurUseCase } from '@application/user/InscrireUtilisateurUseCase';
import type { RafraichirTokenUseCase } from '@application/user/RafraichirTokenUseCase';
import type { DeconnecterUtilisateurUseCase } from '@application/user/DeconnecterUtilisateurUseCase';
import type { ModifierUtilisateurUseCase } from '@application/user/ModifierUtilisateurUseCase';
import type { SupprimerUtilisateurUseCase } from '@application/user/SupprimerUtilisateurUseCase';
import type { TransfererEleveUseCase } from '@application/user/TransfererEleveUseCase';
import type { DesignerAPUseCase } from '@application/user/DesignerAPUseCase';
import type { ImporterUtilisateursUseCase } from '@application/user/ImporterUtilisateursUseCase';
import type { ImportUtilisateursRepository } from '@domain/ports/repositories/ImportUtilisateursRepository';
import type { LoginEmailOtpUseCase } from '@application/user/LoginEmailOtpUseCase';
import type { VerifierMfaConnexionUseCase } from '@application/user/VerifierMfaConnexionUseCase';
import type { MfaUseCase } from '@application/user/MfaUseCase';
import type { TokenService } from '@domain/ports/services/TokenService';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { EnrollmentRepository } from '@domain/ports/repositories/EnrollmentRepository';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import type { ActivityLogPort } from '@domain/ports/services/ActivityLogPort';

import { UserAuthController } from './user/UserAuthController';
import { UserMfaPasswordController } from './user/UserMfaPasswordController';
import { UserLifecycleController } from './user/UserLifecycleController';
import { UserImportController } from './user/UserImportController';

export * from './user/userAuthHelper';
export * from './user/UserAuthController';
export * from './user/UserMfaPasswordController';
export * from './user/UserLifecycleController';
export * from './user/UserImportController';

/**
 * UserController — Façade de composition regroupant les contrôleurs spécialisés :
 * - UserAuthController (login multi-étapes, logout, refresh, reauth)
 * - UserMfaPasswordController (statut/reconfiguration MFA, reset/change password)
 * - UserLifecycleController (création, invitations, modification, suppression, transferts, AP)
 * - UserImportController (import Excel)
 */
export class UserController {
  public readonly authController: UserAuthController;
  public readonly mfaPasswordController: UserMfaPasswordController;
  public readonly lifecycleController: UserLifecycleController;
  public readonly importController: UserImportController;

  private readonly classeRepository: ClasseRepository;

  constructor(
    connecter: ConnecterUtilisateurUseCase,
    inscrire: InscrireUtilisateurUseCase,
    rafraichir: RafraichirTokenUseCase,
    deconnecter: DeconnecterUtilisateurUseCase,
    modifier: ModifierUtilisateurUseCase,
    supprimer: SupprimerUtilisateurUseCase,
    transferer: TransfererEleveUseCase,
    tokenService: TokenService,
    schoolRepository: SchoolRepository,
    designerAP: DesignerAPUseCase,
    importer: ImporterUtilisateursUseCase,
    loginEmailOtp: LoginEmailOtpUseCase,
    importRepository: ImportUtilisateursRepository,
    verifierMfaConnexion: VerifierMfaConnexionUseCase,
    audit: AIActionAuditPort,
    userRepository: UserRepository,
    mfaUseCase: MfaUseCase,
    classeRepository: ClasseRepository,
    enrollmentRepository: EnrollmentRepository,
    activityLog?: ActivityLogPort,
  ) {
    this.classeRepository = classeRepository;

    this.authController = new UserAuthController(
      connecter,
      loginEmailOtp,
      verifierMfaConnexion,
      mfaUseCase,
      deconnecter,
      rafraichir,
      tokenService,
      schoolRepository,
      userRepository,
    );

    this.mfaPasswordController = new UserMfaPasswordController(
      mfaUseCase,
      userRepository,
      schoolRepository,
    );

    this.lifecycleController = new UserLifecycleController(
      inscrire,
      modifier,
      supprimer,
      transferer,
      designerAP,
      audit,
      userRepository,
      schoolRepository,
      classeRepository,
      enrollmentRepository,
      activityLog,
    );

    this.importController = new UserImportController(importer, importRepository, activityLog);
  }

  // ── Auth & Session ──────────────────────────────────────────────────────────
  login = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.authController.login(req, res, next);

  verifyLoginOtp = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.authController.verifyLoginOtp(req, res, next);

  resendLoginOtp = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.authController.resendLoginOtp(req, res, next);

  verifyLoginMfa = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.authController.verifyLoginMfa(req, res, next);

  firstMfaSetup = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.authController.firstMfaSetup(req, res, next);

  firstMfaEnable = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.authController.firstMfaEnable(req, res, next);

  reauth = (req: Request, res: Response): Promise<void> =>
    this.authController.reauth(req, res);

  logout = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.authController.logout(req, res, next);

  refresh = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.authController.refresh(req, res, next);

  // ── MFA & Mots de passe ─────────────────────────────────────────────────────
  mfaStatus = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.mfaPasswordController.mfaStatus(req, res, next);

  mfaReconfigureStart = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.mfaPasswordController.mfaReconfigureStart(req, res, next);

  mfaReconfigureConfirm = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.mfaPasswordController.mfaReconfigureConfirm(req, res, next);

  mfaRegenCodes = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.mfaPasswordController.mfaRegenCodes(req, res, next);

  forgotPassword = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.mfaPasswordController.forgotPassword(req, res, next);

  resetPassword = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.mfaPasswordController.resetPassword(req, res, next);

  changePassword = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.mfaPasswordController.changePassword(req, res, next);

  // ── Cycle de vie utilisateurs ───────────────────────────────────────────────
  register = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.lifecycleController.register(req, res, next);

  validateInvite = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.lifecycleController.validateInvite(req, res, next);

  completeInvite = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.lifecycleController.completeInvite(req, res, next);

  update = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.lifecycleController.update(req, res, next);

  delete = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.lifecycleController.delete(req, res, next);

  transfer = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.lifecycleController.transfer(req, res, next);

  apDesignation = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.lifecycleController.apDesignation(req, res, next);

  // ── Import Excel ────────────────────────────────────────────────────────────
  importUsers = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.importController.importUsers(req, res, next);

  previewImport = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.importController.previewImport(req, res, next);

  validateImport = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.importController.validateImport(req, res, next);

  confirmImport = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.importController.confirmImport(req, res, next);

  // GET /api/v2/users/my-class — classe dont l'utilisateur est professeur principal
  myClass = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const classe = await this.classeRepository.findClasseDeProfPrincipal(user.userId);
      if (!classe) {
        res.status(404).json({ success: false, message: "Vous n'êtes titulaire d'aucune classe" });
        return;
      }
      res.json({ success: true, data: { classId: classe.id, className: classe.name } });
    } catch (error) {
      next(error);
    }
  };
}
