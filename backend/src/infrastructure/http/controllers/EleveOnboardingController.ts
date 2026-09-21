import type { Request, Response, NextFunction } from 'express';
import type { DispositifOS } from '@application/eleveOnboarding/types';
import type { EleveOnboardingRepository } from '@domain/ports/repositories/EleveOnboardingRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { CredentialsNotificationPort } from '@domain/ports/services/CredentialsNotificationPort';
import { CreerSqueletteOnboardingUseCase } from '@application/eleveOnboarding/CreerSqueletteOnboardingUseCase';
import { SoumettreFormulaireOnboardingUseCase } from '@application/eleveOnboarding/SoumettreFormulaireOnboardingUseCase';
import { SoumettreOnboardingUseCase } from '@application/eleveOnboarding/SoumettreOnboardingUseCase';
import { RenvoyerOnboardingUseCase } from '@application/eleveOnboarding/RenvoyerOnboardingUseCase';
import { ValiderOnboardingUseCase } from '@application/eleveOnboarding/ValiderOnboardingUseCase';
import { RejeterOnboardingUseCase } from '@application/eleveOnboarding/RejeterOnboardingUseCase';
import { notifierOnboardingLienCreeAvecEcole, notifierOnboardingValidationAvecEcole } from '@infrastructure/services/notification/OnboardingNotificationService';
import { generateOnboardingFormPdf } from '../../pdf/onboarding/OnboardingFormPdfRenderer';
import { canManageEnrollment } from '@domain/rules/EnrollmentRules';

import { InscrireEleveUseCase } from '@application/eleveOnboarding/InscrireEleveUseCase';
import { ChangerGestionInscriptionsAdminUseCase } from '@application/eleveOnboarding/ChangerGestionInscriptionsAdminUseCase';

/**
 * Préfixe /api/v2/eleve-onboarding — distinct de /api/v2/onboarding.
 */
export class EleveOnboardingController {
  constructor(
    private readonly _creerSquelette: CreerSqueletteOnboardingUseCase,
    private readonly _soumettreFormulaire: SoumettreFormulaireOnboardingUseCase,
    private readonly _soumettreOnboarding: SoumettreOnboardingUseCase,
    private readonly _renvoyerOnboarding: RenvoyerOnboardingUseCase,
    private readonly _valider: ValiderOnboardingUseCase,
    private readonly _rejeter: RejeterOnboardingUseCase,
    private readonly onboardingRepository: EleveOnboardingRepository,
    private readonly schoolRepository: SchoolRepository,
    private readonly credentialsNotifier: CredentialsNotificationPort,
    private readonly _inscrire: InscrireEleveUseCase,
    private readonly _changerGestionAdmin: ChangerGestionInscriptionsAdminUseCase,
  ) {}

  private async checkEnrollmentPermission(req: Request, res: Response): Promise<boolean> {
    const user = req.user!;
    const school = await this.schoolRepository.findById(user.schoolId);
    const adminGereInscriptions = school?.adminGereInscriptions ?? false;

    if (!canManageEnrollment({ role: user.role, staffPermissions: user.permissions, adminGereInscriptions })) {
      res.status(403).json({ success: false, message: 'Permission MANAGE_ENROLLMENT requise (ou option Admin non activée)' });
      return false;
    }
    return true;
  }

