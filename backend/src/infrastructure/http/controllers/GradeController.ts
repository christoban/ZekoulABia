import type { Request, Response, NextFunction } from 'express';
import { GradeSaisieController } from './grade/GradeSaisieController';
import { GradeValidationController } from './grade/GradeValidationController';
import { GradeLectureController } from './grade/GradeLectureController';
import { GradeExcelController } from './grade/GradeExcelController';
import type { SaisirNoteUseCase } from '@application/grade/SaisirNoteUseCase';
import type { VerrouillerNoteUseCase } from '@application/grade/VerrouillerNoteUseCase';
import type { VerrouillerNotesEnMasseUseCase } from '@application/grade/VerrouillerNotesEnMasseUseCase';
import type { ModifierNoteUseCase } from '@application/grade/ModifierNoteUseCase';
import type { DraftEnMasseUseCase } from '@application/grade/DraftEnMasseUseCase';
import type { ListerNotesUseCase } from '@application/grade/ListerNotesUseCase';
import type { ListerNotesEnAttenteUseCase } from '@application/grade/ListerNotesEnAttenteUseCase';
import type { StatutParClasseUseCase } from '@application/grade/StatutParClasseUseCase';
import type { CalculerMoyenneUseCase } from '@application/grade/CalculerMoyenneUseCase';
import type { ImporterNotesExcelUseCase } from '@application/grade/ImporterNotesExcelUseCase';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { MatiereRepository } from '@domain/ports/repositories/MatiereRepository';
import type { EventPublisher } from '@domain/ports/services/EventPublisher';

export * from './grade/GradeSaisieController';
export * from './grade/GradeValidationController';
export * from './grade/GradeLectureController';
export * from './grade/GradeExcelController';
export * from './grade/gradeErrors';

/**
 * GradeController — Façade de composition regroupant les 4 contrôleurs spécialisés :
 * - GradeSaisieController (saisie, modification, draft en masse)
 * - GradeValidationController (verrouillage unitaire/en bloc)
 * - GradeLectureController (listes, attente, statut par classe, moyenne élève)
 * - GradeExcelController (génération template, import fichier Excel)
 */
export class GradeController {
  public readonly saisieController: GradeSaisieController;
  public readonly validationController: GradeValidationController;
  public readonly lectureController: GradeLectureController;
  public readonly excelController: GradeExcelController;

  constructor(
    saisirNote: SaisirNoteUseCase,
    verrouillerNote: VerrouillerNoteUseCase,
    verrouillerNotesEnMasse: VerrouillerNotesEnMasseUseCase,
    modifierNote: ModifierNoteUseCase,
    draftEnMasseUC: DraftEnMasseUseCase,
    listerNotes: ListerNotesUseCase,
    listerNotesEnAttente: ListerNotesEnAttenteUseCase,
    statutParClasseUC: StatutParClasseUseCase,
    calculerMoyenneUC: CalculerMoyenneUseCase,
    importerNotesExcel: ImporterNotesExcelUseCase,
    anneeRepository: AnneeAcademiqueRepository,
    classeRepository: ClasseRepository,
    matiereRepository: MatiereRepository,
    eventPublisher: EventPublisher,
  ) {
    this.saisieController = new GradeSaisieController(
      saisirNote,
      modifierNote,
      draftEnMasseUC,
      anneeRepository,
    );
    this.validationController = new GradeValidationController(
      verrouillerNote,
      verrouillerNotesEnMasse,
      eventPublisher,
    );
    this.lectureController = new GradeLectureController(
      listerNotes,
      listerNotesEnAttente,
      statutParClasseUC,
      calculerMoyenneUC,
    );
    this.excelController = new GradeExcelController(
      importerNotesExcel,
      anneeRepository,
      classeRepository,
      matiereRepository,
    );
  }

  // ── Saisie & Édition ────────────────────────────────────────────────────────
  saisir = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.saisieController.saisir(req, res, next);

  modifier = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.saisieController.modifier(req, res, next);

  draftEnMasse = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.saisieController.draftEnMasse(req, res, next);

  // ── Validation & Workflow ───────────────────────────────────────────────────
  verrouiller = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.validationController.verrouiller(req, res, next);

  verrouillerEnMasse = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.validationController.verrouillerEnMasse(req, res, next);

  // ── Consultation & Lecture ──────────────────────────────────────────────────
  lister = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.lectureController.lister(req, res, next);

  listerEnAttente = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.lectureController.listerEnAttente(req, res, next);

  statutParClasse = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.lectureController.statutParClasse(req, res, next);

  moyenneEleve = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.lectureController.moyenneEleve(req, res, next);

  // ── Import & Export Excel ───────────────────────────────────────────────────
  genererTemplate = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.excelController.genererTemplate(req, res, next);

  importerDepuisExcel = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.excelController.importerDepuisExcel(req, res, next);
}
