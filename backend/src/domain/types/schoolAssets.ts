/**
 * DOMAIN LAYER — Types et limites des médias officiels du kit d'identité d'établissement
 * (logo, armoiries, cachet, signatures). Stockage assuré par le port unique FileStoragePort.
 */

export type SchoolAssetKind =
  | 'logo'
  | 'coatOfArms'
  | 'stamp'
  | 'principalSignature'
  | 'censorSignature';

export interface ValidatedSchoolAsset {
  assetKey: string;
  mimeType: 'image/png' | 'image/jpeg';
  byteSize: number;
  width: number;
  height: number;
}

export const MAX_SCHOOL_ASSET_BYTES = 300 * 1024; // 300 Ko
export const MAX_SCHOOL_ASSET_DIMENSION = 1200; // 1200×1200 px
