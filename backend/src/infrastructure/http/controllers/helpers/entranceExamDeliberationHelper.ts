import type { Request, Response, NextFunction } from 'express';
import type { CalculerAdmissionConcoursUseCase } from '@application/entranceExam/CalculerAdmissionConcoursUseCase';
import type { EnregistrerResultatCepUseCase } from '@application/entranceExam/EnregistrerResultatCepUseCase';
import type { SaisirNotesConcoursUseCase } from '@application/entranceExam/SaisirNotesConcoursUseCase';
import type { SimulerDeliberationConcoursUseCase } from '@application/entranceExam/SimulerDeliberationConcoursUseCase';
import type { PublierResultatsConcoursUseCase } from '@application/entranceExam/PublierResultatsConcoursUseCase';
import type { FinaliserAdmissionsConcoursUseCase } from '@application/entranceExam/FinaliserAdmissionsConcoursUseCase';
import type { EstimerCampagneSmsPublicationUseCase } from '@application/entranceExam/EstimerCampagneSmsPublicationUseCase';
import type { ProposerSaisieLotCepUseCase, ItemSaisieLotCep } from '@application/entranceExam/ProposerSaisieLotCepUseCase';
import type { AppliquerSaisieLotCepUseCase } from '@application/entranceExam/AppliquerSaisieLotCepUseCase';

export interface EntranceExamDeliberationDeps {
  calculerAdmission: CalculerAdmissionConcoursUseCase;
  enregistrerCep: EnregistrerResultatCepUseCase;
  saisirNotes: SaisirNotesConcoursUseCase;
  simulerDeliberation: SimulerDeliberationConcoursUseCase;
  publierResultats: PublierResultatsConcoursUseCase;
  finaliserAdmissions: FinaliserAdmissionsConcoursUseCase;
  estimerCampagneSms?: EstimerCampagneSmsPublicationUseCase;
  proposerSaisieLotCep?: ProposerSaisieLotCepUseCase;
  appliquerSaisieLotCep?: AppliquerSaisieLotCepUseCase;
}

export async function saisirNotesAction(
  deps: EntranceExamDeliberationDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const schoolId = req.user!.schoolId;
    const candidateId = String(req.params['id']);
    const { sessionId, notes } = req.body;
    if (!sessionId || !Array.isArray(notes)) {
      res.status(400).json({ success: false, message: 'sessionId et notes (array) requis' });
      return;
    }

    const resultat = await deps.saisirNotes.execute({ schoolId, sessionId, candidateId, notes });
    res.json({ success: true, data: resultat });
  } catch (err) {
    next(err);
  }
}

export async function simulerDeliberationAction(
  deps: EntranceExamDeliberationDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const schoolId = req.user!.schoolId;
    const sessionId = String(req.params['id']);
    const { admissionThreshold, availableSeats, waitingListSeats, appliquer } = req.body;

    const resultat = await deps.simulerDeliberation.execute({
      schoolId,
      sessionId,
      admissionThreshold: admissionThreshold !== undefined ? Number(admissionThreshold) : undefined,
      availableSeats: availableSeats !== undefined ? Number(availableSeats) : undefined,
      waitingListSeats: waitingListSeats !== undefined ? Number(waitingListSeats) : undefined,
      appliquer: Boolean(appliquer),
    });

    res.json({ success: true, data: resultat });
  } catch (err) {
    next(err);
  }
}

export async function estimerCampagneSmsAction(
  deps: EntranceExamDeliberationDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const schoolId = req.user!.schoolId;
    const sessionId = String(req.params['id']);
    if (!deps.estimerCampagneSms) {
      res.status(501).json({ success: false, message: 'Service non disponible' });
      return;
    }
    const resultat = await deps.estimerCampagneSms.execute({ schoolId, sessionId });
    res.json({ success: true, data: resultat });
  } catch (err) {
    next(err);
  }
}

export async function publierResultatsAction(
  deps: EntranceExamDeliberationDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const schoolId = req.user!.schoolId;
    const sessionId = String(req.params['id']);
    const { confirmSmsCampaign, campaignId } = req.body || {};
    const resultat = await deps.publierResultats.execute({
      schoolId,
      sessionId,
      confirmSmsCampaign: confirmSmsCampaign !== undefined ? Boolean(confirmSmsCampaign) : true,
      campaignId: campaignId ? String(campaignId) : undefined,
    });
    res.json({ success: true, data: resultat });
  } catch (err) {
    next(err);
  }
}

export async function proposerLotCepAction(
  deps: EntranceExamDeliberationDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const schoolId = req.user!.schoolId;
    const sessionId = String(req.params['id']);
    const { items } = req.body as { items: ItemSaisieLotCep[] };
    if (!items || !Array.isArray(items)) {
      res.status(400).json({ success: false, message: 'items requis (tableau de résultats CEP)' });
      return;
    }
    if (!deps.proposerSaisieLotCep) {
      res.status(501).json({ success: false, message: 'Service non disponible' });
      return;
    }
    const resultat = await deps.proposerSaisieLotCep.execute({ schoolId, sessionId, items });
    res.json({ success: true, data: resultat });
  } catch (err) {
    next(err);
  }
}

export async function appliquerLotCepAction(
  deps: EntranceExamDeliberationDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const schoolId = req.user!.schoolId;
    const sessionId = String(req.params['id']);
    const { decisions, promotionsIds } = req.body;
    if (!decisions || !Array.isArray(decisions)) {
      res.status(400).json({ success: false, message: 'decisions requises' });
      return;
    }
    if (!deps.appliquerSaisieLotCep) {
      res.status(501).json({ success: false, message: 'Service non disponible' });
      return;
    }
    const adminUserId = req.user!.userId;
    const resultat = await deps.appliquerSaisieLotCep.execute({
      schoolId,
      sessionId,
      adminUserId,
      decisions,
      promotionsIds: Array.isArray(promotionsIds) ? promotionsIds : undefined,
    });
    res.json({ success: true, data: resultat });
  } catch (err) {
    next(err);
  }
}

export async function finaliserAdmissionsAction(
  deps: EntranceExamDeliberationDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const schoolId = req.user!.schoolId;
    const sessionId = String(req.params['id']);
    const { traiterForfaitsEtRepechage } = req.body;

    const resultat = await deps.finaliserAdmissions.execute({
      schoolId,
      sessionId,
      executantId: req.user!.userId,
      traiterForfaitsEtRepechage: Boolean(traiterForfaitsEtRepechage),
    });

    res.json({ success: true, data: resultat });
  } catch (err) {
    next(err);
  }
}

export async function calculerAdmissionAction(
  deps: EntranceExamDeliberationDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const schoolId = req.user!.schoolId;
    const sessionId = String(req.params['id']);
    const result = await deps.calculerAdmission.execute({ schoolId, sessionId });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function enregistrerCepAction(
  deps: EntranceExamDeliberationDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const schoolId = req.user!.schoolId;
    const candidateId = String(req.params['id']);
    const { cepResult } = req.body as { cepResult: 'REUSSI' | 'ECHOUE' };
    if (!cepResult || !['REUSSI', 'ECHOUE'].includes(cepResult)) {
      res.status(400).json({ success: false, message: 'cepResult requis (REUSSI ou ECHOUE)' });
      return;
    }
    const enregistreParId = req.user!.userId;
    const result = await deps.enregistrerCep.execute({ schoolId, candidateId, cepResult, enregistreParId });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
