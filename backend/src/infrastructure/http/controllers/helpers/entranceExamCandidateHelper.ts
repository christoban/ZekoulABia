import type { Request, Response, NextFunction } from 'express';
import XLSX from 'xlsx';
import type { EntranceExamRepository } from '@domain/ports/repositories/EntranceExamRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { EntranceExamPdfPort } from '@domain/ports/services/EntranceExamPdfPort';
import type { AjouterCandidatsConcoursUseCase } from '@application/entranceExam/AjouterCandidatsConcoursUseCase';
import type { ScannerListeCandidatsUseCase } from '@application/entranceExam/ScannerListeCandidatsUseCase';
import type { DetecterAnomaliesConcoursUseCase } from '@application/entranceExam/DetecterAnomaliesConcoursUseCase';
import type { InscrireCandidatConcoursUseCase } from '@application/entranceExam/InscrireCandidatConcoursUseCase';
import { EnregistrerPresenceCandidatUseCase } from '@application/entranceExam/EnregistrerPresenceCandidatUseCase';
import { parseDateFR } from '../../../../shared/date/parseDateFR';

export interface EntranceExamCandidateDeps {
  ajouterCandidats: AjouterCandidatsConcoursUseCase;
  scannerListe: ScannerListeCandidatsUseCase;
  detecterAnomalies: DetecterAnomaliesConcoursUseCase;
  inscrireCandidat: InscrireCandidatConcoursUseCase;
  entranceExamRepository: EntranceExamRepository;
  schoolRepository: SchoolRepository;
  entranceExamPdfPort: EntranceExamPdfPort;
  enregistrerPresence?: EnregistrerPresenceCandidatUseCase;
}

export async function inscrireCandidatGuichetAction(
  deps: EntranceExamCandidateDeps,
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const schoolId = req.user!.schoolId;
    const sessionId = String(req.params['id']);
    const { firstName, lastName, dateOfBirth, originSchool, parentPhone } = req.body;

    if (!firstName || !lastName) {
      res.status(400).json({ success: false, message: 'Nom et prénom requis' });
      return;
    }

    const school = await deps.schoolRepository.findById(schoolId);
    const resultat = await deps.inscrireCandidat.execute({
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
    res.status(400).json({
      success: false,
      message: err instanceof Error ? err.message : 'Erreur d\'inscription',
    });
  }
}

export async function genererConvocationPdfAction(
  deps: EntranceExamCandidateDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const candidateId = String(req.params['id']);
    const cand = await deps.entranceExamRepository.trouverCandidatAvecSession(candidateId);
    if (!cand || cand.session?.schoolId !== req.user!.schoolId) {
      res.status(404).json({ success: false, message: 'Candidat introuvable' });
      return;
    }

    const school = await deps.schoolRepository.findById(req.user!.schoolId);
    const subjects = cand.session?.subjects || [];

    const pdf = await deps.entranceExamPdfPort.genererConvocationPdf({
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
  } catch (err) {
    next(err);
  }
}

export async function genererEmargementPdfAction(
  deps: EntranceExamCandidateDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sessionId = String(req.params['id']);
    const roomId = String(req.params['roomId']);
    const session = await deps.entranceExamRepository.trouverSession(sessionId);
    if (!session || session.schoolId !== req.user!.schoolId) {
      res.status(404).json({ success: false, message: 'Session introuvable' });
      return;
    }

    const candidats = await deps.entranceExamRepository.listerCandidats(sessionId, { roomId, orderBy: 'nom' });
    const school = await deps.schoolRepository.findById(req.user!.schoolId);
    const salle = candidats[0]?.room?.name || 'Salle d\'examen';

    const pdf = await deps.entranceExamPdfPort.genererListeEmargementPdf({
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
  } catch (err) {
    next(err);
  }
}

export async function enregistrerPresenceAction(
  deps: EntranceExamCandidateDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
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

    const useCase = deps.enregistrerPresence ?? new EnregistrerPresenceCandidatUseCase(deps.entranceExamRepository);
    const data = await useCase.execute({
      schoolId,
      sessionId,
      candidateId,
      presenceStatus,
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function ajouterCandidatsAction(
  deps: EntranceExamCandidateDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const schoolId = req.user!.schoolId;
    const sessionId = String(req.params['id']);
    const { candidats } = req.body as {
      candidats: Parameters<AjouterCandidatsConcoursUseCase['execute']>[0]['candidats'];
    };
    if (!candidats || !Array.isArray(candidats)) {
      res.status(400).json({ success: false, message: 'candidats (array) requis' });
      return;
    }
    const result = await deps.ajouterCandidats.execute({ schoolId, sessionId, candidats });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function importCandidatsAction(
  deps: EntranceExamCandidateDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
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

    const result = await deps.ajouterCandidats.execute({ schoolId, sessionId, candidats });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function scannerAction(
  deps: EntranceExamCandidateDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const schoolId = req.user!.schoolId;
    const sessionId = String(req.params['id']);
    const { imageBase64, mimeType } = req.body as { imageBase64: string; mimeType?: string };
    if (!imageBase64) {
      res.status(400).json({ success: false, message: 'imageBase64 requis' });
      return;
    }
    const result = await deps.scannerListe.execute(schoolId, sessionId, imageBase64, mimeType);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function detecterAnomaliesAction(
  deps: EntranceExamCandidateDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const schoolId = req.user!.schoolId;
    const sessionId = String(req.params['id']);
    const result = await deps.detecterAnomalies.execute(schoolId, sessionId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
