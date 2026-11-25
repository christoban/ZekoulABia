/**
 * @types/archiver@7 décrit l'ancienne API factory (`archiver('zip', options)`), incompatible
 * avec archiver@8 réellement installé (ESM pur, classes nommées, aucun .d.ts fourni par le
 * package lui-même). Complète les types manquants pour la seule surface utilisée ici
 * (ReportCardController.exporterZip) plutôt que de dépendre d'un cast `as any`.
 */
declare module 'archiver' {
  import type { Transform } from 'stream';

  interface ArchiverOptions {
    zlib?: { level?: number };
  }

  interface EntryData {
    name: string;
  }

  class Archiver extends Transform {
    constructor(options?: ArchiverOptions);
    append(source: Buffer | NodeJS.ReadableStream | string, data: EntryData): this;
    finalize(): Promise<void>;
  }

  class ZipArchive extends Archiver {}

  export { Archiver, ZipArchive };
}
