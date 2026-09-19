import type { Request, Response, NextFunction } from 'express';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { logMasterAction } from '../../services/audit/MasterAuthAuditService.ts';
import type { TypeFraisMinesec } from '@prisma/client';

export class MasterReferentielsController {
  // ─── 1. Synthèse globale & Alerte Proactive ─────────────────────────────
  getSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const now = new Date();
      const currentYearNum = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // 1-12

      // Année scolaire courante estimée (ex: sept 2026 -> 2026-2027)
      const currentAcademicYear = currentMonth >= 8
        ? `${currentYearNum}-${currentYearNum + 1}`
        : `${currentYearNum - 1}-${currentYearNum}`;

      // Année scolaire approchante (ex: à partir de juillet 2027, on attend 2027-2028)
      const nextAcademicYear = currentMonth >= 7
        ? `${currentYearNum + 1}-${currentYearNum + 2}`
        : `${currentYearNum}-${currentYearNum + 1}`;

      const [
        calendarCount,
        calendars,
        bacCoefficientsCount,
        cycleCoefficientsCount,
        anglophoneLoadsCount,
        progressionsCount,
        tarifsCount,
        templatesCount,
      ] = await Promise.all([
        prisma.officialAcademicCalendar.count(),
        prisma.officialAcademicCalendar.findMany({ select: { academicYear: true, active: true } }),
        prisma.bacCoefficient.count(),
        prisma.cycleCoefficient.count(),
        prisma.anglophoneSubjectLoad.count(),
        prisma.officialProgrammeProgression.count(),
        prisma.tarifMinesecReference.count(),
        prisma.schoolTemplate.count(),
      ]);

