/**
 * DOMAIN LAYER — Port de stockage validé des médias d'identité d'établissement
 * (Logo, blason/armoiries, cachet, signature chef d'établissement / censeur).
 */
export type SchoolAssetKind =
  | 'logo'
  | 'coatOfArms'
  | 'stamp'
  | 'principalSignature'
  | 'censorSignature';

export const MAX_SCHOOL_ASSET_BYTES = 300 * 1024;
export const MAX_SCHOOL_ASSET_DIMENSION = 1200;

export interface ValidatedSchoolAsset {
  assetKey: string;
  mimeType: 'image/png' | 'image/jpeg';
  byteSize: number;
  width: number;
  height: number;
}

export interface SchoolAssetStoragePort {
  validateAndStoreAsset(params: {
    schoolId: string;
    kind: SchoolAssetKind;
    data: Buffer | string;
  }): Promise<ValidatedSchoolAsset>;

  readAssetBuffer(assetKey: string | null | undefined): Promise<Buffer | null>;

  deleteAsset(assetKey: string | null | undefined): Promise<void>;
}

