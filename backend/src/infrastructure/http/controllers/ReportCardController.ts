import type { Request, Response, NextFunction } from 'express';
import type { GenererBulletinUseCase } from '@application/reportCard/GenererBulletinUseCase';
import type { EnvoyerBulletinsUseCase } from '@application/reportCard/EnvoyerBulletinsUseCase';
import type { VerifierDisponibiliteBulletinUseCase } from '@application/reportCard/VerifierDisponibiliteBulletinUseCase';
import type { ListerBulletinsUseCase } from '@application/reportCard/ListerBulletinsUseCase';
import type { IAService } from '@domain/ports/services/IAService';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { SectionRepository } from '@domain/ports/repositories/SectionRepository';
import type { BulletinRepository } from '@domain/ports/repositories/BulletinRepository';
import type { ParentRepository } from '@domain/ports/repositories/ParentRepository';
import type { FactureRepository } from '@domain/ports/repositories/FactureRepository';
import type { SchoolConfigRepository } from '@domain/ports/repositories/SchoolConfigRepository';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import type { BulletinRendererPort } from '@domain/ports/services/BulletinRendererPort';
import type { BulletinPdfStoragePort } from '@domain/ports/services/BulletinPdfStoragePort';
import {
  addClassMasterCommentOp,
  filterParentReportCardsByUnpaidFees,
  generateBulletinAiCommentOp,
  isBulletinBlockedByUnpaidFees,
  renderReportCardPdfBuffer,
} from './helpers/reportCardControllerHelpers';
import {
  handleGenerateBulletinsError,
  resolveGenerateBulletinParams,
  resolveSendBulletinsParams,
  streamClassReportCardsZip,
  triggerBulletinSmsFireAndForget,
} from './helpers/reportCardGenerationOps';

export class ReportCardController {
  constructor(
    private readonly generer: GenererBulletinUseCase,
    private readonly envoyer: EnvoyerBulletinsUseCase,
    private readonly iaService: IAService,
    private readonly schoolRepository: SchoolRepository,
    private readonly classeRepository: ClasseRepository,
    private readonly anneeRepository: AnneeAcademiqueRepository,
    private readonly sectionRepository: SectionRepository,
    private readonly bulletinRepository: BulletinRepository,
    private readonly parentRepository: ParentRepository,
    private readonly audit: AIActionAuditPort,
    private readonly verifierUseCase?: VerifierDisponibiliteBulletinUseCase,
    private readonly listerUseCase?: ListerBulletinsUseCase,
    private readonly factureRepository?: FactureRepository,
    private readonly schoolConfigRepository?: SchoolConfigRepository,
    private readonly bulletinRenderer?: BulletinRendererPort,
    private readonly bulletinPdfStorage?: BulletinPdfStoragePort,
  ) {}

