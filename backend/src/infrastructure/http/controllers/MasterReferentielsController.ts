import type { Request, Response, NextFunction } from 'express';
import type { MasterReferentielsRepository } from '@domain/ports/repositories/MasterReferentielsRepository';
import type { TypeFraisMinesec } from '@domain/types/enums';
import { logMasterAction } from '../../services/audit/MasterAuthAuditService.ts';

export class MasterReferentielsController {
  constructor(private readonly repo: MasterReferentielsRepository) {}

  // ─── 1. Synthèse globale & Alerte Proactive ─────────────────────────────
  getSummary = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const now = new Date();
      const currentYearNum = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      const currentAcademicYear = currentMonth >= 8
        ? `${currentYearNum}-${currentYearNum + 1}`
        : `${currentYearNum - 1}-${currentYearNum}`;
      const nextAcademicYear = currentMonth >= 7
        ? `${currentYearNum + 1}-${currentYearNum + 2}`
        : `${currentYearNum}-${currentYearNum + 1}`;

      const counts = await this.repo.getSummaryCounts();
      const hasNextYearCalendar = counts.calendars.some(c => c.academicYear === nextAcademicYear);
      const isApproachingBackToSchool = currentMonth >= 7 && currentMonth <= 9;
      const upcomingYearAlert = isApproachingBackToSchool && !hasNextYearCalendar;

