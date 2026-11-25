/**
 * APPLICATION LAYER — UploaderPieceJointeUseCase
 * Upload sécurisé de pièces jointes via FileStoragePort avec validation magic bytes.
 */

import { PDFDocument } from 'pdf-lib';
import type { PieceJointe } from '../../domain/entities/Publication';
import { peutPublierBabillard } from '../../domain/rules/BabillardPermissionRules';
import type { UtilisateurContexte } from '../../domain/rules/BabillardVisibilityRules';
import type { FileStoragePort } from '../../domain/ports/services/FileStoragePort';
import { FileStorageValidationError } from '../../domain/errors/FileStorageValidationError';
import {
  FILE_DOMAIN_POLICIES,
  buildScopedStorageKey,
  validateUploadedFileForDomain,
} from '../../domain/services/storage/fileStorageValidation';

export interface UploadPieceJointeCommande {
  user: UtilisateurContexte;
  publicationId?: string;
  originalname: string;
  buffer: Buffer;
  size: number;
  mimetype: string;
  ordre?: number;
  texteAlternatif?: string;
}

export class UploaderPieceJointeUseCase {
  constructor(private readonly fileStorage: FileStoragePort) {}

  async execute(cmd: UploadPieceJointeCommande): Promise<PieceJointe> {
    if (!peutPublierBabillard(cmd.user)) {
      throw new Error('FORBIDDEN_UPLOAD_ATTACHMENT');
    }

    const maxBytes = FILE_DOMAIN_POLICIES.babillard.maxBytes;
    if (cmd.size > maxBytes) {
      throw new FileStorageValidationError(
        'FILE_TOO_LARGE',
        `Fichier trop volumineux (> ${Math.round(maxBytes / (1024 * 1024))} Mo).`,
      );
    }

    const validated = validateUploadedFileForDomain({
      domain: 'babillard',
      buffer: cmd.buffer,
      originalName: cmd.originalname,
      declaredMime: cmd.mimetype,
    });

    let nbPages: number | null = null;
    if (validated.mimeType === 'application/pdf') {
      try {
        const pdfDoc = await PDFDocument.load(cmd.buffer, { ignoreEncryption: true });
        nbPages = pdfDoc.getPageCount();
      } catch {
        nbPages = 1;
      }
    }

    const fileId = crypto.randomUUID();
    const cleStockage = buildScopedStorageKey({
      schoolId: cmd.user.schoolId,
      domain: 'babillard',
      extension: validated.extension,
      fileId,
    });

    await this.fileStorage.put(cleStockage, cmd.buffer, validated.mimeType, {
      originalName: validated.originalName,
      publicationId: cmd.publicationId ?? 'temp',
      uploadedBy: cmd.user.userId,
    });

    return {
      id: fileId,
      nomOriginal: validated.originalName,
      mime: validated.mimeType,
      taille: validated.size,
      cleStockage,
      nbPages,
      ordre: cmd.ordre ?? 0,
      texteAlternatif: cmd.texteAlternatif ?? null,
    };
  }
}
