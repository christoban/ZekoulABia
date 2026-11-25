import type { Request, Response, NextFunction } from 'express';
import type { OrientationCheckpointType } from '@domain/entities/FicheOrientation';
import type { SaisirAspirationsEleveUseCase } from '@application/orientation/SaisirAspirationsEleveUseCase';
import type { GenererRecommandationOrientationUseCase } from '@application/orientation/GenererRecommandationOrientationUseCase';
import type { ValiderRecommandationConseillerUseCase } from '@application/orientation/ValiderRecommandationConseillerUseCase';
import type { ProposerRecommandationEleveUseCase } from '@application/orientation/ProposerRecommandationEleveUseCase';
import type { ChoisirPisteEleveUseCase } from '@application/orientation/ChoisirPisteEleveUseCase';
import type { ListerElevesAOrienterUseCase } from '@application/orientation/ListerElevesAOrienterUseCase';
import type { ConfigurerCheckpointOrientationUseCase } from '@application/orientation/ConfigurerCheckpointOrientationUseCase';
import type { IOrientationRepository } from '@domain/ports/repositories/IOrientationRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { ParentRepository } from '@domain/ports/repositories/ParentRepository';
import { checkOrientationPermission } from './orientationDossierHelper';

export interface OrientationCheckpointDeps {
  repo: IOrientationRepository;
  saisirAspiration: SaisirAspirationsEleveUseCase;
  genererRecommandation: GenererRecommandationOrientationUseCase;
  validerRecommandationConseiller: ValiderRecommandationConseillerUseCase;
  proposerRecommandationEleve: ProposerRecommandationEleveUseCase;
  choisirPisteEleve: ChoisirPisteEleveUseCase;
  listerElevesAOrienter: ListerElevesAOrienterUseCase;
  configurerCheckpoint: ConfigurerCheckpointOrientationUseCase;
  anneeRepo: AnneeAcademiqueRepository;
  parentRepo: ParentRepository;
}

async function anneeCouranteId(
  deps: OrientationCheckpointDeps,
  schoolId: string,
): Promise<string | null> {
  const annee = await deps.anneeRepo.findCourante(schoolId);
  return annee?.id ?? null;
}

function handleValidation422Error(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof Error) {
    res.status(422).json({ success: false, message: err.message });
    return;
  }
  next(err);
}

export async function saisirAspirationAction(
  deps: OrientationCheckpointDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentification requise' });
      return;
    }
    if (user.role !== 'STUDENT') {
      res.status(403).json({ success: false, message: 'Réservé aux élèves' });
      return;
    }
    const { checkpointType, desiredTrack, careerInterest } = req.body;
    if (!checkpointType) {
      res.status(400).json({ success: false, message: 'checkpointType requis' });
      return;
    }
    const aspiration = await deps.saisirAspiration.execute({
      studentId: user.userId,
      schoolId: user.schoolId,
      checkpointType,
      desiredTrack,
      careerInterest,
    });
    res.status(201).json({ success: true, data: aspiration });
  } catch (err) {
    next(err);
  }
}

export async function obtenirAspirationAction(
  deps: OrientationCheckpointDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentification requise' });
      return;
    }
    if (user.role !== 'STUDENT') {
      res.status(403).json({ success: false, message: 'Réservé aux élèves' });
      return;
    }
    const aspiration = await deps.repo.findAspiration(
      user.userId,
      req.params.checkpointType as OrientationCheckpointType,
    );
    res.json({ success: true, data: aspiration });
  } catch (err) {
    next(err);
  }
}

export async function genererRecommandationAction(
  deps: OrientationCheckpointDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!checkOrientationPermission(user, res)) return;
    const { studentId } = req.body;
    if (!studentId) {
      res.status(400).json({ success: false, message: 'studentId requis' });
      return;
    }
    const academicYearId = await anneeCouranteId(deps, user.schoolId);
    if (!academicYearId) {
      res.status(400).json({ success: false, message: 'Aucune année académique courante' });
      return;
    }
    const reco = await deps.genererRecommandation.execute({
      schoolId: user.schoolId,
      studentId,
      checkpointType: req.params.type as OrientationCheckpointType,
      academicYearId,
      conseillerId: user.userId,
    });
    res.status(201).json({ success: true, data: reco });
  } catch (err) {
    next(err);
  }
}

export async function validerRecommandationConseillerAction(
  deps: OrientationCheckpointDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!checkOrientationPermission(user, res)) return;
    const { serieRecommandee } = req.body;
    if (!serieRecommandee) {
      res.status(400).json({ success: false, message: 'serieRecommandee requis' });
      return;
    }
    const reco = await deps.validerRecommandationConseiller.execute({
      recommandationId: req.params.id as string,
      schoolId: user.schoolId,
      serieRecommandee,
    });
    res.json({ success: true, data: reco });
  } catch (err) {
    handleValidation422Error(err, res, next);
  }
}

