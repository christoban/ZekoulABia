import type { Request, Response, NextFunction } from 'express';
import type { EntranceExamRepository } from '@domain/ports/repositories/EntranceExamRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import type { EntranceExamPdfPort } from '@domain/ports/services/EntranceExamPdfPort';
import { CreerSessionConcoursUseCase } from '@application/entranceExam/CreerSessionConcoursUseCase';
import { AjouterCandidatsConcoursUseCase } from '@application/entranceExam/AjouterCandidatsConcoursUseCase';
import { CalculerAdmissionConcoursUseCase } from '@application/entranceExam/CalculerAdmissionConcoursUseCase';
import { EnregistrerResultatCepUseCase } from '@application/entranceExam/EnregistrerResultatCepUseCase';
import { ResumeSessionConcoursUseCase } from '@application/entranceExam/ResumeSessionConcoursUseCase';
import { ScannerListeCandidatsUseCase } from '@application/entranceExam/ScannerListeCandidatsUseCase';
import { DetecterAnomaliesConcoursUseCase } from '@application/entranceExam/DetecterAnomaliesConcoursUseCase';
import { InscrireCandidatConcoursUseCase } from '@application/entranceExam/InscrireCandidatConcoursUseCase';
import { RepartirCandidatsSallesUseCase } from '@application/entranceExam/RepartirCandidatsSallesUseCase';
import { SaisirNotesConcoursUseCase } from '@application/entranceExam/SaisirNotesConcoursUseCase';
import { SimulerDeliberationConcoursUseCase } from '@application/entranceExam/SimulerDeliberationConcoursUseCase';
import { PublierResultatsConcoursUseCase } from '@application/entranceExam/PublierResultatsConcoursUseCase';
import { FinaliserAdmissionsConcoursUseCase } from '@application/entranceExam/FinaliserAdmissionsConcoursUseCase';
import { EnregistrerPresenceCandidatUseCase } from '@application/entranceExam/EnregistrerPresenceCandidatUseCase';
import { notifyAdmissionProvisoireSms, notifyCepResultSms } from '@infrastructure/services/sms/SmsNotificationService';
import { notifierOnboardingLienCreeAvecEcole } from '@infrastructure/services/notification/OnboardingNotificationService';
import { parseDateFR } from '../../../shared/date/parseDateFR';
import XLSX from 'xlsx';

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
  ) {}

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
      const { name, examDate, academicYearId, admissionThreshold, availableSeats, registrationDeadline, requireCepForAdmission, seatReservationDays } = req.body;
      if (!name || !examDate || !academicYearId) {
        res.status(400).json({ success: false, message: 'name, examDate, academicYearId requis' });
        return;
      }
      const session = await this.entranceExamRepository.creerSession({
        schoolId, name, examDate: new Date(examDate), academicYearId,
        admissionThreshold: admissionThreshold ?? null,
        availableSeats: availableSeats ?? null,
        registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
        requireCepForAdmission: Boolean(requireCepForAdmission),
        seatReservationDays: seatReservationDays ? Number(seatReservationDays) : 14,
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
  inscrireCandidatGuichet = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const sessionId = String(req.params['id']);
      const { firstName, lastName, dateOfBirth, originSchool, parentPhone } = req.body;

      if (!firstName || !lastName) {
        res.status(400).json({ success: false, message: 'Nom et prénom requis' });
        return;
      }

      const school = await this.schoolRepository.findById(schoolId);
      const resultat = await this._inscrireCandidat.execute({
        schoolId,
        sessionId,
        firstName,
        lastName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        originSchool,
        parentPhone,
        schoolCodeOrName: school?.subdomain || school?.name,
      });

      res.status(201).json({ success: true, data: resultat });
    } catch (err: unknown) {
      res.status(400).json({ success: false, message: err instanceof Error ? err.message : 'Erreur d\'inscription' });
    }
  };

  // GET /api/v2/entrance-exams/candidates/:id/convocation-pdf
  genererConvocationPdf = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const candidateId = String(req.params['id']);
      const cand = await this.entranceExamRepository.trouverCandidatAvecSession(candidateId);
      if (!cand || cand.session?.schoolId !== req.user!.schoolId) {
        res.status(404).json({ success: false, message: 'Candidat introuvable' });
        return;
      }

      const school = await this.schoolRepository.findById(req.user!.schoolId);
      const subjects = cand.session?.subjects || [];

      const pdf = await this.entranceExamPdfPort.genererConvocationPdf({
        schoolName: school?.name || 'Établissement Scolaire',
        sessionName: cand.session?.name || 'Concours d\'entrée',
        examDate: cand.session?.examDate || new Date(),
        candidateNumber: cand.candidateNumber || cand.id.slice(0, 8),
        candidateFullName: `${cand.firstName} ${cand.lastName}`,
        dateOfBirth: cand.dateOfBirth,
        originSchool: cand.originSchool,
        roomName: cand.room?.name,
        deskNumber: cand.deskNumber,
        subjects: subjects.map(s => ({ name: s.name, coefficient: s.coefficient, maxScore: s.maxScore })),
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="convocation_${cand.candidateNumber || cand.id}.pdf"`);
      res.send(pdf);
    } catch (err) { next(err); }
  };

  // GET /api/v2/entrance-exams/:id/rooms/:roomId/emargement-pdf
  genererEmargementPdf = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = String(req.params['id']);
      const roomId = String(req.params['roomId']);
      const session = await this.entranceExamRepository.trouverSession(sessionId);
      if (!session || session.schoolId !== req.user!.schoolId) {
        res.status(404).json({ success: false, message: 'Session introuvable' });
        return;
      }

      const candidats = await this.entranceExamRepository.listerCandidats(sessionId, { roomId, orderBy: 'nom' });
      const school = await this.schoolRepository.findById(req.user!.schoolId);
      const salle = candidats[0]?.room?.name || 'Salle d\'examen';

      const pdf = await this.entranceExamPdfPort.genererListeEmargementPdf({
        schoolName: school?.name || 'Établissement Scolaire',
        sessionName: session.name,
        examDate: session.examDate,
        roomName: salle,
        candidates: candidats.map(c => ({
          candidateNumber: c.candidateNumber || c.id.slice(0, 6),
          fullName: `${c.firstName} ${c.lastName}`,
          deskNumber: c.deskNumber,
          dateOfBirth: c.dateOfBirth,
          originSchool: c.originSchool,
        })),
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="emargement_${sessionId}_${roomId}.pdf"`);
      res.send(pdf);
    } catch (err) { next(err); }
  };

  // POST /api/v2/entrance-exams/:id/emargement (Émargement jour J — support Idempotency-Key)
  enregistrerPresence = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const sessionId = String(req.params['id']);
      const { candidateId, presenceStatus } = req.body as {
        candidateId: string;
        presenceStatus: 'PRESENT' | 'ABSENT' | 'ABANDON';
      };

      if (!candidateId || !presenceStatus) {
        res.status(400).json({ success: false, message: 'candidateId et presenceStatus requis' });
        return;
      }

      const useCase = this._enregistrerPresence ?? new EnregistrerPresenceCandidatUseCase(this.entranceExamRepository);
      const data = await useCase.execute({
        schoolId,
        sessionId,
        candidateId,
        presenceStatus,
      });

      res.json({ success: true, data });
    } catch (err) { next(err); }
  };

  // POST /api/v2/entrance-exams/candidates/:id/grades (Saisie des notes)
  saisirNotes = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const candidateId = String(req.params['id']);
      const { sessionId, notes } = req.body;
      if (!sessionId || !Array.isArray(notes)) {
        res.status(400).json({ success: false, message: 'sessionId et notes (array) requis' });
        return;
      }

      const resultat = await this._saisirNotes.execute({ schoolId, sessionId, candidateId, notes });
      res.json({ success: true, data: resultat });
    } catch (err) { next(err); }
  };

  // POST /api/v2/entrance-exams/:id/deliberation/simulate
  simulerDeliberation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const sessionId = String(req.params['id']);
      const { admissionThreshold, availableSeats, waitingListSeats, appliquer } = req.body;

      const resultat = await this._simulerDeliberation.execute({
        schoolId, sessionId,
        admissionThreshold: admissionThreshold !== undefined ? Number(admissionThreshold) : undefined,
        availableSeats: availableSeats !== undefined ? Number(availableSeats) : undefined,
        waitingListSeats: waitingListSeats !== undefined ? Number(waitingListSeats) : undefined,
        appliquer: Boolean(appliquer),
      });

      res.json({ success: true, data: resultat });
    } catch (err) { next(err); }
  };

  // POST /api/v2/entrance-exams/:id/publish
  publierResultats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const sessionId = String(req.params['id']);
      const resultat = await this._publierResultats.execute({ schoolId, sessionId });
      res.json({ success: true, data: resultat });
    } catch (err) { next(err); }
  };

  // POST /api/v2/entrance-exams/:id/finalize-admissions
  finaliserAdmissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const sessionId = String(req.params['id']);
      const { traiterForfaitsEtRepechage } = req.body;

      const resultat = await this._finaliserAdmissions.execute({
        schoolId,
        sessionId,
        executantId: req.user!.userId,
        traiterForfaitsEtRepechage: Boolean(traiterForfaitsEtRepechage),
      });

      res.json({ success: true, data: resultat });
    } catch (err) { next(err); }
  };

  // POST /api/v2/entrance-exams/:id/candidates
  ajouterCandidats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const sessionId = String(req.params['id']);
      const { candidats } = req.body as { candidats: any[] };
      if (!candidats || !Array.isArray(candidats)) {
        res.status(400).json({ success: false, message: 'candidats (array) requis' });
        return;
      }
      const result = await this._ajouterCandidats.execute({ schoolId, sessionId, candidats });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  // POST /api/v2/entrance-exams/:id/candidates/import
  importCandidats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const sessionId = String(req.params['id']);
      const file = req.file as Express.Multer.File;
      if (!file) {
        res.status(400).json({ success: false, message: 'Fichier requis' });
        return;
      }

      const wb = XLSX.read(file.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });

      const candidats = rows.map(r => ({
        firstName: String(r.prenom || r.firstName || '').trim(),
        lastName: String(r.nom || r.lastName || '').trim(),
        dateOfBirth: parseDateFR(String(r.dateNaissance || r.dateOfBirth || '')) ?? undefined,
        originSchool: String(r.ecoleOrigine || r.originSchool || '').trim() || undefined,
        examScore: r.note || r.examScore ? Number(String(r.note || r.examScore).replace(',', '.')) : undefined,
        parentPhone: String(r.telephoneParent || r.parentPhone || '').trim() || undefined,
      })).filter(c => c.firstName && c.lastName);

      const result = await this._ajouterCandidats.execute({ schoolId, sessionId, candidats });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  // POST /api/v2/entrance-exams/:id/compute-admission
  calculer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const sessionId = String(req.params['id']);
      const result = await this._calculerAdmission.execute({ schoolId, sessionId });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  // POST /api/v2/entrance-exams/:id/candidates/scan
  scanner = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const sessionId = String(req.params['id']);
      const { imageBase64, mimeType } = req.body as { imageBase64: string; mimeType?: string };
      if (!imageBase64) {
        res.status(400).json({ success: false, message: 'imageBase64 requis' });
        return;
      }
      const result = await this._scannerListe.execute(schoolId, sessionId, imageBase64, mimeType);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  // POST /api/v2/entrance-exams/:id/detect-anomalies
  detecterAnomalies = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const sessionId = String(req.params['id']);
      const result = await this._detecterAnomalies.execute(schoolId, sessionId);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  // PATCH /api/v2/entrance-exams/candidates/:id/cep-result
  enregistrerCep = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const candidateId = String(req.params['id']);
      const { cepResult } = req.body as { cepResult: 'REUSSI' | 'ECHOUE' };
      if (!cepResult || !['REUSSI', 'ECHOUE'].includes(cepResult)) {
        res.status(400).json({ success: false, message: 'cepResult requis (REUSSI ou ECHOUE)' });
        return;
      }
      const enregistreParId = req.user!.userId;
      const result = await this._enregistrerCep.execute({ schoolId, candidateId, cepResult, enregistreParId });
      res.json({ success: true, data: result });
      void notifyCepResultSms({
        schoolId, candidateName: result.candidateName, parentPhone: result.parentPhone, result: cepResult,
      });
      if (result.onboarding) {
        const school = await this.schoolRepository.findById(schoolId);
        void notifierOnboardingLienCreeAvecEcole(schoolId, school?.name ?? null, result.candidateName, result.onboarding);
      }
    } catch (err) { next(err); }
  };

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
