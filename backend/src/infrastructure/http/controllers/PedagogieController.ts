import type { Request, Response, NextFunction } from 'express';
import { extraireDocument } from '@infrastructure/services/ai/DocumentAiOrchestrator';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import type { ListerProgrammeUseCase } from '@application/pedagogie/ListerProgrammeUseCase';
import type { GererProgrammeUseCase } from '@application/pedagogie/GererProgrammeUseCase';
import type { GererChapitreUseCase } from '@application/pedagogie/GererChapitreUseCase';
import type { GererCahierDeTexteUseCase } from '@application/pedagogie/GererCahierDeTexteUseCase';
import type { CalculerProgressionProgrammeUseCase } from '@application/pedagogie/CalculerProgressionProgrammeUseCase';
import type { ObtenirSlotDuJourUseCase } from '@application/pedagogie/ObtenirSlotDuJourUseCase';
import type { GenererRapportPedagogieUseCase } from '@application/pedagogie/GenererRapportPedagogieUseCase';
import { PedagogieValidationError, PedagogieNotFoundError, PedagogieForbiddenError } from '@application/pedagogie/errors';
import { parseSinceParam } from '@infrastructure/http/helpers/deltaSyncHelper';

export class PedagogieController {
  constructor(
    private readonly listerProgramme: ListerProgrammeUseCase,
    private readonly gererProgramme: GererProgrammeUseCase,
    private readonly gererChapitre: GererChapitreUseCase,
    private readonly gererCahier: GererCahierDeTexteUseCase,
    private readonly calculerProgression: CalculerProgressionProgrammeUseCase,
    private readonly obtenirSlot: ObtenirSlotDuJourUseCase,
    private readonly genererRapport: GenererRapportPedagogieUseCase,
    private readonly audit: AIActionAuditPort,
  ) {}

  // ─── Programmes ────────────────────────────────────────────────────────────

