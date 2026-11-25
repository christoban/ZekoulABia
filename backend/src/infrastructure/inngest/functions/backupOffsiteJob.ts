/**
 * INFRASTRUCTURE LAYER — Export offsite nocturne chiffré (Couche 3, PLAN_IMPLEMENTATION_BACKUP.md
 * §3). Indépendant de Neon : un `pg_dump` réel (pas l'export JSON applicatif de schoolBackup.ts,
 * qui reste un outil séparé à l'usage du MasterAdmin — voir en-tête de ce fichier historique),
 * chiffré au repos, envoyé vers Cloudflare R2, avec rotation dégressive après chaque export réussi.
 *
 * Nécessite `pg_dump` sur le PATH (fourni par `postgresql-client` dans le Dockerfile de
 * production) et les variables d'environnement R2_* + BACKUP_ENCRYPTION_KEY — voir
 * OffsiteBackupStorage.ts et backupEncryption.ts pour le détail. Sans ces variables, le job
 * échoue explicitement (et Inngest retentera selon sa politique par défaut) plutôt que de
 * s'exécuter silencieusement dans le vide.
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { inngest } from '../client/index.ts';
import { chiffrerBuffer } from '../../backup/BackupEncryption';
import { calculerClesAConserver } from '../../backup/BackupRetentionPolicy';
import { televerserObjet, listerObjets, supprimerObjet } from '../../services/storage/OffsiteBackupStorage.ts';

const execFileAsync = promisify(execFile);
const PREFIXE_R2 = 'db-exports/';

/**
 * `DATABASE_URL` (format Prisma) porte `?schema=public` dans la query string — un paramètre
 * propre à Prisma, pas un paramètre de connexion libpq standard. `pg_dump` le reçoit tel quel et
 * le rejette ("paramètre de la requête URI invalide"). On l'extrait pour le repasser comme
 * option `--schema` séparée, et on nettoie l'URI du reste.
 */
function preparerConnexionPgDump(databaseUrl: string): { uri: string; args: string[] } {
  const url = new URL(databaseUrl);
  const schema = url.searchParams.get('schema');
  url.searchParams.delete('schema');
  return { uri: url.toString(), args: schema ? ['--schema', schema] : [] };
}

export const exporterOffsiteNocturne = inngest.createFunction(
  { id: 'export-offsite-nocturne', name: 'Export offsite chiffré (Couche 3)', triggers: [{ cron: '0 1 * * *' }] },
  async ({ step }) => {
    const cheminDump = await step.run('pg-dump', async () => {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) throw new Error('DATABASE_URL non configurée — export offsite impossible.');
      const chemin = join(tmpdir(), `zekoulabia-export-${Date.now()}.dump`);
      const { uri, args: argsSchema } = preparerConnexionPgDump(databaseUrl);
      // Format custom (-Fc) : déjà compressé par pg_dump lui-même, restorable via pg_restore,
      // pas besoin d'une étape de compression manuelle séparée.
      await execFileAsync('pg_dump', [
        uri, ...argsSchema, '--format=custom', '--no-owner', '--no-privileges', '--file', chemin,
      ]);
      return chemin;
    });

    const cleDistante = await step.run('chiffrer-et-televerser', async () => {
      const contenu = await readFile(cheminDump);
      const chiffre = chiffrerBuffer(contenu);
      const date = new Date().toISOString().slice(0, 10);
      const cle = `${PREFIXE_R2}${date}.dump.enc`;
      await televerserObjet(cle, chiffre);
      await unlink(cheminDump).catch(() => {});
      return cle;
    });

    await step.run('appliquer-rotation-degressive', async () => {
      const objets = await listerObjets(PREFIXE_R2);
      const aConserver = calculerClesAConserver(
        objets.map((o) => ({ cle: o.cle, derniereModification: o.derniereModification })),
      );
      for (const o of objets) {
        if (!aConserver.has(o.cle)) await supprimerObjet(o.cle);
      }
    });

    return { exporte: true, cle: cleDistante };
  },
);
