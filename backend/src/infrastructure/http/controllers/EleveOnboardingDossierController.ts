/**
 * INFRASTRUCTURE — Contrôleur HTTP pour le Dossier V2 des élèves
 * (Pièces justificatives, suggestions de classes, validation par lot, fiche PDF).
 *
 * Scindé pour respecter le principe Single Responsibility et le plafond de 500 lignes.
 */
import type { Request, Response, NextFunction } from 'express';
import type { GererPiecesDossierUseCase } from '@application/eleveOnboarding/GererPiecesDossierUseCase';
import type { SuggererClassesDossierUseCase } from '@application/eleveOnboarding/SuggererClassesDossierUseCase';
import type { GenererFicheInscriptionPdfUseCase } from '@application/eleveOnboarding/GenererFicheInscriptionPdfUseCase';
import type { ValiderLotOnboardingUseCase } from '@application/eleveOnboarding/ValiderLotOnboardingUseCase';
import type { FileStoragePort } from '@domain/ports/services/FileStoragePort';
import {
  FILE_DOMAIN_POLICIES,
  buildScopedStorageKey,
  validateUploadedFileForDomain,
} from '@domain/services/storage/fileStorageValidation';
import {
  resolveScopedStorageKeyOrRespond,
  respondFileStorageValidationError,
  sendStoredFileResponse,
} from '../helpers/fileStorageHttpHelper';

export class EleveOnboardingDossierController {
  constructor(
    private readonly gererPiecesUseCase: GererPiecesDossierUseCase,
    private readonly suggererClassesUseCase: SuggererClassesDossierUseCase,
    private readonly genererFichePdfUseCase: GenererFicheInscriptionPdfUseCase,
    private readonly validerLotUseCase: ValiderLotOnboardingUseCase,
    private readonly fileStorage: FileStoragePort,
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

      if (file.size > FILE_DOMAIN_POLICIES['enrollment-pieces'].maxBytes) {
        res.status(400).json({ success: false, message: 'Fichier trop volumineux (maximum 5 Mo)' });
        return;
      }

      const validated = validateUploadedFileForDomain({
        domain: 'enrollment-pieces',
        buffer: file.buffer,
        originalName: file.originalname,
        declaredMime: file.mimetype,
      });

      const fileKey = buildScopedStorageKey({
        schoolId,
        domain: 'enrollment-pieces',
        extension: validated.extension,
      });

      await this.fileStorage.put(fileKey, file.buffer, validated.mimeType, {
        originalName: validated.originalName,
        onboardingId,
        pieceCode: code,
        uploadedBy: req.user!.userId,
      });

      const resultat = await this.gererPiecesUseCase.marquerPiece({
        schoolId,
        onboardingId,
        code,
        received: true,
        receivedById: req.user!.userId,
        fileKey,
      });

      res.json({ success: true, data: { ...resultat, fileKey, fileName: validated.originalName } });
    } catch (err) {
      if (
        respondFileStorageValidationError(res, err, {
          invalidFormatMessage: 'Format non supporté. Formats acceptés : JPG, PNG, WEBP ou PDF',
          tooLargeMessage: 'Fichier trop volumineux (maximum 5 Mo)',
        })
      ) {
        return;
      }
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

      if (!doc || !doc.fileKey) {
        res.status(404).json({ success: false, message: 'Document introuvable ou non téléversé' });
        return;
      }

      const validKey = resolveScopedStorageKeyOrRespond(
        res,
        doc.fileKey,
        schoolId,
        'Document introuvable ou expiré (fichier antérieur non conservé).',
      );
      if (!validKey) return;

      const stored = await this.fileStorage.get(validKey);
      if (!stored) {
        res.status(404).json({ success: false, message: 'Document introuvable ou expiré' });
        return;
      }

      const ext = validKey.slice(validKey.lastIndexOf('.')).toLowerCase();
      let contentType = stored.contentType ?? 'application/octet-stream';
      if (contentType === 'application/octet-stream') {
        if (ext === '.pdf') contentType = 'application/pdf';
        else if (ext === '.png') contentType = 'image/png';
        else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
        else if (ext === '.webp') contentType = 'image/webp';
      }

      const filename = stored.metadata?.originalName ?? `${code}${ext}`;
      sendStoredFileResponse(res, { buffer: stored.buffer, contentType, filename, disposition: 'inline' });
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
