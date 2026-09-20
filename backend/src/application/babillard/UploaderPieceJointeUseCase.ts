/**
 * APPLICATION LAYER — UploaderPieceJointeUseCase
 * Upload sécurisé de pièces jointes avec contrôle par signature binaire (magic bytes).
 */

import path from 'path';
import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import type { PieceJointe } from '../../domain/entities/Publication';
import { peutPublierBabillard } from '../../domain/rules/BabillardPermissionRules';
import type { UtilisateurContexte } from '../../domain/rules/BabillardVisibilityRules';

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
  private readonly UPLOAD_BASE_DIR = path.resolve(process.cwd(), 'uploads');
  private readonly MAX_SIZE = 10 * 1024 * 1024; // 10 Mo

  async execute(cmd: UploadPieceJointeCommande): Promise<PieceJointe> {
    if (!peutPublierBabillard(cmd.user)) {
      throw new Error('FORBIDDEN_UPLOAD_ATTACHMENT');
    }

    if (!cmd.buffer || cmd.buffer.length === 0) {
      throw new Error('EMPTY_FILE');
    }

    if (cmd.size > this.MAX_SIZE || cmd.buffer.length > this.MAX_SIZE) {
      throw new Error('FILE_TOO_LARGE');
    }

    // Contrôle strict par signature binaire (magic bytes)
    const mimeDetecte = this.detecterMimeMagicBytes(cmd.buffer);
    if (!mimeDetecte) {
      throw new Error('INVALID_FILE_SIGNATURE');
    }

    let nbPages: number | null = null;
    let ext = '.bin';

    if (mimeDetecte === 'application/pdf') {
      ext = '.pdf';
      try {
        const pdfDoc = await PDFDocument.load(cmd.buffer, { ignoreEncryption: true });
        nbPages = pdfDoc.getPageCount();
      } catch {
        nbPages = 1;
      }
    } else if (mimeDetecte === 'image/png') {
      ext = '.png';
    } else if (mimeDetecte === 'image/jpeg') {
      ext = '.jpg';
    } else if (mimeDetecte === 'image/webp') {
      ext = '.webp';
    }

    const fileId = `pj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const publicationFolder = cmd.publicationId ?? 'temp';
    const targetDir = path.join(
      this.UPLOAD_BASE_DIR,
      'schools',
      cmd.user.schoolId,
      'babillard',
      publicationFolder
    );

    fs.mkdirSync(targetDir, { recursive: true });
    const fileName = `${fileId}${ext}`;
    const fullPath = path.join(targetDir, fileName);
    fs.writeFileSync(fullPath, cmd.buffer);

    // Clé de stockage relative sécurisée
    const cleStockage = path.join('schools', cmd.user.schoolId, 'babillard', publicationFolder, fileName);

    return {
      id: fileId,
      nomOriginal: cmd.originalname,
      mime: mimeDetecte,
      taille: cmd.buffer.length,
      cleStockage,
      nbPages,
      ordre: cmd.ordre ?? 0,
      texteAlternatif: cmd.texteAlternatif ?? null,
    };
  }

  private detecterMimeMagicBytes(buf: Buffer): string | null {
    if (buf.length < 4) return null;

    // PDF : %PDF- (0x25 0x50 0x44 0x46)
    if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
      return 'application/pdf';
    }

    // PNG : 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    if (
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4E &&
      buf[3] === 0x47 &&
      buf[4] === 0x0D &&
      buf[5] === 0x0A &&
      buf[6] === 0x1A &&
      buf[7] === 0x0A
    ) {
      return 'image/png';
    }

    // JPEG : 0xFF 0xD8 0xFF
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
      return 'image/jpeg';
    }

    // WebP : RIFF .... WEBP
    if (
      buf.length >= 12 &&
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && // RIFF
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50  // WEBP
    ) {
      return 'image/webp';
    }

    return null;
  }
}