  listProgrammes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { subjectId, classId, level, academicYearId } = req.query as Record<string, string>;
      const programmes = await this.listerProgramme.execute({ schoolId: user.schoolId, academicYearId, subjectId, classId, level });
      res.json({ success: true, data: programmes });
    } catch (e) { next(e); }
  };

  createProgramme = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { titre, subjectId, classId, level, academicYearId } = req.body as {
        titre?: string; subjectId?: string; classId?: string; level?: string; academicYearId?: string;
      };
      const programme = await this.gererProgramme.creer({ schoolId: user.schoolId, titre: titre ?? '', subjectId: subjectId ?? '', classId, level, academicYearId });
      res.status(201).json({ success: true, data: programme });
    } catch (e) { this.gererErreur(e, res, next); }
  };

  updateProgramme = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const id = String(req.params.id);
      const { titre, classId, level } = req.body as { titre?: string; classId?: string | null; level?: string | null };
      const updated = await this.gererProgramme.mettreAJour({ schoolId: user.schoolId, id, titre, classId, level });
      res.json({ success: true, data: updated });
    } catch (e) { this.gererErreur(e, res, next); }
  };

  deleteProgramme = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const id = String(req.params.id);
      await this.gererProgramme.supprimer({ schoolId: user.schoolId, id });
      res.json({ success: true, message: 'Programme supprimé' });
    } catch (e) { this.gererErreur(e, res, next); }
  };

  // ─── Chapitres ─────────────────────────────────────────────────────────────

  addChapitre = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const programmeId = String(req.params.programmeId);
      const { titre, ordre, volumeHeuresPrevu, sequenceCibleFin } = req.body as {
        titre?: string; ordre?: number; volumeHeuresPrevu?: number; sequenceCibleFin?: number;
      };
      const chapitre = await this.gererChapitre.ajouter({ schoolId: user.schoolId, programmeId, titre: titre ?? '', ordre, volumeHeuresPrevu, sequenceCibleFin });
      res.status(201).json({ success: true, data: chapitre });
    } catch (e) { this.gererErreur(e, res, next); }
  };

  updateChapitre = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const id = String(req.params.id);
      const { titre, ordre, volumeHeuresPrevu, sequenceCibleFin } = req.body as {
        titre?: string; ordre?: number; volumeHeuresPrevu?: number; sequenceCibleFin?: number | null;
      };
      const updated = await this.gererChapitre.mettreAJour({ schoolId: user.schoolId, id, titre, ordre, volumeHeuresPrevu, sequenceCibleFin });
      res.json({ success: true, data: updated });
    } catch (e) { this.gererErreur(e, res, next); }
  };

  deleteChapitre = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const id = String(req.params.id);
      await this.gererChapitre.supprimer({ schoolId: user.schoolId, id });
      res.json({ success: true, message: 'Chapitre supprimé' });
    } catch (e) { this.gererErreur(e, res, next); }
  };

  // ─── Cahier de texte ───────────────────────────────────────────────────────

  createCahierDeTexte = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { classId, subjectId, chapitreId, date, contenuRealise, contenuLibre, devoirsDonnes, academicYearId } = req.body as {
        classId?: string; subjectId?: string; chapitreId?: string; date?: string;
        contenuRealise?: string; contenuLibre?: string; devoirsDonnes?: string; academicYearId?: string;
      };
      const entry = await this.gererCahier.creer({ schoolId: user.schoolId, teacherId: user.userId, role: user.role, classId: classId ?? '', subjectId: subjectId ?? '', chapitreId, date, contenuRealise, contenuLibre, devoirsDonnes, academicYearId });
      this.audit.journaliser({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'ajouter_cahier_texte', targetType: 'Class', targetId: classId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: req.body,
      });
      res.status(201).json({ success: true, data: entry });
    } catch (e) {
      const user = req.user;
      this.audit.journaliser({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'ajouter_cahier_texte', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: e instanceof Error ? e.message : undefined, parametersSummary: req.body,
      });
      this.gererErreur(e, res, next);
    }
  };

  listCahierDeTexte = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { classId, subjectId, teacherId, academicYearId, since, limit } = req.query as Record<string, string>;
      const sinceDate = parseSinceParam(since);
      const entries = await this.gererCahier.lister({
        schoolId: user.schoolId,
        userId: user.userId,
        role: user.role,
        classId,
        subjectId,
        teacherId,
        academicYearId,
        since: sinceDate,
        limit,
      });
      res.json({
        success: true,
        serverTime: new Date().toISOString(),
        isDelta: Boolean(sinceDate),
        data: entries,
      });
    } catch (e) { this.gererErreur(e, res, next); }
  };

  // ─── Progression ───────────────────────────────────────────────────────────

  getProgression = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { classId, subjectId, academicYearId } = req.query as Record<string, string>;
      if (!classId || !subjectId) {
        res.status(400).json({ success: false, message: 'classId et subjectId sont requis' });
        return;
      }
      const resultat = await this.calculerProgression.calculerProgression({ schoolId: user.schoolId, classId, subjectId, academicYearId });
      res.json({ success: true, data: resultat });
    } catch (e) { this.gererErreur(e, res, next); }
  };

  getAlertesRetard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { academicYearId, seuilPct } = req.query as Record<string, string>;
      const seuil = seuilPct ? parseInt(seuilPct, 10) : 15;
      const alertes = await this.calculerProgression.calculerAlertesRetardProgramme(user.schoolId, academicYearId, seuil);
      this.audit.journaliser({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'alertes_retard_programme', origin: 'UI_DIRECT', outcome: 'SUCCES',
        parametersSummary: { academicYearId, seuilPct: seuil },
      });
      res.json({ success: true, data: alertes });
    } catch (e) {
      const user = req.user;
      this.audit.journaliser({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'alertes_retard_programme', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: e instanceof Error ? e.message : undefined, parametersSummary: req.query,
      });
      next(e);
    }
  };

  // ─── Vérification programme par matière ────────────────────────────────────

  getSubjectHasProgramme = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const subjectId = String(req.params.subjectId);
      const { classId } = req.query as { classId?: string };
      const data = await this.calculerProgression.verifierProgrammeMatiere(user.schoolId, subjectId, classId);
      res.json({ success: true, data });
    } catch (e) { this.gererErreur(e, res, next); }
  };

  // ─── Slot du jour (pré-remplissage formulaire enseignant) ─────────────────

  getTodaySlot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { academicYearId } = req.query as Record<string, string>;
      const data = await this.obtenirSlot.execute({ teacherId: user.userId, schoolId: user.schoolId, academicYearId });
      res.json({ success: true, data });
    } catch (e) { this.gererErreur(e, res, next); }
  };

  // ─── Scan photo du cahier — orchestrateur OCR-d'abord (DocumentAiOrchestrator) ─────────────
  // Un cahier de textes est un document texte : PaddleOCR suffit dans la grande majorité des cas ;
  // le modèle vision Groq ne sert que si l'OCR échoue à lire correctement (écriture manuscrite
  // peu lisible, photo floue).

  scanCahier = async (req: Request, res: Response): Promise<void> => {
    const FALLBACK = {
      chapitreDetecte: null, contenuRealise: null, devoirsDonnes: null,
      confidence: 0, error: 'Analyse impossible, veuillez saisir manuellement',
    };
    try {
      const file = req.file as (Express.Multer.File | undefined);
      if (!file) { res.status(400).json({ success: false, message: 'Image manquante' }); return; }

      const base64 = file.buffer.toString('base64');
      const mimeType = file.mimetype || 'image/jpeg';
      const consignes = `Retourne UNIQUEMENT un JSON valide sans markdown avec ces champs :
{"chapitreDetecte":"titre du chapitre ou leçon visible, null si non détecté","contenuRealise":"résumé court de ce qui a été fait, null si non détecté","devoirsDonnes":"devoirs mentionnés, null si aucun","confidence":0.8}
Si le document n'est manifestement pas un cahier de textes scolaire, retourne confidence: 0 et null pour tous les autres champs.`;

      const resultat = await extraireDocument({
        imageBase64: base64,
        mimeType,
        maxTokens: 512,
        promptOcrTexte: (texte) => `Tu es un assistant qui extrait des informations d'un cahier de textes scolaire. Voici le texte extrait par OCR de la photo :

"""
${texte}
"""

${consignes}`,
        promptVision: `Tu es un assistant qui extrait des informations d'une photo de cahier de textes scolaire. Analyse l'image.

${consignes}`,
      });

      if (resultat.source === 'ECHEC' || !resultat.reponseTexte) { res.json({ success: true, data: FALLBACK }); return; }

      const cleanJson = resultat.reponseTexte.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

      let parsed: any;
      try { parsed = JSON.parse(cleanJson); } catch { res.json({ success: true, data: FALLBACK }); return; }

      res.json({
        success: true,
        data: {
          chapitreDetecte: typeof parsed.chapitreDetecte === 'string' ? parsed.chapitreDetecte : null,
          contenuRealise:  typeof parsed.contenuRealise  === 'string' ? parsed.contenuRealise  : null,
          devoirsDonnes:   typeof parsed.devoirsDonnes   === 'string' ? parsed.devoirsDonnes   : null,
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
        },
      });
    } catch {
      res.json({ success: true, data: FALLBACK });
    }
  };

  getRapport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { teacherId, departmentId, classId, academicYearId } = req.query as Record<string, string>;
      const resultat = await this.genererRapport.execute({ schoolId: user.schoolId, userId: user.userId, role: user.role, teacherId, departmentId, classId, academicYearId });
      res.json({ success: true, data: resultat.rapport, total: resultat.total });
    } catch (e) { this.gererErreur(e, res, next); }
  };

  private gererErreur(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof PedagogieValidationError) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    if (error instanceof PedagogieNotFoundError) {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    if (error instanceof PedagogieForbiddenError) {
      res.status(403).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
}