      // Alerte proactive : si on est en juillet ou après, et qu'aucune ligne n'existe pour la rentrée suivante
      const hasNextYearCalendar = calendars.some(c => c.academicYear === nextAcademicYear);
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
            calendars: calendarCount,
            bacCoefficients: bacCoefficientsCount,
            cycleSubjects: cycleCoefficientsCount + anglophoneLoadsCount,
            progressions: progressionsCount,
            tarifs: tarifsCount,
            templates: templatesCount,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // ─── 2. Calendrier Scolaire Officiel ────────────────────────────────────
  getCalendars = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const calendars = await prisma.officialAcademicCalendar.findMany({
        orderBy: [{ academicYear: 'desc' }, { establishmentType: 'asc' }],
      });
      res.json({ success: true, data: calendars });
    } catch (error) {
      next(error);
    }
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

      const rentree = new Date(dateRentreeOfficielle);
      const cloture = new Date(dateClotureOfficielle);

      let result;
      if (id) {
        result = await prisma.officialAcademicCalendar.update({
          where: { id },
          data: {
            academicYear,
            establishmentType,
            arreteReference,
            dateRentreeOfficielle: rentree,
            dateClotureOfficielle: cloture,
            trimestres,
            periodesVacances,
            active,
          },
        });
      } else {
        result = await prisma.officialAcademicCalendar.upsert({
          where: {
            academicYear_establishmentType: { academicYear, establishmentType },
          },
          update: {
            arreteReference,
            dateRentreeOfficielle: rentree,
            dateClotureOfficielle: cloture,
            trimestres,
            periodesVacances,
            active,
          },
          create: {
            academicYear,
            establishmentType,
            arreteReference,
            dateRentreeOfficielle: rentree,
            dateClotureOfficielle: cloture,
            trimestres,
            periodesVacances,
            active,
          },
        });
      }

      void logMasterAction({
        req,
        masterUserId: master.id,
        action: 'referentiel_calendar_save',
        targetId: result.id,
        description: `Calendrier ${result.academicYear} (${result.establishmentType}) mis à jour`,
      });

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  toggleCalendarActive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const master = req.masterUser;
      const id = String(req.params.id);
      const existing = await prisma.officialAcademicCalendar.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ success: false, message: 'Calendrier introuvable.' });
        return;
      }
      const updated = await prisma.officialAcademicCalendar.update({
        where: { id },
        data: { active: !existing.active },
      });
      void logMasterAction({
        req,
        masterUserId: master.id,
        action: 'referentiel_calendar_toggle',
        targetId: id,
        description: `Calendrier ${existing.academicYear} ${updated.active ? 'activé' : 'désactivé'}`,
      });
      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  };

  // ─── 3. Coefficients Bac (Arrêté N°92/22) ───────────────────────────────
  getBacCoefficients = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { serie, niveau, templateCode, search } = req.query;
      const where: { [key: string]: unknown } = {};

      if (serie && typeof serie === 'string') where.serie = serie;
      if (niveau && typeof niveau === 'string') where.niveau = niveau;
      if (templateCode && typeof templateCode === 'string') where.templateCode = templateCode;
      if (search && typeof search === 'string') {
        where.subjectName = { contains: search, mode: 'insensitive' };
      }

      const coeffs = await prisma.bacCoefficient.findMany({
        where,
        orderBy: [{ serie: 'asc' }, { niveau: 'asc' }, { groupe: 'asc' }, { subjectName: 'asc' }],
        take: 300,
      });

      res.json({ success: true, data: coeffs });
    } catch (error) {
      next(error);
    }
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

      let result;
      if (id) {
        result = await prisma.bacCoefficient.update({
          where: { id },
          data: {
            subjectName: subjectName.trim(),
            serie: serie.trim(),
            niveau,
            coefficient: Number(coefficient),
            groupe: Number(groupe),
            templateCode,
            source,
            isOfficialMinesec,
          },
        });
      } else {
        result = await prisma.bacCoefficient.upsert({
          where: {
            subjectName_serie_niveau_templateCode: {
              subjectName: subjectName.trim(),
              serie: serie.trim(),
              niveau,
              templateCode,
            },
          },
          update: {
            coefficient: Number(coefficient),
            groupe: Number(groupe),
            source,
            isOfficialMinesec,
          },
          create: {
            subjectName: subjectName.trim(),
            serie: serie.trim(),
            niveau,
            coefficient: Number(coefficient),
            groupe: Number(groupe),
            templateCode,
            source,
            isOfficialMinesec,
          },
        });
      }

      void logMasterAction({
        req,
        masterUserId: master.id,
        action: 'referentiel_bac_coeff_save',
        targetId: result.id,
        description: `Coefficient Bac ${result.subjectName} (${result.serie} - ${result.niveau}) fixé à ${result.coefficient}`,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  deleteBacCoefficient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const master = req.masterUser;
      const id = String(req.params.id);
      const existing = await prisma.bacCoefficient.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ success: false, message: 'Coefficient introuvable.' });
        return;
      }
      await prisma.bacCoefficient.delete({ where: { id } });
      void logMasterAction({
        req,
        masterUserId: master.id,
        action: 'referentiel_bac_coeff_delete',
        targetId: id,
        description: `Suppression coefficient Bac ${existing.subjectName} (${existing.serie})`,
      });
      res.json({ success: true, message: 'Entrée supprimée.' });
    } catch (error) {
      next(error);
    }
  };

  // ─── 4. Matières & Volumes Horaires par Template ────────────────────────
  getTemplateSubjects = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { templateCode, classLevel, filiere, search, subsystem } = req.query;

      if (subsystem === 'ANGLOPHONE') {
        const where: { [key: string]: unknown } = {};
        if (templateCode && typeof templateCode === 'string') where.templateCode = templateCode;
        if (classLevel && typeof classLevel === 'string') where.classLevel = classLevel;
        if (filiere && typeof filiere === 'string') where.filiere = filiere;
        if (search && typeof search === 'string') {
          where.subjectName = { contains: search, mode: 'insensitive' };
        }
        const entries = await prisma.anglophoneSubjectLoad.findMany({
          where,
          orderBy: [{ templateCode: 'asc' }, { classLevel: 'asc' }, { subjectName: 'asc' }],
          take: 300,
        });
        res.json({ success: true, data: entries, subsystem: 'ANGLOPHONE' });
        return;
      }

      // Par défaut ou FRANCOPHONE
      const where: { [key: string]: unknown } = {};
      if (templateCode && typeof templateCode === 'string') where.templateCode = templateCode;
      if (classLevel && typeof classLevel === 'string') where.classLevel = classLevel;
      if (filiere && typeof filiere === 'string') where.filiere = filiere;
      if (search && typeof search === 'string') {
        where.subjectName = { contains: search, mode: 'insensitive' };
      }

      const entries = await prisma.cycleCoefficient.findMany({
        where,
        orderBy: [{ templateCode: 'asc' }, { classLevel: 'asc' }, { subjectName: 'asc' }],
        take: 300,
      });

      res.json({ success: true, data: entries, subsystem: 'FRANCOPHONE' });
    } catch (error) {
      next(error);
    }
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

      let result;
      if (subsystem === 'ANGLOPHONE') {
        if (id) {
          result = await prisma.anglophoneSubjectLoad.update({
            where: { id },
            data: {
              templateCode,
              classLevel,
              subjectName: subjectName.trim(),
              coefficient: Math.round(Number(coefficient)),
              weeklyPeriods: weeklyPeriods ? Number(weeklyPeriods) : null,
              filiere,
            },
          });
        } else {
          result = await prisma.anglophoneSubjectLoad.upsert({
            where: {
              templateCode_classLevel_subjectName_filiere: {
                templateCode,
                classLevel,
                subjectName: subjectName.trim(),
                filiere,
              },
            },
            update: {
              coefficient: Math.round(Number(coefficient)),
              weeklyPeriods: weeklyPeriods ? Number(weeklyPeriods) : null,
            },
            create: {
              templateCode,
              classLevel,
              subjectName: subjectName.trim(),
              coefficient: Math.round(Number(coefficient)),
              weeklyPeriods: weeklyPeriods ? Number(weeklyPeriods) : null,
              filiere,
            },
          });
        }
      } else {
        if (id) {
          result = await prisma.cycleCoefficient.update({
            where: { id },
            data: {
              templateCode,
              classLevel,
              subjectName: subjectName.trim(),
              coefficient: Number(coefficient),
              weeklyPeriods: weeklyPeriods ? Number(weeklyPeriods) : null,
              filiere,
            },
          });
        } else {
          result = await prisma.cycleCoefficient.upsert({
            where: {
              templateCode_classLevel_subjectName_filiere: {
                templateCode,
                classLevel,
                subjectName: subjectName.trim(),
                filiere,
              },
            },
            update: {
              coefficient: Number(coefficient),
              weeklyPeriods: weeklyPeriods ? Number(weeklyPeriods) : null,
            },
            create: {
              templateCode,
              classLevel,
              subjectName: subjectName.trim(),
              coefficient: Number(coefficient),
              weeklyPeriods: weeklyPeriods ? Number(weeklyPeriods) : null,
              filiere,
            },
          });
        }
      }

      void logMasterAction({
        req,
        masterUserId: master.id,
        action: 'referentiel_template_subject_save',
        targetId: result.id,
        description: `Matière ${result.subjectName} (${result.templateCode} - ${result.classLevel}) enregistrée`,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  deleteTemplateSubject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const master = req.masterUser;
      const id = String(req.params.id);
      const { subsystem = 'FRANCOPHONE' } = req.query;

      if (subsystem === 'ANGLOPHONE') {
        const existing = await prisma.anglophoneSubjectLoad.findUnique({ where: { id } });
        if (!existing) {
          res.status(404).json({ success: false, message: 'Entrée introuvable.' });
          return;
        }
        await prisma.anglophoneSubjectLoad.delete({ where: { id } });
        void logMasterAction({
          req,
          masterUserId: master.id,
          action: 'referentiel_template_subject_delete',
          targetId: id,
          description: `Suppression matière anglophone ${existing.subjectName} (${existing.templateCode})`,
        });
      } else {
        const existing = await prisma.cycleCoefficient.findUnique({ where: { id } });
        if (!existing) {
          res.status(404).json({ success: false, message: 'Entrée introuvable.' });
          return;
        }
        await prisma.cycleCoefficient.delete({ where: { id } });
        void logMasterAction({
          req,
          masterUserId: master.id,
          action: 'referentiel_template_subject_delete',
          targetId: id,
          description: `Suppression matière cycle ${existing.subjectName} (${existing.templateCode})`,
        });
      }

      res.json({ success: true, message: 'Entrée supprimée.' });
    } catch (error) {
      next(error);
    }
  };

  // ─── 5. Programmes Officiels & Progressions Types ───────────────────────
  getProgressions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { templateCode, level, search } = req.query;
      const where: { [key: string]: unknown } = {};

      if (templateCode && typeof templateCode === 'string') where.templateCode = templateCode;
      if (level && typeof level === 'string') where.level = level;
      if (search && typeof search === 'string') {
        where.OR = [
          { subjectName: { contains: search, mode: 'insensitive' } },
          { titre: { contains: search, mode: 'insensitive' } },
        ];
      }

      const progressions = await prisma.officialProgrammeProgression.findMany({
        where,
        orderBy: [{ templateCode: 'asc' }, { level: 'asc' }, { subjectName: 'asc' }],
        take: 200,
      });

      res.json({ success: true, data: progressions });
    } catch (error) {
      next(error);
    }
  };

  saveProgression = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const master = req.masterUser;
      const { id, templateCode, level, filiere, subjectName, titre, chapitres = [], active = true } = req.body;

      if (!templateCode || !level || !subjectName || !titre) {
        res.status(400).json({ success: false, message: 'templateCode, level, subjectName et titre sont requis.' });
        return;
      }

      let result;
      if (id) {
        result = await prisma.officialProgrammeProgression.update({
          where: { id },
          data: {
            templateCode,
            level,
            filiere: filiere ?? null,
            subjectName: subjectName.trim(),
            titre: titre.trim(),
            chapitres,
            active,
          },
        });
      } else {
        result = await prisma.officialProgrammeProgression.upsert({
          where: {
            templateCode_level_subjectName: {
              templateCode,
              level,
              subjectName: subjectName.trim(),
            },
          },
          update: {
            filiere: filiere ?? null,
            titre: titre.trim(),
            chapitres,
            active,
          },
          create: {
            templateCode,
            level,
            filiere: filiere ?? null,
            subjectName: subjectName.trim(),
            titre: titre.trim(),
            chapitres,
            active,
          },
        });
      }

      void logMasterAction({
        req,
        masterUserId: master.id,
        action: 'referentiel_progression_save',
        targetId: result.id,
        description: `Progression officielle «${result.titre}» (${result.templateCode} - ${result.level}) enregistrée`,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  deleteProgression = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const master = req.masterUser;
      const id = String(req.params.id);
      const existing = await prisma.officialProgrammeProgression.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ success: false, message: 'Progression introuvable.' });
        return;
      }
      await prisma.officialProgrammeProgression.delete({ where: { id } });
      void logMasterAction({
        req,
        masterUserId: master.id,
        action: 'referentiel_progression_delete',
        targetId: id,
        description: `Suppression progression ${existing.titre}`,
      });
      res.json({ success: true, message: 'Progression supprimée.' });
    } catch (error) {
      next(error);
    }
  };

  // ─── 6. Tarifs MINESEC Réglementaires ────────────────────────────────────
  getTarifsMinesec = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { anneeScolaire, typeFrais } = req.query;
      const where: { [key: string]: unknown } = {};
      if (anneeScolaire && typeof anneeScolaire === 'string') where.anneeScolaire = anneeScolaire;
      if (typeFrais && typeof typeFrais === 'string') where.typeFrais = typeFrais as TypeFraisMinesec;

      const tarifs = await prisma.tarifMinesecReference.findMany({
        where,
        orderBy: [{ anneeScolaire: 'desc' }, { typeFrais: 'asc' }],
      });

      res.json({ success: true, data: tarifs });
    } catch (error) {
      next(error);
    }
  };

  saveTarifMinesec = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const master = req.masterUser;
      const { id, typeFrais, anneeScolaire, niveau, montantFCFA, description, actif = true } = req.body;

      if (!typeFrais || !anneeScolaire || montantFCFA === undefined) {
        res.status(400).json({ success: false, message: 'typeFrais, anneeScolaire et montantFCFA sont requis.' });
        return;
      }

      let result;
      if (id) {
        result = await prisma.tarifMinesecReference.update({
          where: { id },
          data: {
            typeFrais,
            anneeScolaire,
            niveau: niveau ?? null,
            montantFCFA: Number(montantFCFA),
            description: description ?? null,
            actif,
          },
        });
      } else {
        const existing = await prisma.tarifMinesecReference.findFirst({
          where: { typeFrais, anneeScolaire, niveau: niveau ?? null },
        });

        if (existing) {
          result = await prisma.tarifMinesecReference.update({
            where: { id: existing.id },
            data: {
              montantFCFA: Number(montantFCFA),
              description: description ?? null,
              actif,
            },
          });
        } else {
          result = await prisma.tarifMinesecReference.create({
            data: {
              typeFrais,
              anneeScolaire,
              niveau: niveau ?? null,
              montantFCFA: Number(montantFCFA),
              description: description ?? null,
              actif,
            },
          });
        }
      }

      void logMasterAction({
        req,
        masterUserId: master.id,
        action: 'referentiel_tarif_minesec_save',
        targetId: result.id,
        description: `Tarif MINESEC ${result.typeFrais} (${result.anneeScolaire}) fixé à ${result.montantFCFA} FCFA`,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  toggleTarifActive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const master = req.masterUser;
      const id = String(req.params.id);
      const existing = await prisma.tarifMinesecReference.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ success: false, message: 'Tarif introuvable.' });
        return;
      }
      const updated = await prisma.tarifMinesecReference.update({
        where: { id },
        data: { actif: !existing.actif },
      });
      void logMasterAction({
        req,
        masterUserId: master.id,
        action: 'referentiel_tarif_minesec_toggle',
        targetId: id,
        description: `Tarif ${existing.typeFrais} (${existing.anneeScolaire}) ${updated.actif ? 'activé' : 'désactivé'}`,
      });
      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  };
}
