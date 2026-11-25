import type { Request, Response, NextFunction } from 'express';
import type { EntranceExamRepository } from '@domain/ports/repositories/EntranceExamRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import type { EntranceExamPdfPort } from '@domain/ports/services/EntranceExamPdfPort';
import type { CreerSessionConcoursUseCase } from '@application/entranceExam/CreerSessionConcoursUseCase';
import type { AjouterCandidatsConcoursUseCase } from '@application/entranceExam/AjouterCandidatsConcoursUseCase';
import type { CalculerAdmissionConcoursUseCase } from '@application/entranceExam/CalculerAdmissionConcoursUseCase';
import type { EnregistrerResultatCepUseCase } from '@application/entranceExam/EnregistrerResultatCepUseCase';
import type { ResumeSessionConcoursUseCase } from '@application/entranceExam/ResumeSessionConcoursUseCase';
import type { ScannerListeCandidatsUseCase } from '@application/entranceExam/ScannerListeCandidatsUseCase';
import type { DetecterAnomaliesConcoursUseCase } from '@application/entranceExam/DetecterAnomaliesConcoursUseCase';
import type { InscrireCandidatConcoursUseCase } from '@application/entranceExam/InscrireCandidatConcoursUseCase';
import type { RepartirCandidatsSallesUseCase } from '@application/entranceExam/RepartirCandidatsSallesUseCase';
import type { SaisirNotesConcoursUseCase } from '@application/entranceExam/SaisirNotesConcoursUseCase';
import type { SimulerDeliberationConcoursUseCase } from '@application/entranceExam/SimulerDeliberationConcoursUseCase';
import type { PublierResultatsConcoursUseCase } from '@application/entranceExam/PublierResultatsConcoursUseCase';
import type { FinaliserAdmissionsConcoursUseCase } from '@application/entranceExam/FinaliserAdmissionsConcoursUseCase';
import type { EnregistrerPresenceCandidatUseCase } from '@application/entranceExam/EnregistrerPresenceCandidatUseCase';
import type { EstimerCampagneSmsPublicationUseCase } from '@application/entranceExam/EstimerCampagneSmsPublicationUseCase';
import type { ProposerSaisieLotCepUseCase } from '@application/entranceExam/ProposerSaisieLotCepUseCase';
import type { AppliquerSaisieLotCepUseCase } from '@application/entranceExam/AppliquerSaisieLotCepUseCase';
import {
  ajouterCandidatsAction,
  detecterAnomaliesAction,
  enregistrerPresenceAction,
  genererConvocationPdfAction,
  genererEmargementPdfAction,
  importCandidatsAction,
  inscrireCandidatGuichetAction,
  scannerAction,
  type EntranceExamCandidateDeps,
} from './helpers/entranceExamCandidateHelper';
import {
  appliquerLotCepAction,
  calculerAdmissionAction,
  enregistrerCepAction,
  estimerCampagneSmsAction,
  finaliserAdmissionsAction,
  proposerLotCepAction,
  publierResultatsAction,
  saisirNotesAction,
  simulerDeliberationAction,
  type EntranceExamDeliberationDeps,
} from './helpers/entranceExamDeliberationHelper';

export class EntranceExamController {
  constructor(
    private readonly _creerSession: CreerSessionConcoursUseCase,
    private readonly _ajouterCandidats: AjouterCandidatsConcoursUseCase,
    private readonly _calculerAdmission: CalculerAdmissionConcoursUseCase,
    private readonly _enregistrerCep: EnregistrerResultatCepUseCase,
    private readonly _resumeSession: ResumeSessionConcoursUseCase,
    private readonly _scannerListe: ScannerListeCandidatsUseCase,
    private readonly _detecterAnomalies: DetecterAnomaliesConcoursUseCase,
    private readonly _inscrireCandidat: InscrireCandidatConcoursUseCase,
    private readonly _repartirSalles: RepartirCandidatsSallesUseCase,
    private readonly _saisirNotes: SaisirNotesConcoursUseCase,
    private readonly _simulerDeliberation: SimulerDeliberationConcoursUseCase,
    private readonly _publierResultats: PublierResultatsConcoursUseCase,
    private readonly _finaliserAdmissions: FinaliserAdmissionsConcoursUseCase,
    private readonly entranceExamRepository: EntranceExamRepository,
    private readonly schoolRepository: SchoolRepository,
    private readonly entranceExamPdfPort: EntranceExamPdfPort,
    private readonly audit: AIActionAuditPort,
    private readonly _enregistrerPresence?: EnregistrerPresenceCandidatUseCase,
    private readonly _estimerCampagneSms?: EstimerCampagneSmsPublicationUseCase,
    private readonly _proposerSaisieLotCep?: ProposerSaisieLotCepUseCase,
    private readonly _appliquerSaisieLotCep?: AppliquerSaisieLotCepUseCase,
  ) {}