      res.json({
        success: true,
        data: {
          currentAcademicYear,
          nextAcademicYear,
          upcomingYearAlert,
          alertMessage: upcomingYearAlert
            ? `Arrêté conjoint attendu : Aucune date officielle n'a été saisie pour l'année scolaire ${nextAcademicYear}. Pensez à enregistrer le calendrier officiel dès publication de l'arrêté.`
            : null,
          counts: {
            calendars: counts.calendarCount,
            bacCoefficients: counts.bacCoefficientsCount,
            cycleSubjects: counts.cycleCoefficientsCount + counts.anglophoneLoadsCount,
            progressions: counts.progressionsCount,
            tarifs: counts.tarifsCount,
            templates: counts.templatesCount,
          },
        },
      });
    } catch (error) { next(error); }
  };

  // ─── 2. Calendrier Scolaire Officiel ────────────────────────────────────
  getCalendars = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const calendars = await this.repo.listCalendars();
      res.json({ success: true, data: calendars });
    } catch (error) { next(error); }
  };

  saveCalendar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const master = req.masterUser;
      const {
        id,
        academicYear,
        establishmentType = 'MINESEC',
        arreteReference,
        dateRentreeOfficielle,
        dateClotureOfficielle,
        trimestres = [],
        periodesVacances = [],
        active = true,
      } = req.body;

      if (!academicYear || !dateRentreeOfficielle || !dateClotureOfficielle) {
        res.status(400).json({ success: false, message: 'academicYear, dateRentreeOfficielle et dateClotureOfficielle sont requis.' });
        return;
      }

      const result = await this.repo.saveCalendar({
        id,
        academicYear,
        establishmentType,
        arreteReference,
        dateRentreeOfficielle: new Date(dateRentreeOfficielle),
        dateClotureOfficielle: new Date(dateClotureOfficielle),
        trimestres,
        periodesVacances,
        active,
      });

      void logMasterAction({
        req,
        masterUserId: master.id,
        action: 'referentiel_calendar_save',
        targetId: result.id,
        description: `Calendrier ${result.academicYear} (${result.establishmentType}) mis à jour`,
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) { next(error); }
  };

  toggleCalendarActive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const master = req.masterUser;
      const id = String(req.params.id);
      const existing = await this.repo.findCalendarById(id);
      if (!existing) {
        res.status(404).json({ success: false, message: 'Calendrier introuvable.' });
        return;
      }
      const updated = await this.repo.updateCalendarActive(id, !existing.active);
      void logMasterAction({
        req,
        masterUserId: master.id,
        action: 'referentiel_calendar_toggle',
        targetId: id,
        description: `Calendrier ${existing.academicYear} ${updated.active ? 'activé' : 'désactivé'}`,
      });
      res.json({ success: true, data: updated });
    } catch (error) { next(error); }
  };

  // ─── 3. Coefficients Bac (Arrêté N°92/22) ───────────────────────────────
  getBacCoefficients = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { serie, niveau, templateCode, search } = req.query;
      const coeffs = await this.repo.listBacCoefficients({
        serie: typeof serie === 'string' ? serie : undefined,
        niveau: typeof niveau === 'string' ? niveau : undefined,
        templateCode: typeof templateCode === 'string' ? templateCode : undefined,
        search: typeof search === 'string' ? search : undefined,
      });
      res.json({ success: true, data: coeffs });
    } catch (error) { next(error); }
  };

  saveBacCoefficient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const master = req.masterUser;
      const {
        id,
        subjectName,
        serie,
        niveau = 'TERMINALE',
        coefficient,
        groupe = 1,
        templateCode = '__ALL__',
        source = 'Arrêté N° 92/22 MINESEC du 17 Mars 2022',
        isOfficialMinesec = true,
      } = req.body;

      if (!subjectName || !serie || coefficient === undefined) {
        res.status(400).json({ success: false, message: 'subjectName, serie et coefficient sont requis.' });
        return;
      }

      const result = await this.repo.saveBacCoefficient({
        id,
        subjectName: String(subjectName).trim(),
        serie: String(serie).trim(),
        niveau,
        coefficient: Number(coefficient),
        groupe: Number(groupe),
        templateCode,
        source,
        isOfficialMinesec,
      });

      void logMasterAction({
        req,
        masterUserId: master.id,
        action: 'referentiel_bac_coeff_save',
        targetId: result.id,
        description: `Coefficient Bac ${result.subjectName} (${result.serie} - ${result.niveau}) fixé à ${result.coefficient}`,
      });
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  };

  deleteBacCoefficient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const master = req.masterUser;
      const id = String(req.params.id);
      const existing = await this.repo.findBacCoefficientById(id);
      if (!existing) {
        res.status(404).json({ success: false, message: 'Coefficient introuvable.' });
        return;
      }
      await this.repo.deleteBacCoefficient(id);
      void logMasterAction({
        req,
        masterUserId: master.id,
        action: 'referentiel_bac_coeff_delete',
        targetId: id,
        description: `Suppression coefficient Bac ${existing.subjectName} (${existing.serie})`,
      });
      res.json({ success: true, message: 'Entrée supprimée.' });
    } catch (error) { next(error); }
  };

  // ─── 4. Matières & Volumes Horaires par Template ────────────────────────
  getTemplateSubjects = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { templateCode, classLevel, filiere, search, subsystem } = req.query;
      const filter = {
        templateCode: typeof templateCode === 'string' ? templateCode : undefined,
        classLevel: typeof classLevel === 'string' ? classLevel : undefined,
        filiere: typeof filiere === 'string' ? filiere : undefined,
        search: typeof search === 'string' ? search : undefined,
      };

      if (subsystem === 'ANGLOPHONE') {
        const entries = await this.repo.listAnglophoneSubjectLoads(filter);
        res.json({ success: true, data: entries, subsystem: 'ANGLOPHONE' });
        return;
      }

      const entries = await this.repo.listCycleCoefficients(filter);
      res.json({ success: true, data: entries, subsystem: 'FRANCOPHONE' });
    } catch (error) { next(error); }
  };

  saveTemplateSubject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const master = req.masterUser;
      const {
        id,
        subsystem = 'FRANCOPHONE',
        templateCode,
        classLevel,
        subjectName,
        coefficient,
        weeklyPeriods,
        filiere = subsystem === 'ANGLOPHONE' ? 'EN_GENERAL' : 'FR_GENERAL',
      } = req.body;

      if (!templateCode || !classLevel || !subjectName || coefficient === undefined) {
        res.status(400).json({ success: false, message: 'templateCode, classLevel, subjectName et coefficient sont requis.' });
        return;
      }

      const input = {
        id,
        templateCode,
        classLevel,
        subjectName: String(subjectName).trim(),
        coefficient: Number(coefficient),
        weeklyPeriods: weeklyPeriods ? Number(weeklyPeriods) : null,
        filiere,
      };
      const result = subsystem === 'ANGLOPHONE'
        ? await this.repo.saveAnglophoneSubjectLoad(input)
        : await this.repo.saveCycleCoefficient(input);

      void logMasterAction({
        req,
        masterUserId: master.id,
        action: 'referentiel_template_subject_save',
        targetId: result.id,
        description: `Matière ${result.subjectName} (${result.templateCode} - ${result.classLevel}) enregistrée`,
      });
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  };

  deleteTemplateSubject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const master = req.masterUser;
      const id = String(req.params.id);
      const { subsystem = 'FRANCOPHONE' } = req.query;

      if (subsystem === 'ANGLOPHONE') {
        const existing = await this.repo.findAnglophoneSubjectLoadById(id);
        if (!existing) {
          res.status(404).json({ success: false, message: 'Entrée introuvable.' });
          return;
        }
        await this.repo.deleteAnglophoneSubjectLoad(id);
        void logMasterAction({
          req,
          masterUserId: master.id,
          action: 'referentiel_template_subject_delete',
          targetId: id,
          description: `Suppression matière anglophone ${existing.subjectName} (${existing.templateCode})`,
        });
      } else {
        const existing = await this.repo.findCycleCoefficientById(id);
        if (!existing) {
          res.status(404).json({ success: false, message: 'Entrée introuvable.' });
          return;
        }
        await this.repo.deleteCycleCoefficient(id);
        void logMasterAction({
          req,
          masterUserId: master.id,
          action: 'referentiel_template_subject_delete',
          targetId: id,
          description: `Suppression matière cycle ${existing.subjectName} (${existing.templateCode})`,
        });
      }
      res.json({ success: true, message: 'Entrée supprimée.' });
    } catch (error) { next(error); }
  };

  // ─── 5. Programmes Officiels & Progressions Types ───────────────────────
  getProgressions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { templateCode, level, search } = req.query;
      const progressions = await this.repo.listProgressions({
        templateCode: typeof templateCode === 'string' ? templateCode : undefined,
        level: typeof level === 'string' ? level : undefined,
        search: typeof search === 'string' ? search : undefined,
      });
      res.json({ success: true, data: progressions });
    } catch (error) { next(error); }
  };

  saveProgression = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const master = req.masterUser;
      const { id, templateCode, level, filiere, subjectName, titre, chapitres = [], active = true } = req.body;

      if (!templateCode || !level || !subjectName || !titre) {
        res.status(400).json({ success: false, message: 'templateCode, level, subjectName et titre sont requis.' });
        return;
      }

      const result = await this.repo.saveProgression({
        id,
        templateCode,
        level,
        filiere: filiere ?? null,
        subjectName: String(subjectName).trim(),
        titre: String(titre).trim(),
        chapitres,
        active,
      });

      void logMasterAction({
        req,
        masterUserId: master.id,
        action: 'referentiel_progression_save',
        targetId: result.id,
        description: `Progression officielle «${result.titre}» (${result.templateCode} - ${result.level}) enregistrée`,
      });
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  };

  deleteProgression = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const master = req.masterUser;
      const id = String(req.params.id);
      const existing = await this.repo.findProgressionById(id);
      if (!existing) {
        res.status(404).json({ success: false, message: 'Progression introuvable.' });
        return;
      }
      await this.repo.deleteProgression(id);
      void logMasterAction({
        req,
        masterUserId: master.id,
        action: 'referentiel_progression_delete',
        targetId: id,
        description: `Suppression progression ${existing.titre}`,
      });
      res.json({ success: true, message: 'Progression supprimée.' });
    } catch (error) { next(error); }
  };

  // ─── 6. Tarifs MINESEC Réglementaires ────────────────────────────────────
  getTarifsMinesec = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { anneeScolaire, typeFrais } = req.query;
      const tarifs = await this.repo.listTarifsMinesec({
        anneeScolaire: typeof anneeScolaire === 'string' ? anneeScolaire : undefined,
        typeFrais: typeof typeFrais === 'string' ? (typeFrais as TypeFraisMinesec) : undefined,
      });
      res.json({ success: true, data: tarifs });
    } catch (error) { next(error); }
  };

  saveTarifMinesec = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const master = req.masterUser;
      const { id, typeFrais, anneeScolaire, niveau, montantFCFA, description, actif = true } = req.body;

      if (!typeFrais || !anneeScolaire || montantFCFA === undefined) {
        res.status(400).json({ success: false, message: 'typeFrais, anneeScolaire et montantFCFA sont requis.' });
        return;
      }

      const result = await this.repo.saveTarifMinesec({
        id,
        typeFrais,
        anneeScolaire,
        niveau: niveau ?? null,
        montantFCFA: Number(montantFCFA),
        description: description ?? null,
        actif,
      });

      void logMasterAction({
        req,
        masterUserId: master.id,
        action: 'referentiel_tarif_minesec_save',
        targetId: result.id,
        description: `Tarif MINESEC ${result.typeFrais} (${result.anneeScolaire}) fixé à ${result.montantFCFA} FCFA`,
      });
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  };

  toggleTarifActive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const master = req.masterUser;
      const id = String(req.params.id);
      const existing = await this.repo.findTarifMinesecById(id);
      if (!existing) {
        res.status(404).json({ success: false, message: 'Tarif introuvable.' });
        return;
      }
      const updated = await this.repo.updateTarifActive(id, !existing.actif);
      void logMasterAction({
        req,
        masterUserId: master.id,
        action: 'referentiel_tarif_minesec_toggle',
        targetId: id,
        description: `Tarif ${existing.typeFrais} (${existing.anneeScolaire}) ${updated.actif ? 'activé' : 'désactivé'}`,
      });
      res.json({ success: true, data: updated });
    } catch (error) { next(error); }
  };
}