  // POST /api/v2/eleve-onboarding
  creer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!await this.checkEnrollmentPermission(req, res)) return;
      const schoolId = req.user!.schoolId;
      const createdById = req.user!.userId;

      const {
        nomProvisoire, classId, contactEmail, contactTelephone, parentContactEmail, parentContactTelephone,
        recipientType, sourceType, examCandidateId,
        eleveADispositif, eleveDispositifOS, parentADispositif, parentDispositifOS, aucunContactDisponible,
      } = req.body as {
        nomProvisoire?: string; classId?: string; contactEmail?: string; contactTelephone?: string;
        parentContactEmail?: string; parentContactTelephone?: string;
        recipientType?: 'ELEVE' | 'PARENT' | 'LES_DEUX'; sourceType?: 'IMPORT_MASSE' | 'AUTOSERVICE' | 'CONCOURS'; examCandidateId?: string;
        eleveADispositif?: boolean; eleveDispositifOS?: 'ANDROID' | 'IOS' | 'AUTRE';
        parentADispositif?: boolean; parentDispositifOS?: 'ANDROID' | 'IOS' | 'AUTRE';
        aucunContactDisponible?: boolean;
      };
      if (!nomProvisoire?.trim()) {
        res.status(400).json({ success: false, message: 'nomProvisoire requis' });
        return;
      }

      const result = await this._creerSquelette.execute({
        schoolId, createdById, nomProvisoire, classId, contactEmail, contactTelephone,
        parentContactEmail, parentContactTelephone, recipientType, sourceType, examCandidateId,
        eleveADispositif, eleveDispositifOS, parentADispositif, parentDispositifOS, aucunContactDisponible,
      });
      res.json({ success: true, data: result });
      const school = await this.schoolRepository.findById(schoolId);
      void notifierOnboardingLienCreeAvecEcole(schoolId, school?.name ?? null, nomProvisoire, result);
    } catch (err) { next(err); }
  };

  // GET /api/v2/eleve-onboarding/token/:token — public, protégé par le token lui-même
  getByToken = async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const token = String(req.params['token']);
      const onboarding = await this.onboardingRepository.findOnboardingByTokenWithClasse(token);

      if (!onboarding) {
        res.status(404).json({ success: false, message: 'Lien invalide' });
        return;
      }
      if (onboarding.tokenUsedAt) {
        res.status(410).json({ success: false, message: 'Ce lien a déjà été utilisé' });
        return;
      }
      if (onboarding.tokenExpiresAt.getTime() < Date.now()) {
        if (onboarding.status !== 'EXPIRED') {
          await this.onboardingRepository.marquerOnboardingExpire(onboarding.id);
        }
        res.status(410).json({ success: false, message: 'Ce lien a expiré — demandez à votre établissement de le renvoyer' });
        return;
      }
      if (onboarding.status !== 'LINK_SENT') {
        res.status(409).json({ success: false, message: `Ce dossier n'est plus en attente de saisie (statut : ${onboarding.status})` });
        return;
      }

      res.json({
        success: true,
        data: {
          nomProvisoire: onboarding.nomProvisoire,
          classeSuggeree: onboarding.classe ? { name: onboarding.classe.name, level: onboarding.classe.level } : null,
          recipientType: onboarding.recipientType,
          sourceType: onboarding.sourceType,
          eleveADispositif: onboarding.eleveADispositif,
          parentADispositif: onboarding.parentADispositif,
        },
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Lien invalide' });
    }
  };

  // POST /api/v2/eleve-onboarding/token/:token/submit — public, protégé par le token lui-même
  soumettre = async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const token = String(req.params['token']);
      const { nom, prenom, dateNaissance, eleveADispositif, parentADispositif, ...donneesComplementaires } = req.body as {
        nom?: string; prenom?: string; dateNaissance?: string;
        eleveADispositif?: boolean; parentADispositif?: boolean; [key: string]: unknown;
      };
      if (!nom?.trim() || !prenom?.trim()) {
        res.status(400).json({ success: false, message: 'nom et prénom requis' });
        return;
      }

      const result = await this._soumettreFormulaire.execute({
        token, nom, prenom, dateNaissance, donneesComplementaires, eleveADispositif, parentADispositif,
      });
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Soumission impossible' });
    }
  };

  // GET /api/v2/eleve-onboarding?status=PENDING_VALIDATION
  lister = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      if (user.role !== 'ADMIN') {
        if (!await this.checkEnrollmentPermission(req, res)) return;
      }
      const schoolId = user.schoolId;
      const status = req.query['status'] as string | undefined;
      const dossiers = await this.onboardingRepository.listOnboardings(schoolId, status);
      res.json({ success: true, data: dossiers });
    } catch (err) { next(err); }
  };

  // POST /api/v2/eleve-onboarding/:id/inscrire — Inscription directe en 1 étape (Admin seulement)
  inscrire = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== 'ADMIN') {
        res.status(403).json({ success: false, message: 'Seul un administrateur peut valider et inscrire un dossier.' });
        return;
      }
      const schoolId = req.user!.schoolId;
      const validatedById = req.user!.userId;
      const validatorRole = req.user!.role;
      const onboardingId = String(req.params['id']);
      const { classId, derogationCapacite, motifDerogation } = req.body as {
        classId?: string;
        derogationCapacite?: boolean;
        motifDerogation?: string;
      };

      const result = await this._inscrire.execute({
        schoolId,
        onboardingId,
        validatedById,
        validatorRole,
        classId,
        derogationCapacite: derogationCapacite === true,
        motifDerogation,
      });
      const data = {
        ...result,
        comptesCrees: result.comptesCrees.map(({ temporaryPassword: _temporaryPassword, dispositifOS: _dispositifOS, ...compte }) => compte),
      };
      res.json({ success: true, data });
      const school = await this.schoolRepository.findById(schoolId);
      void notifierOnboardingValidationAvecEcole(schoolId, school?.name ?? null, school?.subdomain ?? null, result, this.credentialsNotifier);
    } catch (err) { next(err); }
  };

  // POST /api/v2/eleve-onboarding/:id/validate (alias conservé pour rétrocompatibilité)
  valider = async (req: Request, res: Response, next: NextFunction) => {
    return this.inscrire(req, res, next);
  };

  // POST /api/v2/eleve-onboarding/:id/submit — Secrétariat ou Admin soumet le dossier pour validation
  soumettreDossier = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!await this.checkEnrollmentPermission(req, res)) return;
      const schoolId = req.user!.schoolId;
      const submittedById = req.user!.userId;
      const submitterRole = req.user!.role;
      const onboardingId = String(req.params['id']);
      const { classId, nomProvisoire, submittedData } = req.body as {
        classId?: string;
        nomProvisoire?: string;
        submittedData?: Record<string, unknown>;
      };

      const result = await this._soumettreOnboarding.execute({
        schoolId,
        onboardingId,
        submittedById,
        submitterRole,
        classId,
        nomProvisoire,
        submittedData,
      });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  // POST /api/v2/eleve-onboarding/:id/return — Admin renvoie le dossier au secrétariat avec commentaire
  renvoyerDossier = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== 'ADMIN') {
        res.status(403).json({ success: false, message: 'Seul l’administrateur peut renvoyer un dossier au secrétariat.' });
        return;
      }
      const schoolId = req.user!.schoolId;
      const adminId = req.user!.userId;
      const adminRole = req.user!.role;
      const onboardingId = String(req.params['id']);
      const { commentaire } = req.body as { commentaire?: string };

      if (!commentaire?.trim()) {
        res.status(400).json({ success: false, message: 'Un commentaire expliquant le motif du renvoi est obligatoire.' });
        return;
      }

      const result = await this._renvoyerOnboarding.execute({
        schoolId,
        onboardingId,
        adminId,
        adminRole,
        commentaire: commentaire.trim(),
      });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  // POST /api/v2/eleve-onboarding/:id/reject
  rejeter = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      if (user.role !== 'ADMIN') {
        if (!await this.checkEnrollmentPermission(req, res)) return;
      }
      const schoolId = user.schoolId;
      const rejectedById = user.userId;
      const validatorRole = user.role;
      const staffPermissions = user.permissions;
      const onboardingId = String(req.params['id']);
      const { rejectionReason } = req.body as { rejectionReason?: string };
      if (!rejectionReason?.trim()) {
        res.status(400).json({ success: false, message: 'rejectionReason requis' });
        return;
      }

      const result = await this._rejeter.execute({ schoolId, onboardingId, rejectedById, validatorRole, staffPermissions, rejectionReason });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  // PATCH /api/v2/eleve-onboarding/admin-gestion
  toggleAdminGestion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== 'ADMIN') {
        res.status(403).json({ success: false, message: 'Seul un Administrateur peut modifier cette option' });
        return;
      }
      const schoolId = req.user!.schoolId;
      const userId = req.user!.userId;
      const { enabled } = req.body as { enabled?: boolean };
      if (enabled === undefined || typeof enabled !== 'boolean') {
        res.status(400).json({ success: false, message: 'Propriété "enabled" (boolean) requise' });
        return;
      }

      const result = await this._changerGestionAdmin.execute({ schoolId, adminUserId: userId, actif: enabled });
      res.json({ success: true, data: { adminGereInscriptions: result.adminGereInscriptions } });
    } catch (err) { next(err); }
  };

  // GET /api/v2/eleve-onboarding/settings
  getSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      if (user.role !== 'ADMIN') {
        if (!await this.checkEnrollmentPermission(req, res)) return;
      }
      const schoolId = user.schoolId;
      const settings = await this.onboardingRepository.findSettings(schoolId);
      const school = await this.schoolRepository.findById(schoolId);
      res.json({
        success: true,
        data: {
          ...(settings ?? {
            schoolId, selfServiceEnabled: false, defaultRecipient: 'ELEVE', ageThresholdForParent: 15,
            tokenExpiryDays: 14, reminderDelayDays: [3, 7], escalationDelayDays: 10, responsableRole: 'ADMIN',
            directAdmissionWithoutExam: false, capacityBufferPercent: 0,
          }),
          adminGereInscriptions: school?.adminGereInscriptions ?? false,
          adminGereFinances: school?.adminGereFinances ?? true,
        },
      });
    } catch (err) { next(err); }
  };

  // PATCH /api/v2/eleve-onboarding/settings
  updateSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const {
        selfServiceEnabled, defaultRecipient, ageThresholdForParent, tokenExpiryDays,
        reminderDelayDays, escalationDelayDays, responsableRole,
        directAdmissionWithoutExam, capacityBufferPercent,
        adminGereInscriptions, adminGereFinances,
      } = req.body as {
        selfServiceEnabled?: boolean; defaultRecipient?: 'ELEVE' | 'PARENT' | 'LES_DEUX'; ageThresholdForParent?: number;
        tokenExpiryDays?: number; reminderDelayDays?: number[]; escalationDelayDays?: number; responsableRole?: 'ADMIN' | 'STAFF';
        directAdmissionWithoutExam?: boolean; capacityBufferPercent?: number;
        adminGereInscriptions?: boolean; adminGereFinances?: boolean;
      };

      const data = {
        ...(selfServiceEnabled !== undefined && { selfServiceEnabled }),
        ...(defaultRecipient !== undefined && { defaultRecipient }),
        ...(ageThresholdForParent !== undefined && { ageThresholdForParent }),
        ...(tokenExpiryDays !== undefined && { tokenExpiryDays }),
        ...(reminderDelayDays !== undefined && { reminderDelayDays }),
        ...(escalationDelayDays !== undefined && { escalationDelayDays }),
        ...(responsableRole !== undefined && { responsableRole }),
        ...(directAdmissionWithoutExam !== undefined && { directAdmissionWithoutExam }),
        ...(capacityBufferPercent !== undefined && { capacityBufferPercent }),
      };

      const settings = await this.onboardingRepository.upsertSettings(schoolId, data);

      if (adminGereInscriptions !== undefined && req.user!.role === 'ADMIN') {
        await this._changerGestionAdmin.execute({
          schoolId,
          adminUserId: req.user!.userId,
          actif: adminGereInscriptions,
        });
      }

      if (adminGereFinances !== undefined && req.user!.role === 'ADMIN') {
        await this.schoolRepository.updateAdminGereFinances(schoolId, adminGereFinances);
      }

      const school = await this.schoolRepository.findById(schoolId);
      res.json({
        success: true,
        data: {
          ...settings,
          adminGereInscriptions: school?.adminGereInscriptions ?? false,
          adminGereFinances: school?.adminGereFinances ?? true,
        },
      });
    } catch (err) { next(err); }
  };

  // POST /api/v2/eleve-onboarding/:id/resend-link
  renvoyerLien = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      if (user.role !== 'ADMIN') {
        if (!await this.checkEnrollmentPermission(req, res)) return;
      }
      const schoolId = req.user!.schoolId;
      const createdById = req.user!.userId;
      const onboardingId = String(req.params['id']);

      const existing = await this.onboardingRepository.findOnboardingById(onboardingId, schoolId);
      if (!existing) {
        res.status(404).json({ success: false, message: 'Dossier introuvable' });
        return;
      }
      if (!['LINK_SENT', 'EXPIRED'].includes(existing.status)) {
        res.status(409).json({ success: false, message: `Impossible de renvoyer un lien pour un dossier au statut ${existing.status}` });
        return;
      }

      await this.onboardingRepository.marquerOnboardingExpire(existing.id);
      const result = await this._creerSquelette.execute({
        schoolId, createdById,
        nomProvisoire: existing.nomProvisoire,
        classId: existing.classId,
        contactEmail: existing.contactEmail,
        contactTelephone: existing.contactTelephone,
        parentContactEmail: existing.parentContactEmail,
        parentContactTelephone: existing.parentContactTelephone,
        recipientType: existing.recipientType,
        sourceType: existing.sourceType,
        examCandidateId: existing.examCandidateId,
        eleveADispositif: existing.eleveADispositif,
        eleveDispositifOS: existing.eleveDispositifOS as DispositifOS | null,
        parentADispositif: existing.parentADispositif,
        parentDispositifOS: existing.parentDispositifOS as DispositifOS | null,
        aucunContactDisponible: !existing.contactEmail && !existing.contactTelephone && !existing.parentContactEmail && !existing.parentContactTelephone,
      });
      res.json({ success: true, data: result });
      const school = await this.schoolRepository.findById(schoolId);
      void notifierOnboardingLienCreeAvecEcole(schoolId, school?.name ?? null, existing.nomProvisoire, result);
    } catch (err) { next(err); }
  };

  // GET /api/v2/eleve-onboarding/:id/pdf
  exporterPdf = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      if (user.role !== 'ADMIN') {
        if (!await this.checkEnrollmentPermission(req, res)) return;
      }
      const schoolId = user.schoolId;
      const onboardingId = String(req.params['id']);

      const onboarding = await this.onboardingRepository.findOnboardingForPdf(onboardingId, schoolId);
      if (!onboarding) {
        res.status(404).json({ success: false, message: 'Dossier introuvable' });
        return;
      }

      const formUrl = `${process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000'}/eleve-onboarding/${onboarding.token}`;
      const pdf = await generateOnboardingFormPdf({
        schoolName: onboarding.school?.name ?? 'Établissement',
        nomProvisoire: onboarding.nomProvisoire,
        classeSuggeree: onboarding.classe?.name ?? null,
        recipientType: onboarding.recipientType,
        formUrl,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="onboarding-${onboarding.id}.pdf"`);
      res.send(pdf);
    } catch (err) { next(err); }
  };
}
