import type { Request, Response, NextFunction } from 'express';
import { ZipArchive } from 'archiver';
import type { GenererBulletinUseCase } from '@application/reportCard/GenererBulletinUseCase';
import type { EnvoyerBulletinsUseCase } from '@application/reportCard/EnvoyerBulletinsUseCase';
import type { VerifierDisponibiliteBulletinUseCase } from '@application/reportCard/VerifierDisponibiliteBulletinUseCase';
import type { ListerBulletinsUseCase } from '@application/reportCard/ListerBulletinsUseCase';
import type { AjouterCommentaireBulletinUseCase } from '@application/reportCard/AjouterCommentaireBulletinUseCase';
import type { GenererCommentaireIAUseCase } from '@application/reportCard/GenererCommentaireIAUseCase';
import type { IAService } from '@domain/ports/services/IAService';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { SectionRepository } from '@domain/ports/repositories/SectionRepository';
import type { BulletinRepository } from '@domain/ports/repositories/BulletinRepository';
import type { ParentRepository } from '@domain/ports/repositories/ParentRepository';
import type { FactureRepository } from '@domain/ports/repositories/FactureRepository';
import type { SchoolConfigRepository } from '@domain/ports/repositories/SchoolConfigRepository';
import { BulletinBloqueError } from '@domain/errors/BulletinBloqueError';
import type { BulletinTemplate } from '@domain/types/enums';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import { notifyBulletinSms } from '@infrastructure/services/sms/SmsNotificationService';
import { resolveLanguage } from '../../../domain/policies/LanguagePolicy';
import { getEffectiveSchoolSettings } from '../../services/school-settings/SchoolSettingsService';
import {
  extractCommentPromptMetrics,
  filterParentReportCardsByUnpaidFees,
  isBulletinBlockedByUnpaidFees,
  renderReportCardPdfBuffer,
} from './helpers/reportCardControllerHelpers';

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
  ) {}

  // POST /api/v2/report-cards/generate
  genererBulletins = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      let { classId, academicPeriodId, academicYearId, template, nomEtablissement, logoUrl } = req.body;

      if (!classId) {
        res.status(400).json({ success: false, message: 'classId requis' });
        return;
      }

      // Auto-détection des paramètres manquants
      if (!academicPeriodId || !academicYearId) {
        const currentYear = await this.anneeRepository.findCourante(user.schoolId);
        if (!currentYear) {
          res.status(400).json({ success: false, message: 'Aucune année académique courante trouvée' });
          return;
        }
        academicYearId = academicYearId || currentYear.id;
        if (!academicPeriodId) {
          const periodes = await this.anneeRepository.findPeriodesByAnnee(currentYear.id);
          academicPeriodId = periodes[0]?.id;
        }
        if (!academicPeriodId) {
          res.status(400).json({ success: false, message: 'Aucune période académique trouvée' });
          return;
        }
      }
      if (!template) {
        const settings = await getEffectiveSchoolSettings(user.schoolId);
        template = settings.bulletinTemplate ?? 'FR_SECONDARY';
      }
      if (!nomEtablissement) {
        const school = await this.schoolRepository.findById(user.schoolId);
        nomEtablissement = school?.name ?? 'Établissement';
      }

      // Horodatage capturé AVANT la génération pour filtrer uniquement les nouveaux bulletins
      const generationStartedAt = new Date()

      const resultat = await this.generer.execute({
        schoolId: user.schoolId, classId, academicPeriodId, academicYearId,
        template: template as BulletinTemplate, nomEtablissement, logoUrl, demandeurId: user.userId,
      });

      this.audit.journaliser({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'generer_bulletins_classe', targetType: 'Class', targetId: classId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { classId, academicPeriodId, academicYearId, template },
      });
      res.json({ success: true, data: resultat });

      // Fire-and-forget SMS bulletin disponible — hors du try principal
      if (resultat.bulletinsGeneres > 0) {
        const schoolId = user.schoolId as string
        void (async () => {
          try {
            const period = await this.anneeRepository.findPeriodeById(academicPeriodId, schoolId)
            const periodName = period?.name ?? 'Période'
            const bulletins = await this.bulletinRepository.findRecentSince(schoolId, academicPeriodId, generationStartedAt)
            await Promise.all(bulletins.map((b) => notifyBulletinSms({
              schoolId, studentId: b.studentId, periodName,
              studentName: `${b.student.firstName ?? ''} ${b.student.lastName ?? ''}`.trim(),
            })))
          } catch (err) {
            console.error('[SMS Bulletin fire-and-forget]', err)
          }
        })()
      }
    } catch (error) {
      const user = req.user;
      this.audit.journaliser({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'generer_bulletins_classe', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      if (error instanceof BulletinBloqueError) {
        res.status(422).json({ success: false, code: 'NOTES_NON_VALIDEES', message: error.message, notesBloquantes: error.notesBloquantes });
        return;
      }
      if (error instanceof Error && error.message.includes('Conseil de Classe')) {
        res.status(422).json({ success: false, code: 'CONSEIL_REQUIS', message: error.message });
        return;
      }
      next(error);
    }
  };

  // POST /api/v2/report-cards/send
  envoyerBulletins = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      let { classId, academicPeriodId, nomEtablissement, nomPeriode } = req.body;
      if (!classId) { res.status(400).json({ success: false, message: 'classId requis' }); return; }

      // Auto-résolution des paramètres manquants
      if (!academicPeriodId) {
        const currentYear = await this.anneeRepository.findCourante(user.schoolId);
        if (currentYear) {
          const periodes = await this.anneeRepository.findPeriodesByAnnee(currentYear.id);
          const currentPeriod = periodes.find(p => p.isCurrent) || periodes[0];
          academicPeriodId = currentPeriod?.id;
          if (!nomPeriode && currentPeriod) nomPeriode = currentPeriod.name;
        }
      }

      if (!academicPeriodId) { res.status(400).json({ success: false, message: 'academicPeriodId requis ou aucune période active trouvée' }); return; }

      const ecole = await this.schoolRepository.findById(user.schoolId);
      if (!nomEtablissement) nomEtablissement = ecole?.name ?? 'Établissement';

      if (!nomPeriode) {
        const periode = await this.anneeRepository.findPeriodeById(academicPeriodId, user.schoolId);
        nomPeriode = periode?.name ?? 'Trimestre';
      }

      // Langue de l'email = sous-système de l'école, affiné par la section de la classe si bilingue.
      let sectionCode: string | null = null;
      if (ecole?.subsystem === 'BILINGUAL') {
        const cls = await this.classeRepository.findById(classId);
        if (cls?.sectionId) {
          const section = await this.sectionRepository.findById(cls.sectionId);
          sectionCode = section?.code ?? null;
        }
      }
      const langue = resolveLanguage(ecole?.subsystem, sectionCode);

      const resultat = await this.envoyer.execute({
        schoolId: user.schoolId,
        classId,
        academicPeriodId,
        nomEtablissement,
        nomPeriode,
        langue,
        demandeurRole: user.role,
        demandeurId: user.userId,
      });
      this.audit.journaliser({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'envoyer_bulletins_parents', targetType: 'Class', targetId: classId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { classId, academicPeriodId },
      });
      res.json({ success: true, data: resultat });
    } catch (error) {
      const user = req.user;
      const message = error instanceof Error ? error.message : 'Erreur lors de l\'envoi des bulletins';
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
      const user = req.user;
      const classId = req.params.classId as string;
      const periodId = req.query.periodId as string | undefined;
      if (!this.verifierUseCase) throw new Error('VerifierDisponibiliteBulletinUseCase non câblé');
      const result = await this.verifierUseCase.execute({ classId, schoolId: user.schoolId, academicPeriodId: periodId });
      res.json(result);
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
      const user = req.user;
      const classId = req.params.classId as string;
      let { academicPeriodId } = req.body || {};

      if (!academicPeriodId) {
        const currentYear = await this.anneeRepository.findCourante(user.schoolId);
        if (currentYear) {
          const periodes = await this.anneeRepository.findPeriodesByAnnee(currentYear.id);
          const currentPeriod = periodes.find(p => p.isCurrent) || periodes[0];
          academicPeriodId = currentPeriod?.id;
        }
      }

      if (!academicPeriodId) {
        res.status(400).json({ success: false, message: 'academicPeriodId requis ou aucune période active trouvée' });
        return;
      }

      const reportCards = await this.bulletinRepository.findForExport(user.schoolId, academicPeriodId, classId);

      if (!reportCards.length) {
        res.status(404).json({ success: false, message: 'Aucun bulletin trouvé pour cette classe et cette période. Veuillez d\'abord générer les bulletins.' });
        return;
      }

      const settings = await getEffectiveSchoolSettings(user.schoolId);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="bulletins-${classId}-${academicPeriodId}.zip"`);

      const archive = new ZipArchive({ zlib: { level: 6 } });
      archive.pipe(res);

      for (const reportCard of reportCards) {
        const { pdfBuffer, studentName } = await renderReportCardPdfBuffer(
          reportCard,
          user.schoolId,
          'ADMIN',
          settings,
        );
        archive.append(pdfBuffer, { name: `bulletin-${studentName.replace(/\s+/g, '-')}.pdf` });
      }

      await archive.finalize();
    } catch (error) {
      if (!res.headersSent) {
        const message = error instanceof Error ? error.message : 'Erreur lors de la génération du ZIP';
        res.status(500).json({ success: false, message });
        return;
      }
      next(error);
    }
  };

  // PATCH /api/v2/report-cards/:id/comment
  // Réservé au Professeur Principal de la classe du bulletin.
  // Un Admin peut aussi corriger un commentaire.
  ajouterCommentaire = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const role: string = (user.role as string).toUpperCase();
      const { classMasterComment } = req.body;

      if (typeof classMasterComment !== 'string' || !classMasterComment.trim()) {
        res.status(400).json({ success: false, message: 'classMasterComment (string non vide) requis' });
        return;
      }

      const ctx = await this.bulletinRepository.findWithClasseContext(req.params.id as string, user.schoolId);
      if (!ctx) {
        res.status(404).json({ success: false, message: 'Bulletin introuvable' });
        return;
      }

      // Seul le Professeur Principal de la classe ou un Admin peut écrire le commentaire
      const professorPrincipalId = ctx.professorPrincipalId;
      const isPP = professorPrincipalId === user.userId;
      if (role !== 'ADMIN' && !isPP) {
        res.status(403).json({
          success: false,
          message: "Seul le Professeur Principal de cette classe ou un Admin peut écrire ce commentaire",
        });
        return;
      }

      await this.bulletinRepository.updateClassMasterComment(req.params.id as string, classMasterComment.trim());

      res.json({ success: true, message: 'Commentaire enregistré' });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/report-cards/:id/generate-comment
  // Suggère un commentaire de bulletin via IA (stocké dans aiComment) — le Professeur
  // Principal le relit et le modifie ensuite via PATCH /:id/comment (classMasterComment
  // reste inchangé ici, jamais écrasé automatiquement).
  // Réservé au Professeur Principal de la classe ou à un Admin (même règle que /comment).
  genererCommentaireIA = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const role: string = (user.role as string).toUpperCase();

      const enriched = await this.bulletinRepository.findEnrichedById(req.params.id as string, user.schoolId);
      if (!enriched) {
        res.status(404).json({ success: false, message: 'Bulletin introuvable' });
        return;
      }
      const reportCard = enriched.bulletin;
      const professorPrincipalId = enriched.professorPrincipalId;
      const isPP = professorPrincipalId === user.userId;
      if (role !== 'ADMIN' && !isPP) {
        res.status(403).json({
          success: false,
          message: "Seul le Professeur Principal de cette classe ou un Admin peut générer ce commentaire",
        });
        return;
      }

      const previous = await this.bulletinRepository.findPreviousByStudent(reportCard.studentId, user.schoolId, reportCard.id);
      const { evolution, pointsForts, pointsFaibles } = extractCommentPromptMetrics(
        previous?.generalAverage,
        reportCard.generalAverage,
        reportCard.lignesMatiere,
      );
      const langue = resolveLanguage(enriched.schoolSubsystem, enriched.sectionCode);
      const nomEleve = `${enriched.studentFirstName ?? ''} ${enriched.studentLastName ?? ''}`.trim();

      const comment = await this.iaService.genererCommentaireBulletin({
        nomEleve,
        moyenneGenerale: reportCard.generalAverage ?? 0,
        evolution,
        pointsForts,
        pointsFaibles,
        langue: langue.toUpperCase() as 'FR' | 'EN',
      });
      await this.bulletinRepository.updateAiComment(reportCard.id, comment);
      res.json({ success: true, comment });
    } catch (error) {
      console.error('[genererCommentaireIA]', error);
      res.status(502).json({ success: false, message: 'Erreur lors de la génération du commentaire IA — réessayez ou saisissez-le manuellement.' });
    }
  };

  // GET /api/v2/report-cards/my
  mesBulletins = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const yearId = req.query.yearId as string | undefined;
      if (!this.listerUseCase) throw new Error('ListerBulletinsUseCase non câblé');
      if (String(user.role).toUpperCase() === 'STUDENT') {
        const blocked = await isBulletinBlockedByUnpaidFees({
          schoolConfigRepository: this.schoolConfigRepository,
          factureRepository: this.factureRepository,
          schoolId: user.schoolId,
          studentId: user.userId,
        });
        if (blocked) {
          res.status(403).json({ success: false, code: 'BULLETIN_BLOCKED_UNPAID_FEES', message: 'Accès aux bulletins bloqué : solde de scolarité impayé' });
          return;
        }
      }
      const result = await this.listerUseCase.mesBulletins({ schoolId: user.schoolId, studentId: user.userId, academicYearId: yearId });
      res.json(result);
    } catch (error) { next(error); }
  };

  // GET /api/v2/report-cards
  lister = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const role = (user.role as string).toUpperCase();
      const studentIdQuery = req.query.studentId as string | undefined;
      if (!this.listerUseCase) throw new Error('ListerBulletinsUseCase non câblé');

      if (role === 'STUDENT' || (role === 'PARENT' && studentIdQuery)) {
        const targetStudentId = role === 'STUDENT' ? user.userId : studentIdQuery!;
        if (role === 'PARENT' && !(await this.parentRepository.aAccesEleve(user.userId, targetStudentId))) {
          res.status(403).json({ success: false, message: 'Non autorisé' });
          return;
        }
        const blocked = await isBulletinBlockedByUnpaidFees({
          schoolConfigRepository: this.schoolConfigRepository,
          factureRepository: this.factureRepository,
          schoolId: user.schoolId,
          studentId: targetStudentId,
        });
        if (blocked) {
          res.status(403).json({ success: false, code: 'BULLETIN_BLOCKED_UNPAID_FEES', message: 'Accès aux bulletins bloqué : solde de scolarité impayé' });
          return;
        }
      }

      const result = await this.listerUseCase.lister({
        schoolId: user.schoolId,
        role,
        userId: user.userId,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
        academicYearId: req.query.yearId as string | undefined,
        academicPeriodId: req.query.periodId as string | undefined,
        studentId: studentIdQuery,
        classId: req.query.classId as string | undefined,
      });

      if (role === 'PARENT' && !studentIdQuery) {
        const feeCheck = await filterParentReportCardsByUnpaidFees({
          schoolConfigRepository: this.schoolConfigRepository,
          factureRepository: this.factureRepository,
          schoolId: user.schoolId,
          reportCards: result.reportCards,
        });
        if (feeCheck.blockedAll) {
          res.status(403).json({ success: false, code: 'BULLETIN_BLOCKED_UNPAID_FEES', message: 'Accès aux bulletins bloqué : solde de scolarité impayé' });
          return;
        }
        res.json({ ...result, reportCards: feeCheck.filtered });
        return;
      }

      res.json(result);
    } catch (error) { next(error); }
  };

  // GET /api/v2/report-cards/:id/pdf
  telechargerPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const role: string = (user.role as string).toUpperCase();
      const reportCard = await this.bulletinRepository.findForPdf(req.params.id as string, user.schoolId);
      if (!reportCard) { res.status(404).json({ success: false, message: 'Bulletin introuvable' }); return; }
      if (role === 'STUDENT' && reportCard.studentId !== user.userId) { res.status(403).json({ success: false, message: 'Non autorisé' }); return; }
      if (role === 'PARENT' && !(await this.parentRepository.aAccesEleve(user.userId, reportCard.studentId))) {
        res.status(403).json({ success: false, message: 'Non autorisé' });
        return;
      }
      if (role === 'STUDENT' || role === 'PARENT') {
        const blocked = await isBulletinBlockedByUnpaidFees({
          schoolConfigRepository: this.schoolConfigRepository,
          factureRepository: this.factureRepository,
          schoolId: user.schoolId,
          studentId: reportCard.studentId,
        });
        if (blocked) {
          res.status(403).json({ success: false, code: 'BULLETIN_BLOCKED_UNPAID_FEES', message: 'Téléchargement du bulletin bloqué en raison de frais de scolarité impayés' });
          return;
        }
      }
      const { pdfBuffer, filename } = await renderReportCardPdfBuffer(reportCard, user.schoolId, role);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.end(pdfBuffer);
    } catch (error) { next(error); }
  };
}
