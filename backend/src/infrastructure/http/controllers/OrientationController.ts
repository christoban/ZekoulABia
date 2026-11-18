import type { Request, Response, NextFunction } from 'express';
import type { TypePreoccupation } from '@domain/entities/FicheOrientation';
import type { CreerFicheOrientationUseCase } from '@application/orientation/CreerFicheOrientationUseCase';
import type { AjouterEntretienUseCase } from '@application/orientation/AjouterEntretienUseCase';
import type { AjouterTestAptitudeUseCase } from '@application/orientation/AjouterTestAptitudeUseCase';
import type { CreerRecommandationSerieUseCase } from '@application/orientation/CreerRecommandationSerieUseCase';
import type { AjouterSuiviUseCase } from '@application/orientation/AjouterSuiviUseCase';
import type { ListerFichesOrientationUseCase } from '@application/orientation/ListerFichesOrientationUseCase';
import type { GetStatsOrientationUseCase } from '@application/orientation/GetStatsOrientationUseCase';
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
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import {
  ajouterEntretienAction,
  ajouterSuiviAction,
  ajouterTestAction,
  checkOrientationPermission,
  creerRecommandationAction,
  modifierEntretienAction,
  validerRecommandationAction,
  type OrientationDossierDeps,
} from './helpers/orientationDossierHelper';
import {
  choisirPisteEleveAction,
  configurerCheckpointAction,
  elevesAOrienterAction,
  genererRecommandationAction,
  maRecommandationAction,
  obtenirAspirationAction,
  obtenirConfigCheckpointAction,
  proposerRecommandationEleveAction,
  saisirAspirationAction,
  validerRecommandationConseillerAction,
  type OrientationCheckpointDeps,
} from './helpers/orientationCheckpointHelper';

const TYPES_PREOCCUPATION: TypePreoccupation[] = ['SCOLAIRE', 'COMPORTEMENTAL', 'FAMILIAL', 'PROFESSIONNEL', 'SANTE', 'AUTRE'];

export class OrientationController {
  constructor(
    private readonly creerFiche: CreerFicheOrientationUseCase,
    private readonly ajouterEntretien: AjouterEntretienUseCase,
    private readonly ajouterTest: AjouterTestAptitudeUseCase,
    private readonly creerRecommandation: CreerRecommandationSerieUseCase,
    private readonly ajouterSuivi: AjouterSuiviUseCase,
    private readonly listerFiches: ListerFichesOrientationUseCase,
    private readonly getStats: GetStatsOrientationUseCase,
    private readonly repo: IOrientationRepository,
    private readonly saisirAspiration: SaisirAspirationsEleveUseCase,
    private readonly genererRecommandation: GenererRecommandationOrientationUseCase,
    private readonly validerRecommandationConseiller: ValiderRecommandationConseillerUseCase,
    private readonly proposerRecommandationEleve: ProposerRecommandationEleveUseCase,
    private readonly choisirPisteEleve: ChoisirPisteEleveUseCase,
    private readonly listerElevesAOrienter: ListerElevesAOrienterUseCase,
    private readonly configurerCheckpoint: ConfigurerCheckpointOrientationUseCase,
    private readonly audit: AIActionAuditPort,
    private readonly anneeRepo: AnneeAcademiqueRepository,
    private readonly parentRepo: ParentRepository,
  ) {}

  private get dossierDeps(): OrientationDossierDeps {
    return {
      ajouterEntretien: this.ajouterEntretien,
      ajouterTest: this.ajouterTest,
      creerRecommandation: this.creerRecommandation,
      ajouterSuivi: this.ajouterSuivi,
      repo: this.repo,
      audit: this.audit,
    };
  }

  private get checkpointDeps(): OrientationCheckpointDeps {
    return {
      repo: this.repo,
      saisirAspiration: this.saisirAspiration,
      genererRecommandation: this.genererRecommandation,
      validerRecommandationConseiller: this.validerRecommandationConseiller,
      proposerRecommandationEleve: this.proposerRecommandationEleve,
      choisirPisteEleve: this.choisirPisteEleve,
      listerElevesAOrienter: this.listerElevesAOrienter,
      configurerCheckpoint: this.configurerCheckpoint,
      anneeRepo: this.anneeRepo,
      parentRepo: this.parentRepo,
    };
  }

