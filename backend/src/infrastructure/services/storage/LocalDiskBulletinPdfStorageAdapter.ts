/**
 * INFRASTRUCTURE LAYER — Adaptateur disque local pour BulletinPdfStoragePort
 *
 * Utilisé en développement et tests locaux (éphémère sur Railway sans volume persistant).
 */
import { mkdir, readFile, access, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  BulletinPdfStorageKeyInput,
  BulletinPdfStoragePort,
} from '@domain/ports/services/BulletinPdfStoragePort';

function sanitizeSegment(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9._-]/g, '_');
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    throw new Error(`Segment de clé de stockage invalide : "${raw}"`);
  }
  return cleaned;
}

export class LocalDiskBulletinPdfStorageAdapter implements BulletinPdfStoragePort {
  readonly driverName = 'local-disk';
  private readonly baseDir: string;

  constructor(baseDir?: string) {
    const configured = baseDir ?? process.env.BULLETIN_PDF_STORAGE_DIR;
    this.baseDir = path.resolve(configured || path.resolve(process.cwd(), 'storage', 'bulletins'));
  }

  buildStorageKey(input: BulletinPdfStorageKeyInput): string {
    const s = sanitizeSegment(input.schoolId);
    const p = sanitizeSegment(input.academicPeriodId);
    const b = sanitizeSegment(input.bulletinId);
    return path.posix.join('schools', s, 'periods', p, `${b}-v${input.templateVersion}.pdf`);
  }

  private resolveSafePath(key: string): string {
    const normalized = path.posix.normalize(key).replace(/^\/+/, '');
    if (normalized.startsWith('..') || path.isAbsolute(key)) {
      throw new Error(`Chemin de stockage interdit : "${key}"`);
    }
    const resolved = path.resolve(this.baseDir, normalized);
    if (!resolved.startsWith(this.baseDir + path.sep) && resolved !== this.baseDir) {
      throw new Error(`Tentative d'évasion hors du dossier de stockage : "${key}"`);
    }
    return resolved;
  }

  async storePdf(key: string, pdfBuffer: Buffer): Promise<string> {
    const targetPath = this.resolveSafePath(key);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, pdfBuffer);
    return key;
  }

  async readPdf(key: string): Promise<Buffer | null> {
    const targetPath = this.resolveSafePath(key);
    try {
      return await readFile(targetPath);
    } catch {
      return null;
    }
  }

  async exists(key: string): Promise<boolean> {
    const targetPath = this.resolveSafePath(key);
    try {
      await access(targetPath);
      return true;
    } catch {
      return false;
    }
  }
}
