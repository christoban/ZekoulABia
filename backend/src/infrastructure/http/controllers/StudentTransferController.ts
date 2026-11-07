import type { NextFunction, Request, Response } from 'express';
import type { AnnulerDemandeTransfertUseCase } from '@application/studentTransfer/AnnulerDemandeTransfertUseCase';
import type { AssocierProfilCibleTransfertUseCase } from '@application/studentTransfer/AssocierProfilCibleTransfertUseCase';
import type { ConfigurerTuteurPrincipalUseCase } from '@application/studentTransfer/ConfigurerTuteurPrincipalUseCase';
import type { ConsulterDossierTransfertUseCase } from '@application/studentTransfer/ConsulterDossierTransfertUseCase';
import type { CreerDemandeTransfertUseCase } from '@application/studentTransfer/CreerDemandeTransfertUseCase';
import type { DeciderDemandeTransfertUseCase } from '@application/studentTransfer/DeciderDemandeTransfertUseCase';
import type { DetecterIdentiteTransfertUseCase } from '@application/studentTransfer/DetecterIdentiteTransfertUseCase';
import type { EnregistrerConsentementTransfertUseCase } from '@application/studentTransfer/EnregistrerConsentementTransfertUseCase';
import type { EmettreConsentementTransfertUseCase } from '@application/studentTransfer/EmettreConsentementTransfertUseCase';
import type { RevoquerConsentementTransfertUseCase } from '@application/studentTransfer/RevoquerConsentementTransfertUseCase';
import type { TransferFeatureFlagPort } from '@domain/ports/services/TransferFeatureFlagPort';
import type { GuardianPhoneOtpPort } from '@domain/ports/services/GuardianPhoneOtpPort';
import type { TransferRequestRepositoryPort } from '@domain/ports/repositories/TransferRequestRepository';
import { STUDENT_TRANSFER_CONFIG } from '@application/studentTransfer/config';

export class StudentTransferController {
  constructor(
    private readonly featureFlag: TransferFeatureFlagPort,
    private readonly requests: TransferRequestRepositoryPort,
    private readonly detectIdentity: DetecterIdentiteTransfertUseCase,
    private readonly createRequest: CreerDemandeTransfertUseCase,
    private readonly recordConsent: EnregistrerConsentementTransfertUseCase,
    private readonly decideRequest: DeciderDemandeTransfertUseCase,
    private readonly revokeConsent: RevoquerConsentementTransfertUseCase,
    private readonly cancelRequest: AnnulerDemandeTransfertUseCase,
    private readonly readDossier: ConsulterDossierTransfertUseCase,
    private readonly emitConsent: EmettreConsentementTransfertUseCase,
    private readonly linkTargetProfile: AssocierProfilCibleTransfertUseCase,
    private readonly configureGuardianUseCase: ConfigurerTuteurPrincipalUseCase,
    private readonly phoneOtp: GuardianPhoneOtpPort,
  ) {}

  private async ensureEnabled(schoolId: string): Promise<void> {
    if (!(await this.featureFlag.isEnabled(schoolId))) {
      throw new Error('Le transfert inter-écoles est désactivé pour cet établissement.');
    }
  }

  detect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.ensureEnabled(req.user!.schoolId);
      const result = await this.detectIdentity.execute({
        nationalId: String(req.body.nationalId ?? ''),
        targetSchoolId: req.user!.schoolId,
      });
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.ensureEnabled(req.user!.schoolId);
      const data = await this.createRequest.execute({
        nationalId: String(req.body.nationalId ?? ''),
        targetSchoolId: req.user!.schoolId,
        requestedByUserId: req.user!.userId,
        academicYearTarget: String(req.body.academicYearTarget ?? ''),
      });
      await this.emitConsent.execute({
        requestId: data.id,
        consentTextVersion: STUDENT_TRANSFER_CONFIG.consentTextVersion,
        scopeAccepted: true,
      });
      res.status(201).json({ success: true, data });
    } catch (error) { next(error); }
  };

  consent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.recordConsent.execute({
        requestId: String(req.params.requestId),
        token: String(req.body.token ?? req.params.token ?? ''),
        otp: String(req.body.otp ?? ''),
        decision: req.body.decision === 'REFUSE' ? 'REFUSE' : 'ACCEPT',
        channel: req.body.channel === 'ASSISTED_BY_STAFF' ? 'ASSISTED_BY_STAFF' : 'LINK_OTP',
      });
      res.json({ success: true });
    } catch (error) { next(error); }
  };

  decide = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.ensureEnabled(req.user!.schoolId);
      await this.decideRequest.execute({
        requestId: String(req.params.requestId),
        sourceSchoolId: req.user!.schoolId,
        actorUserId: req.user!.userId,
        decision: req.body.decision === 'REFUSE' ? 'REFUSE' : 'APPROVE',
        rejectionReason: req.body.rejectionReason,
      });
      res.json({ success: true });
    } catch (error) { next(error); }
  };

  revoke = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.revokeConsent.execute({
        requestId: String(req.params.requestId),
        token: String(req.body.token ?? ''),
      });
      res.json({ success: true });
    } catch (error) { next(error); }
  };

  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.ensureEnabled(req.user!.schoolId);
      await this.cancelRequest.execute(String(req.params.requestId), req.user!.schoolId, req.user!.userId);
      res.json({ success: true });
    } catch (error) { next(error); }
  };

  listSent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.ensureEnabled(req.user!.schoolId);
      const data = await this.requests.listSentByTarget(req.user!.schoolId);
      res.json({ success: true, data });
    } catch (error) { next(error); }
  };

  listReceived = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.ensureEnabled(req.user!.schoolId);
      const data = await this.requests.listReceivedBySource(req.user!.schoolId);
      res.json({ success: true, data });
    } catch (error) { next(error); }
  };

  read = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.ensureEnabled(req.user!.schoolId);
      const data = await this.readDossier.execute({
        requestId: String(req.params.requestId),
        snapshotId: String(req.params.snapshotId),
        targetSchoolId: req.user!.schoolId,
        userId: req.user!.userId,
      });
      res.json({ success: true, data });
    } catch (error) { next(error); }
  };

  linkTarget = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.ensureEnabled(req.user!.schoolId);
      await this.linkTargetProfile.execute({
        requestId: String(req.params.requestId),
        targetStudentProfileId: String(req.body.targetStudentProfileId ?? ''),
        actingSchoolId: req.user!.schoolId,
        actorUserId: req.user!.userId,
      });
      res.json({ success: true });
    } catch (error) { next(error); }
  };

  configureGuardian = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.configureGuardianUseCase.execute({
        studentProfileId: String(req.params.studentProfileId),
        schoolId: req.user!.schoolId,
        parentProfileId: String(req.body.parentProfileId ?? ''),
      });
      res.json({ success: true });
    } catch (error) { next(error); }
  };

  sendGuardianPhoneOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.phoneOtp.envoyerOtpTelephone({
        studentProfileId: String(req.params.studentProfileId),
        schoolId: req.user!.schoolId,
      });
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  };

  verifyGuardianPhoneOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.phoneOtp.verifierOtpTelephone({
        studentProfileId: String(req.params.studentProfileId),
        schoolId: req.user!.schoolId,
        otp: String(req.body.otp ?? ''),
      });
      res.json({ success: true });
    } catch (error) { next(error); }
  };
}