  // POST /api/v2/report-cards/generate
  genererBulletins = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { error, data } = await resolveGenerateBulletinParams({
        body: req.body, schoolId: user.schoolId, anneeRepository: this.anneeRepository, schoolRepository: this.schoolRepository,
      });
      if (error || !data) {
        res.status(error?.status ?? 400).json({ success: false, message: error?.message ?? 'Requête invalide' });
        return;
      }
      const generationStartedAt = new Date();
      const resultat = await this.generer.execute({
        schoolId: user.schoolId, ...data,
        demandeurId: user.userId, demandeurRole: user.role,
      });
      this.audit.journaliser({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'generer_bulletins_classe', targetType: 'Class', targetId: data.classId,
        origin: 'UI_DIRECT', outcome: 'SUCCES',
        parametersSummary: { classId: data.classId, academicPeriodId: data.academicPeriodId, academicYearId: data.academicYearId, template: data.template },
      });
      res.json({ success: true, data: resultat });
      if (resultat.bulletinsGeneres > 0) {
        triggerBulletinSmsFireAndForget({
          schoolId: user.schoolId, academicPeriodId: data.academicPeriodId, generationStartedAt,
          anneeRepository: this.anneeRepository, bulletinRepository: this.bulletinRepository,
        });
      }
    } catch (error) {
      const user = req.user;
      this.audit.journaliser({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'generer_bulletins_classe', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      handleGenerateBulletinsError(error, res, next);
    }
  };

  // POST /api/v2/report-cards/send
  envoyerBulletins = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { error, data } = await resolveSendBulletinsParams({
        body: req.body, schoolId: user.schoolId, anneeRepository: this.anneeRepository,
        schoolRepository: this.schoolRepository, classeRepository: this.classeRepository, sectionRepository: this.sectionRepository,
      });
      if (error || !data) {
        res.status(error?.status ?? 400).json({ success: false, message: error?.message ?? 'Requête invalide' });
        return;
      }
      const resultat = await this.envoyer.execute({
        schoolId: user.schoolId, ...data, demandeurRole: user.role, demandeurId: user.userId,
      });
      this.audit.journaliser({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'envoyer_bulletins_parents', targetType: 'Class', targetId: data.classId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { classId: data.classId, academicPeriodId: data.academicPeriodId },
      });
      res.json({ success: true, data: resultat });
    } catch (error) {
      const user = req.user;
      const message = error instanceof Error ? error.message : "Erreur lors de l'envoi des bulletins";
      this.audit.journaliser({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'envoyer_bulletins_parents', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: message, parametersSummary: req.body,
      });
      res.status(400).json({ success: false, message });
    }
  };

  // GET /api/v2/report-cards/check/:classId
  verifierDisponibilite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.verifierUseCase) throw new Error('VerifierDisponibiliteBulletinUseCase non câblé');
      res.json(await this.verifierUseCase.execute({
        classId: req.params.classId as string, schoolId: req.user.schoolId, academicPeriodId: req.query.periodId as string | undefined,
      }));
    } catch (error) {
      if (error instanceof Error && error.message.includes('Aucune période')) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };

  // POST /api/v2/report-cards/export/:classId
  exporterZip = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await streamClassReportCardsZip({
        res, schoolId: req.user.schoolId, classId: req.params.classId as string,
        requestedPeriodId: req.body?.academicPeriodId as string | undefined,
        anneeRepository: this.anneeRepository, bulletinRepository: this.bulletinRepository,
        bulletinRenderer: this.bulletinRenderer, bulletinPdfStorage: this.bulletinPdfStorage,
      });
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Erreur lors de la génération du ZIP' });
        return;
      }
      next(error);
    }
  };

  // PATCH /api/v2/report-cards/:id/comment
  ajouterCommentaire = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const out = await addClassMasterCommentOp({
        bulletinId: req.params.id as string, schoolId: req.user.schoolId, userId: req.user.userId,
        role: String(req.user.role).toUpperCase(), classMasterComment: req.body.classMasterComment, bulletinRepository: this.bulletinRepository,
      });
      res.status(out.status).json(out.body);
    } catch (error) { next(error); }
  };

  // POST /api/v2/report-cards/:id/generate-comment
  genererCommentaireIA = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const out = await generateBulletinAiCommentOp({
        bulletinId: req.params.id as string, schoolId: req.user.schoolId, userId: req.user.userId,
        role: String(req.user.role).toUpperCase(), bulletinRepository: this.bulletinRepository, iaService: this.iaService,
      });
      res.status(out.status).json(out.body);
    } catch (error) {
      console.error('[genererCommentaireIA]', error);
      res.status(502).json({ success: false, message: 'Erreur lors de la génération du commentaire IA — réessayez ou saisissez-le manuellement.' });
    }
  };

  // GET /api/v2/report-cards/my
  mesBulletins = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!this.listerUseCase) throw new Error('ListerBulletinsUseCase non câblé');
      if (String(user.role).toUpperCase() === 'STUDENT') {
        const blocked = await isBulletinBlockedByUnpaidFees({
          schoolConfigRepository: this.schoolConfigRepository, factureRepository: this.factureRepository, schoolId: user.schoolId, studentId: user.userId,
        });
        if (blocked) { res.status(403).json({ success: false, code: 'BULLETIN_BLOCKED_UNPAID_FEES', message: 'Accès aux bulletins bloqué : solde de scolarité impayé' }); return; }
      }
      res.json(await this.listerUseCase.mesBulletins({ schoolId: user.schoolId, studentId: user.userId, academicYearId: req.query.yearId as string | undefined }));
    } catch (error) { next(error); }
  };

  // GET /api/v2/report-cards
  lister = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const role = String(user.role).toUpperCase();
      const studentIdQuery = req.query.studentId as string | undefined;
      if (!this.listerUseCase) throw new Error('ListerBulletinsUseCase non câblé');
      if (role === 'STUDENT' || (role === 'PARENT' && studentIdQuery)) {
        const targetStudentId = role === 'STUDENT' ? user.userId : studentIdQuery!;
        if (role === 'PARENT' && !(await this.parentRepository.aAccesEleve(user.userId, targetStudentId))) {
          res.status(403).json({ success: false, message: 'Non autorisé' }); return;
        }
        const blocked = await isBulletinBlockedByUnpaidFees({
          schoolConfigRepository: this.schoolConfigRepository, factureRepository: this.factureRepository, schoolId: user.schoolId, studentId: targetStudentId,
        });
        if (blocked) { res.status(403).json({ success: false, code: 'BULLETIN_BLOCKED_UNPAID_FEES', message: 'Accès aux bulletins bloqué : solde de scolarité impayé' }); return; }
      }
      const result = await this.listerUseCase.lister({
        schoolId: user.schoolId, role, userId: user.userId, page: Number(req.query.page) || 1, limit: Number(req.query.limit) || 10,
        academicYearId: req.query.yearId as string | undefined, academicPeriodId: req.query.periodId as string | undefined,
        studentId: studentIdQuery, classId: req.query.classId as string | undefined,
      });
      if (role === 'PARENT' && !studentIdQuery) {
        const feeCheck = await filterParentReportCardsByUnpaidFees({
          schoolConfigRepository: this.schoolConfigRepository, factureRepository: this.factureRepository, schoolId: user.schoolId, reportCards: result.reportCards,
        });
        if (feeCheck.blockedAll) { res.status(403).json({ success: false, code: 'BULLETIN_BLOCKED_UNPAID_FEES', message: 'Accès aux bulletins bloqué : solde de scolarité impayé' }); return; }
        res.json({ ...result, reportCards: feeCheck.filtered }); return;
      }
      res.json(result);
    } catch (error) { next(error); }
  };

  // GET /api/v2/report-cards/:id/pdf
  telechargerPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const role = String(user.role).toUpperCase();
      const reportCard = await this.bulletinRepository.findForPdf(req.params.id as string, user.schoolId);
      if (!reportCard) { res.status(404).json({ success: false, message: 'Bulletin introuvable' }); return; }
      if (role === 'STUDENT' && reportCard.studentId !== user.userId) { res.status(403).json({ success: false, message: 'Non autorisé' }); return; }
      if (role === 'PARENT' && !(await this.parentRepository.aAccesEleve(user.userId, reportCard.studentId))) {
        res.status(403).json({ success: false, message: 'Non autorisé' }); return;
      }
      if (role === 'STUDENT' || role === 'PARENT') {
        const blocked = await isBulletinBlockedByUnpaidFees({
          schoolConfigRepository: this.schoolConfigRepository, factureRepository: this.factureRepository, schoolId: user.schoolId, studentId: reportCard.studentId,
        });
        if (blocked) { res.status(403).json({ success: false, code: 'BULLETIN_BLOCKED_UNPAID_FEES', message: 'Téléchargement du bulletin bloqué en raison de frais de scolarité impayés' }); return; }
      }
      const { pdfBuffer, filename } = await renderReportCardPdfBuffer(reportCard, user.schoolId, role, undefined, {
        bulletinRenderer: this.bulletinRenderer,
        bulletinPdfStorage: this.bulletinPdfStorage,
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.end(pdfBuffer);
    } catch (error) { next(error); }
  };

  // POST /api/v2/report-cards/:id/reprint (ADMIN / STAFF avec motif obligatoire + audit)
  reimprimerDuplicata = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const role = String(user.role).toUpperCase();
      if (role !== 'ADMIN' && role !== 'STAFF') {
        res.status(403).json({ success: false, message: 'Seuls ADMIN ou STAFF peuvent émettre un duplicata officiel.' });
        return;
      }

      const rawMotif =
        typeof req.body?.motif === 'string'
          ? req.body.motif
          : typeof req.body?.reason === 'string'
            ? req.body.reason
            : '';
      const motif = rawMotif.trim();
      if (!motif) {
        res.status(400).json({
          success: false,
          message: 'Un motif obligatoire (motif) est requis pour réimprimer un duplicata.',
        });
        return;
      }

      const reportCard = await this.bulletinRepository.findForPdf(req.params.id as string, user.schoolId);
      if (!reportCard) {
        res.status(404).json({ success: false, message: 'Bulletin introuvable' });
        return;
      }

      const nextCount = await this.bulletinRepository.incrementReprintCount(reportCard.id, user.schoolId);
      reportCard.reprintCount = nextCount;

      const { pdfBuffer, filename } = await renderReportCardPdfBuffer(reportCard, user.schoolId, role, undefined, {
        bulletinRenderer: this.bulletinRenderer,
        bulletinPdfStorage: this.bulletinPdfStorage,
        forceRegenerateFromSnapshot: true,
        persistRegeneratedPdf: true,
      });

      this.audit.journaliser({
        actorUserId: user.userId,
        actorRole: user.role,
        schoolId: user.schoolId,
        actionName: 'reimprimer_duplicata_bulletin',
        targetType: 'ReportCard',
        targetId: reportCard.id,
        origin: 'UI_DIRECT',
        outcome: 'SUCCES',
        parametersSummary: {
          bulletinId: reportCard.id,
          studentId: reportCard.studentId,
          reprintCount: nextCount,
          motif,
        },
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('X-Reprint-Count', String(nextCount));
      res.setHeader('Content-Disposition', `inline; filename="duplicata-${nextCount}-${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.end(pdfBuffer);
    } catch (error) { next(error); }
  };
}
