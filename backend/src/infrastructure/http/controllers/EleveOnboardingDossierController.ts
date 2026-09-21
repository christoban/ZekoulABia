/**
 * INFRASTRUCTURE — Contrôleur HTTP pour le Dossier V2 des élèves
 * (Pièces justificatives, suggestions de classes, validation par lot, fiche PDF).
 *
 * Scindé pour respecter le principe Single Responsibility et le plafond de 500 lignes.
 */
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import type { GererPiecesDossierUseCase } from '@application/eleveOnboarding/GererPiecesDossierUseCase';
import type { SuggererClassesDossierUseCase } from '@application/eleveOnboarding/SuggererClassesDossierUseCase';
import type { GenererFicheInscriptionPdfUseCase } from '@application/eleveOnboarding/GenererFicheInscriptionPdfUseCase';
import type { ValiderLotOnboardingUseCase } from '@application/eleveOnboarding/ValiderLotOnboardingUseCase';

const ENROLLMENT_PIECES_DIR = path.resolve(process.cwd(), 'storage', 'enrollment-pieces');
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;

export class EleveOnboardingDossierController {
  constructor(
    private readonly gererPiecesUseCase: GererPiecesDossierUseCase,
    private readonly suggererClassesUseCase: SuggererClassesDossierUseCase,
    private readonly genererFichePdfUseCase: GenererFicheInscriptionPdfUseCase,
    private readonly validerLotUseCase: ValiderLotOnboardingUseCase,
  ) {}

  // GET /api/v2/eleve-onboarding/classes-suggestions?level=...&academicYearId=...
  suggererClasses = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const level = req.query['level'] ? String(req.query['level']) : undefined;
      const academicYearId = req.query['academicYearId'] ? String(req.query['academicYearId']) : undefined;

      const suggestions = await this.suggererClassesUseCase.execute({
        schoolId,
        level,
        academicYearId,
      });

      res.json({ success: true, data: suggestions });
    } catch (err) {
      next(err);
    }
  };

  // POST /api/v2/eleve-onboarding/:id/pieces/init
  initialiserPieces = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const onboardingId = String(req.params['id']);
      const { sourceType } = req.body as { sourceType?: string };

      const resultat = await this.gererPiecesUseCase.initialiserPieces({
        schoolId,
        onboardingId,
        sourceType,
      });

      res.json({ success: true, data: resultat });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v2/eleve-onboarding/:id/pieces
  listerPieces = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const onboardingId = String(req.params['id']);

      const resultat = await this.gererPiecesUseCase.consulterCompletude(schoolId, onboardingId);
      res.json({ success: true, data: resultat });
    } catch (err) {
      next(err);
    }
  };

  // PATCH /api/v2/eleve-onboarding/:id/pieces/:code
  marquerPiece = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const onboardingId = String(req.params['id']);
      const code = String(req.params['code']);
      const { received, note, fileKey } = req.body as {
        received: boolean;
        note?: string | null;
        fileKey?: string | null;
      };

      const resultat = await this.gererPiecesUseCase.marquerPiece({
        schoolId,
        onboardingId,
        code,
        received: Boolean(received),
        receivedById: req.user!.userId,
        note,
        fileKey,
      });

      res.json({ success: true, data: resultat });
    } catch (err) {
      next(err);
    }
  };

  // POST /api/v2/eleve-onboarding/:id/pieces/:code/upload
  uploadPiece = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const onboardingId = String(req.params['id']);
      const code = String(req.params['code']);
      const file = req.file as Express.Multer.File | undefined;

      if (!file) {
        res.status(400).json({ success: false, message: 'Aucun fichier reçu' });
        return;
      }

      if (!ALLOWED_MIME_TYPES.includes(file.mimetype as typeof ALLOWED_MIME_TYPES[number])) {
        res.status(400).json({
          success: false,
          message: 'Format non supporté. Formats acceptés : JPG, PNG, WEBP ou PDF',
        });
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        res.status(400).json({ success: false, message: 'Fichier trop volumineux (maximum 5 Mo)' });
        return;
      }

      const uploadDir = path.join(ENROLLMENT_PIECES_DIR, schoolId, onboardingId);
      fs.mkdirSync(uploadDir, { recursive: true });

      const safeExt = path.extname(file.originalname).toLowerCase() || '.jpg';
      const fileName = `${code}-${Date.now()}${safeExt}`;
      const filePath = path.join(uploadDir, fileName);
      fs.writeFileSync(filePath, file.buffer);

      const resultat = await this.gererPiecesUseCase.marquerPiece({
        schoolId,
        onboardingId,
        code,
        received: true,
        receivedById: req.user!.userId,
        fileKey: filePath,
      });

      res.json({ success: true, data: { ...resultat, fileKey: filePath, fileName } });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v2/eleve-onboarding/:id/pieces/:code/file (Stream sécurisé sans URL publique)
  telechargerPiece = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const onboardingId = String(req.params['id']);
      const code = String(req.params['code']);

      const completude = await this.gererPiecesUseCase.consulterCompletude(schoolId, onboardingId);
      const doc = completude.documents.find((d) => d.code === code);

      if (!doc || !doc.fileKey || !fs.existsSync(doc.fileKey)) {
        res.status(404).json({ success: false, message: 'Document introuvable ou non téléversé' });
        return;
      }

      const ext = path.extname(doc.fileKey).toLowerCase();
      let contentType = 'application/octet-stream';
      if (ext === '.pdf') contentType = 'application/pdf';
      else if (ext === '.png') contentType = 'image/png';
      else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.webp') contentType = 'image/webp';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${code}_${path.basename(doc.fileKey)}"`);
      fs.createReadStream(doc.fileKey).pipe(res);
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v2/eleve-onboarding/:id/fiche-pdf
  exporterFichePdf = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const onboardingId = String(req.params['id']);
      const baseUrl = `${req.protocol}://${req.get('host')}`;

      const { buffer, filename } = await this.genererFichePdfUseCase.execute({
        schoolId,
        onboardingId,
        baseUrl,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  };

  // POST /api/v2/eleve-onboarding/bulk-validate
  validerLot = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const validatedById = req.user!.userId;
      const validatorRole = req.user!.role;
      const { onboardingIds } = req.body as { onboardingIds: string[] };

      const bilan = await this.validerLotUseCase.execute({
        schoolId,
        onboardingIds,
        validatedById,
        validatorRole,
      });

      res.json({ success: true, data: bilan });
    } catch (err) {
      next(err);
    }
  };
}