  private get candidateDeps(): EntranceExamCandidateDeps {
    return {
      ajouterCandidats: this._ajouterCandidats,
      scannerListe: this._scannerListe,
      detecterAnomalies: this._detecterAnomalies,
      inscrireCandidat: this._inscrireCandidat,
      entranceExamRepository: this.entranceExamRepository,
      schoolRepository: this.schoolRepository,
      entranceExamPdfPort: this.entranceExamPdfPort,
      enregistrerPresence: this._enregistrerPresence,
    };
  }

  private get deliberationDeps(): EntranceExamDeliberationDeps {
    return {
      calculerAdmission: this._calculerAdmission,
      enregistrerCep: this._enregistrerCep,
      saisirNotes: this._saisirNotes,
      simulerDeliberation: this._simulerDeliberation,
      publierResultats: this._publierResultats,
      finaliserAdmissions: this._finaliserAdmissions,
      estimerCampagneSms: this._estimerCampagneSms,
      proposerSaisieLotCep: this._proposerSaisieLotCep,
      appliquerSaisieLotCep: this._appliquerSaisieLotCep,
    };
  }

  // GET /api/v2/entrance-exams
  lister = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const sessions = await this.entranceExamRepository.listerSessions(schoolId);
      res.json({ success: true, data: sessions });
    } catch (err) { next(err); }
  };

  // POST /api/v2/entrance-exams
  creer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const {
        name,
        examDate,
        academicYearId,
        admissionThreshold,
        availableSeats,
        registrationDeadline,
        requireCepForAdmission,
        seatReservationDays,
        officialExamExpectedDate,
        targetClassId,
      } = req.body;
      if (!name || !examDate || !academicYearId) {
        res.status(400).json({ success: false, message: 'name, examDate, academicYearId requis' });
        return;
      }
      const session = await this.entranceExamRepository.creerSession({
        schoolId,
        name,
        examDate: new Date(examDate),
        academicYearId,
        admissionThreshold: admissionThreshold != null ? Number(admissionThreshold) : null,
        availableSeats: availableSeats != null ? Number(availableSeats) : null,
        registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
        requireCepForAdmission: Boolean(requireCepForAdmission),
        seatReservationDays: seatReservationDays ? Number(seatReservationDays) : 14,
        officialExamExpectedDate: officialExamExpectedDate ? new Date(officialExamExpectedDate) : null,
        targetClassId: targetClassId ?? null,
      });

      this.audit.journaliser({
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'creer_session_concours_entree', targetType: 'EntranceExamSession', targetId: session.id,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: req.body,
      });
      res.status(201).json({ success: true, data: { sessionId: session.id } });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v2/entrance-exams/:id/details
  details = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = String(req.params['id']);
      const session = this.entranceExamRepository.trouverSessionAvecDetails
        ? await this.entranceExamRepository.trouverSessionAvecDetails(sessionId)
        : await this.entranceExamRepository.trouverSession(sessionId);

      if (!session || session.schoolId !== req.user!.schoolId) {
        res.status(404).json({ success: false, message: 'Session introuvable' });
        return;
      }
      res.json({ success: true, data: session });
    } catch (err) { next(err); }
  };

  // POST /api/v2/entrance-exams/:id/subjects
  configurerMatieres = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = String(req.params['id']);
      const { subjects } = req.body;
      if (!Array.isArray(subjects)) {
        res.status(400).json({ success: false, message: 'subjects (array) requis' });
        return;
      }
      if (this.entranceExamRepository.configurerMatieres) {
        const matieres = await this.entranceExamRepository.configurerMatieres(sessionId, subjects);
        res.json({ success: true, data: matieres });
      } else {
        res.status(501).json({ success: false, message: 'Non supporté' });
      }
    } catch (err) { next(err); }
  };

  // POST /api/v2/entrance-exams/:id/rooms
  creerSalle = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = String(req.params['id']);
      const { name, capacity } = req.body;
      if (!name || !capacity) {
        res.status(400).json({ success: false, message: 'name et capacity requis' });
        return;
      }
      if (this.entranceExamRepository.creerSalle) {
        const salle = await this.entranceExamRepository.creerSalle(sessionId, name, Number(capacity));
        res.status(201).json({ success: true, data: salle });
      } else {
        res.status(501).json({ success: false, message: 'Non supporté' });
      }
    } catch (err) { next(err); }
  };

  // POST /api/v2/entrance-exams/:id/rooms/assign
  repartirSalles = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const sessionId = String(req.params['id']);
      const { mode } = req.body;
      const resultat = await this._repartirSalles.execute({ schoolId, sessionId, mode });
      res.json({ success: true, data: resultat });
    } catch (err) { next(err); }
  };

  // POST /api/v2/entrance-exams/:id/candidates/register (Guichet)
  inscrireCandidatGuichet = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    inscrireCandidatGuichetAction(this.candidateDeps, req, res, next);

  // GET /api/v2/entrance-exams/candidates/:id/convocation-pdf
  genererConvocationPdf = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    genererConvocationPdfAction(this.candidateDeps, req, res, next);

  // GET /api/v2/entrance-exams/:id/rooms/:roomId/emargement-pdf
  genererEmargementPdf = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    genererEmargementPdfAction(this.candidateDeps, req, res, next);

  // POST /api/v2/entrance-exams/:id/emargement (Émargement jour J — support Idempotency-Key)
  enregistrerPresence = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    enregistrerPresenceAction(this.candidateDeps, req, res, next);

  // POST /api/v2/entrance-exams/candidates/:id/grades (Saisie des notes)
  saisirNotes = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    saisirNotesAction(this.deliberationDeps, req, res, next);

  // POST /api/v2/entrance-exams/:id/deliberation/simulate
  simulerDeliberation = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    simulerDeliberationAction(this.deliberationDeps, req, res, next);

  // GET /api/v2/entrance-exams/:id/publish/estimate-sms
  estimerCampagneSms = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    estimerCampagneSmsAction(this.deliberationDeps, req, res, next);

  // POST /api/v2/entrance-exams/:id/publish
  publierResultats = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    publierResultatsAction(this.deliberationDeps, req, res, next);

  // POST /api/v2/entrance-exams/:id/cep-batch/propose
  proposerLotCep = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    proposerLotCepAction(this.deliberationDeps, req, res, next);

  // POST /api/v2/entrance-exams/:id/cep-batch/apply
  appliquerLotCep = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    appliquerLotCepAction(this.deliberationDeps, req, res, next);

  // POST /api/v2/entrance-exams/:id/finalize-admissions
  finaliserAdmissions = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    finaliserAdmissionsAction(this.deliberationDeps, req, res, next);

  // POST /api/v2/entrance-exams/:id/candidates
  ajouterCandidats = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    ajouterCandidatsAction(this.candidateDeps, req, res, next);

  // POST /api/v2/entrance-exams/:id/candidates/import
  importCandidats = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    importCandidatsAction(this.candidateDeps, req, res, next);

  // POST /api/v2/entrance-exams/:id/compute-admission
  calculer = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    calculerAdmissionAction(this.deliberationDeps, req, res, next);

  // POST /api/v2/entrance-exams/:id/candidates/scan
  scanner = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    scannerAction(this.candidateDeps, req, res, next);

  // POST /api/v2/entrance-exams/:id/detect-anomalies
  detecterAnomalies = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    detecterAnomaliesAction(this.candidateDeps, req, res, next);

  // PATCH /api/v2/entrance-exams/candidates/:id/cep-result
  enregistrerCep = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    enregistrerCepAction(this.deliberationDeps, req, res, next);

  // GET /api/v2/entrance-exams/:id/summary
  resume = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const sessionId = String(req.params['id']);
      const result = await this._resumeSession.execute(schoolId, sessionId);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };
}