export async function proposerRecommandationEleveAction(
  deps: OrientationCheckpointDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!checkOrientationPermission(user, res)) return;
    const reco = await deps.proposerRecommandationEleve.execute({
      recommandationId: req.params.id as string,
      schoolId: user.schoolId,
    });
    res.json({ success: true, data: reco });
  } catch (err) {
    handleValidation422Error(err, res, next);
  }
}

export async function choisirPisteEleveAction(
  deps: OrientationCheckpointDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentification requise' });
      return;
    }
    if (user.role !== 'STUDENT') {
      res.status(403).json({ success: false, message: 'Réservé aux élèves' });
      return;
    }
    const { track } = req.body;
    if (!track) {
      res.status(400).json({ success: false, message: 'track requis' });
      return;
    }
    const reco = await deps.choisirPisteEleve.execute({
      recommandationId: req.params.id as string,
      schoolId: user.schoolId,
      studentId: user.userId,
      track,
    });
    res.json({ success: true, data: reco });
  } catch (err) {
    handleValidation422Error(err, res, next);
  }
}

export async function maRecommandationAction(
  deps: OrientationCheckpointDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentification requise' });
      return;
    }
    if (user.role !== 'STUDENT' && user.role !== 'PARENT') {
      res.status(403).json({ success: false, message: 'Réservé aux élèves et parents' });
      return;
    }
    const studentId = user.role === 'STUDENT' ? user.userId : (req.query.studentId as string);
    if (user.role === 'PARENT') {
      if (!studentId) {
        res.status(400).json({ success: false, message: 'studentId requis' });
        return;
      }
      const lien = await deps.parentRepo.aAccesEleve(user.userId, studentId);
      if (!lien) {
        res.status(403).json({ success: false, message: 'Cet élève n\'est pas rattaché à votre compte' });
        return;
      }
    }

    const academicYearId = await anneeCouranteId(deps, user.schoolId);
    if (!academicYearId) {
      res.json({ success: true, data: null });
      return;
    }

    const fiche = await deps.repo.findFicheByStudentAndYear(studentId, academicYearId);
    if (!fiche) {
      res.json({ success: true, data: null });
      return;
    }

    const detail = await deps.repo.findFicheDetailById(fiche.id, user.schoolId);
    const reco = detail?.recommandation ?? null;
    // L'élève/parent ne voit jamais le reste de la fiche (entretiens, suivis...) — uniquement
    // la recommandation, quand elle concerne bien le checkpoint demandé.
    const checkpointType = req.params.checkpointType;
    res.json({
      success: true,
      data: reco && (!checkpointType || reco.checkpointType === checkpointType) ? reco : null,
    });
  } catch (err) {
    next(err);
  }
}

export async function elevesAOrienterAction(
  deps: OrientationCheckpointDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!checkOrientationPermission(user, res)) return;
    const { checkpointType } = req.query as Record<string, string>;
    if (!checkpointType) {
      res.status(400).json({ success: false, message: 'checkpointType requis' });
      return;
    }
    const academicYearId = await anneeCouranteId(deps, user.schoolId);
    if (!academicYearId) {
      res.json({ success: true, data: [] });
      return;
    }
    const eleves = await deps.listerElevesAOrienter.execute({
      schoolId: user.schoolId,
      checkpointType: checkpointType as OrientationCheckpointType,
      academicYearId,
    });
    res.json({ success: true, data: eleves });
  } catch (err) {
    next(err);
  }
}

export async function obtenirConfigCheckpointAction(
  deps: OrientationCheckpointDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!checkOrientationPermission(user, res)) return;
    const config = await deps.repo.findCheckpointConfig(
      user.schoolId,
      req.params.type as OrientationCheckpointType,
    );
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
}

export async function configurerCheckpointAction(
  deps: OrientationCheckpointDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentification requise' });
      return;
    }
    if (user.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Seul un ADMIN peut configurer les checkpoints d\'orientation',
      });
      return;
    }
    const {
      possibleTracks,
      relevantSubjects,
      psychotechnicalTestRequired,
      windowStartMonth,
      windowStartDay,
      windowEndMonth,
      windowEndDay,
      responseDeadlineDays,
    } = req.body;
    const config = await deps.configurerCheckpoint.execute({
      schoolId: user.schoolId,
      type: req.params.type as OrientationCheckpointType,
      possibleTracks,
      relevantSubjects,
      psychotechnicalTestRequired: psychotechnicalTestRequired === true || psychotechnicalTestRequired === 'true',
      windowStartMonth,
      windowStartDay,
      windowEndMonth,
      windowEndDay,
      responseDeadlineDays,
    });
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
}
