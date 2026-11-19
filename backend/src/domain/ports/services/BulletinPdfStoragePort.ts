/**
 * DOMAIN LAYER — Port isolé de stockage des PDF scellés de bulletins
 *
 * Reste volontairement minimal et indépendant du fournisseur (disque local dev/test ou
 * stockage objet compatible S3 en production) afin d'être absorbé proprement par le chantier
 * dédié au stockage de fichiers qui suivra l'Étape 4.
 */
export interface BulletinPdfStorageKeyInput {
  schoolId: string;
  academicPeriodId: string;
  bulletinId: string;
  templateVersion: number;
}

export interface BulletinPdfStoragePort {
  readonly driverName: string;
  buildStorageKey(input: BulletinPdfStorageKeyInput): string;
  storePdf(key: string, pdfBuffer: Buffer): Promise<string>;
  readPdf(key: string): Promise<Buffer | null>;
  exists(key: string): Promise<boolean>;
}
