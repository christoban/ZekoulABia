import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { SchoolAssetValidationError } from '@domain/errors/SchoolAssetValidationError';
import {
  MAX_SCHOOL_ASSET_BYTES,
  MAX_SCHOOL_ASSET_DIMENSION,
  type SchoolAssetKind,
  type SchoolAssetStoragePort,
  type ValidatedSchoolAsset,
} from '@domain/ports/services/SchoolAssetStoragePort';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

export function inspectImageBuffer(buf: Buffer): { mimeType: 'image/png' | 'image/jpeg'; width: number; height: number } {
  if (buf.length === 0) {
    throw new SchoolAssetValidationError('Fichier image vide.');
  }
  if (buf.length > MAX_SCHOOL_ASSET_BYTES) {
    throw new SchoolAssetValidationError(
      `Taille d'image (${Math.ceil(buf.length / 1024)} Ko) supérieure au plafond autorisé de 300 Ko.`,
    );
  }

  if (buf.length >= 24 && buf.subarray(0, 8).equals(PNG_MAGIC) && buf.subarray(12, 16).toString('ascii') === 'IHDR') {
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    if (width < 1 || height < 1 || width > MAX_SCHOOL_ASSET_DIMENSION || height > MAX_SCHOOL_ASSET_DIMENSION) {
      throw new SchoolAssetValidationError(
        `Dimensions PNG invalides (${width}×${height} px) : maximum autorisé 1200×1200 px.`,
      );
    }
    return { mimeType: 'image/png', width, height };
  }

  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    let pos = 2;
    while (pos + 3 < buf.length) {
      if (buf[pos] !== 0xff) break;
      const marker = buf[pos + 1]!;
      pos += 2;
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (pos + 2 > buf.length) break;
      const segLen = buf.readUInt16BE(pos);
      if (segLen < 2 || pos + segLen > buf.length) break;
      if (SOF_MARKERS.has(marker)) {
        if (pos + 7 > buf.length) break;
        const height = buf.readUInt16BE(pos + 3);
        const width = buf.readUInt16BE(pos + 5);
        if (width < 1 || height < 1 || width > MAX_SCHOOL_ASSET_DIMENSION || height > MAX_SCHOOL_ASSET_DIMENSION) {
          throw new SchoolAssetValidationError(
            `Dimensions JPEG invalides (${width}×${height} px) : maximum autorisé 1200×1200 px.`,
          );
        }
        return { mimeType: 'image/jpeg', width, height };
      }
      pos += segLen;
    }
    throw new SchoolAssetValidationError('En-tête JPEG corrompu ou dimensions introuvables.');
  }

  throw new SchoolAssetValidationError('Format image non autorisé : seuls PNG et JPEG valides sont acceptés.');
}

function decodeInputBuffer(data: Buffer | string): Buffer {
  if (Buffer.isBuffer(data)) return data;
  const trimmed = data.trim();
  const m = /^data:(image\/png|image\/jpeg|image\/jpg);base64,([A-Za-z0-9+/=\s]+)$/i.exec(trimmed);
  if (!m) {
    throw new SchoolAssetValidationError('Source image invalide : fournir un Buffer PNG/JPEG ou un data-URI base64 PNG/JPEG.');
  }
  return Buffer.from(m[2]!.replace(/\s+/g, ''), 'base64');
}

export class LocalAndDataUriSchoolAssetStorageAdapter implements SchoolAssetStoragePort {
  private readonly baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = path.resolve(
      baseDir ?? (process.env.SCHOOL_ASSET_DIR || path.join(process.cwd(), 'storage', 'school-assets')),
    );
  }

  async validateAndStoreAsset(params: {
    schoolId: string;
    kind: SchoolAssetKind;
    data: Buffer | string;
  }): Promise<ValidatedSchoolAsset> {
    const safeSchoolId = params.schoolId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeSchoolId) throw new SchoolAssetValidationError('schoolId invalide.');
    const buf = decodeInputBuffer(params.data);
    const info = inspectImageBuffer(buf);
    const ext = info.mimeType === 'image/png' ? 'png' : 'jpg';
    const digest = createHash('sha256').update(buf).digest('hex').slice(0, 12);
    const relKey = `school-assets/${safeSchoolId}/${params.kind}-${digest}.${ext}`;
    const targetPath = path.join(this.baseDir, safeSchoolId, `${params.kind}-${digest}.${ext}`);

    mkdirSync(path.dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, buf);

    return {
      assetKey: relKey,
      mimeType: info.mimeType,
      byteSize: buf.length,
      width: info.width,
      height: info.height,
    };
  }

  private resolveLocalPath(assetKey: string): string | null {
    const clean = assetKey.replace(/^school-assets\//, '');
    const resolved = path.resolve(this.baseDir, clean);
    if (!resolved.startsWith(this.baseDir + path.sep) && resolved !== this.baseDir) {
      return null;
    }
    return resolved;
  }

  async readAssetBuffer(assetKey: string | null | undefined): Promise<Buffer | null> {
    if (!assetKey) return null;
    const trimmed = assetKey.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('data:image/')) {
      try {
        const buf = decodeInputBuffer(trimmed);
        inspectImageBuffer(buf);
        return buf;
      } catch {
        return null;
      }
    }
    if (!trimmed.startsWith('school-assets/')) return null;
    const full = this.resolveLocalPath(trimmed);
    if (!full || !existsSync(full)) return null;
    return readFileSync(full);
  }

  async deleteAsset(assetKey: string | null | undefined): Promise<void> {
    if (!assetKey || !assetKey.startsWith('school-assets/')) return;
    const full = this.resolveLocalPath(assetKey);
    if (full && existsSync(full)) {
      unlinkSync(full);
    }
  }
}