  // GET /api/v2/orientation/stats
  obtenirStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!checkOrientationPermission(user, res)) return;
      const { academicYearId } = req.query as Record<string, string>;
      const stats = await this.getStats.execute({ schoolId: user.schoolId, academicYearId });
      res.json({ success: true, data: stats });
    } catch (err) { next(err); }
  };

  // GET /api/v2/orientation/fiches
  lister = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!checkOrientationPermission(user, res)) return;
      const { classId, riskLevel, status, academicYearId, page, limit } = req.query as Record<string, string>;
      const resultat = await this.listerFiches.execute({
        schoolId: user.schoolId,
        classId,
        riskLevel,
        status,
        academicYearId,
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined,
      });
      res.json({ success: true, ...resultat });
    } catch (err) { next(err); }
  };

  // POST /api/v2/orientation/fiches
  creer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!checkOrientationPermission(user, res)) return;
      const { studentId, mainConcern, academicYearId } = req.body as {
        studentId: string; mainConcern?: string; academicYearId: string;
      };
      if (!studentId || !academicYearId) {
        res.status(400).json({ success: false, message: 'studentId et academicYearId requis' });
        return;
      }
      // mainConcern circulait vers Prisma sans validation (cast non typé) — une valeur hors
      // énumération levait une PrismaClientValidationError (500) plutôt qu'un 400 propre.
      if (mainConcern !== undefined && !TYPES_PREOCCUPATION.includes(mainConcern as TypePreoccupation)) {
        res.status(400).json({ success: false, message: `mainConcern doit être : ${TYPES_PREOCCUPATION.join(', ')}` });
        return;
      }
      const fiche = await this.creerFiche.execute({
        studentId,
        schoolId: user.schoolId,
        academicYearId,
        conseillerId: user.userId,
        mainConcern: mainConcern as TypePreoccupation | undefined,
      });
      // Bug indépendant trouvé en écrivant le test de ce site : FicheOrientation est une entité
      // de domaine (champs exposés via des getters, non énumérables) — la sérialiser telle
      // quelle avec res.json() ne renvoie QUE son champ privé `props` (JSON.stringify() énumère
      // les propriétés propres, pas les getters de prototype), jamais fiche.id directement.
      // Tout consommateur de cette réponse (frontend inclus) recevait data.props.id au lieu de
      // data.id — jamais data.id lui-même, cassant la navigation post-création.
      res.status(201).json({
        success: true,
        data: {
          id: fiche.id,
          studentId: fiche.studentId,
          schoolId: fiche.schoolId,
          academicYearId: fiche.academicYearId,
          conseillerId: fiche.conseillerId,
          status: fiche.status,
          riskLevel: fiche.riskLevel,
          mainConcern: fiche.mainConcern,
          createdAt: fiche.createdAt,
          updatedAt: fiche.updatedAt,
        },
      });
    } catch (err) {
      if (err instanceof Error && err.message.includes('existe déjà')) {
        res.status(409).json({ success: false, message: err.message });
        return;
      }
      next(err);
    }
  };

  // GET /api/v2/orientation/fiches/:id
  detail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!checkOrientationPermission(user, res)) return;
      const fiche = await this.repo.findFicheDetailById(req.params.id as string, user.schoolId);
      if (!fiche) {
        res.status(404).json({ success: false, message: 'Fiche d\'orientation introuvable' });
        return;
      }
      res.json({ success: true, data: fiche });
    } catch (err) { next(err); }
  };

  // POST /api/v2/orientation/fiches/:id/entretiens
  ajouterEntretienHandler = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    ajouterEntretienAction(this.dossierDeps, req, res, next);

  // PATCH /api/v2/orientation/entretiens/:id
  modifierEntretien = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    modifierEntretienAction(this.dossierDeps, req, res, next);

  // POST /api/v2/orientation/fiches/:id/tests
  ajouterTestHandler = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    ajouterTestAction(this.dossierDeps, req, res, next);

  // POST /api/v2/orientation/fiches/:id/recommandation-serie
  creerRecommandationHandler = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    creerRecommandationAction(this.dossierDeps, req, res, next);

  // PATCH /api/v2/orientation/recommandations/:id/valider
  validerRecommandation = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    validerRecommandationAction(this.dossierDeps, req, res, next);

  // POST /api/v2/orientation/fiches/:id/suivis
  ajouterSuiviHandler = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    ajouterSuiviAction(this.dossierDeps, req, res, next);

  // ── Moteur de checkpoints (A.5 du plan) ──────────────────────────────────────────

  // POST /api/v2/orientation/aspirations — élève
  saisirAspirationHandler = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    saisirAspirationAction(this.checkpointDeps, req, res, next);

  // GET /api/v2/orientation/aspirations/:checkpointType — élève consulte la sienne
  obtenirAspiration = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    obtenirAspirationAction(this.checkpointDeps, req, res, next);

  // POST /api/v2/orientation/checkpoints/:type/generer — conseiller déclenche manuellement
  genererRecommandationHandler = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    genererRecommandationAction(this.checkpointDeps, req, res, next);

  // PATCH /api/v2/orientation/recommandations/:id/valider-conseiller
  validerRecommandationConseillerHandler = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    validerRecommandationConseillerAction(this.checkpointDeps, req, res, next);

  // PATCH /api/v2/orientation/recommandations/:id/proposer-eleve
  proposerRecommandationEleveHandler = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    proposerRecommandationEleveAction(this.checkpointDeps, req, res, next);

  // PATCH /api/v2/orientation/recommandations/:id/choisir-piste — élève
  choisirPisteEleveHandler = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    choisirPisteEleveAction(this.checkpointDeps, req, res, next);

  // GET /api/v2/orientation/ma-recommandation/:checkpointType — élève consulte SA proposition en cours
  maRecommandation = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    maRecommandationAction(this.checkpointDeps, req, res, next);

  // GET /api/v2/orientation/eleves-a-orienter — filet de sécurité conseiller
  elevesAOrienterHandler = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    elevesAOrienterAction(this.checkpointDeps, req, res, next);

  // GET /api/v2/orientation/checkpoints/:type/config
  obtenirConfigCheckpoint = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    obtenirConfigCheckpointAction(this.checkpointDeps, req, res, next);

  // PUT /api/v2/orientation/checkpoints/:type/config — ADMIN uniquement
  configurerCheckpointHandler = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    configurerCheckpointAction(this.checkpointDeps, req, res, next);
}
