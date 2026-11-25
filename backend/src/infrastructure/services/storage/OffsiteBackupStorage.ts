/**
 * INFRASTRUCTURE LAYER — Stockage offsite indépendant de Neon (Couche 3, PLAN_IMPLEMENTATION_
 * BACKUP.md §3.2). Cloudflare R2, compatible S3 — le client `@aws-sdk/client-s3` fonctionne tel
 * quel en pointant sur l'endpoint R2, sans dépendance au SDK Cloudflare spécifique.
 *
 * Variables d'environnement requises :
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 * Absentes tant que le compte Cloudflare R2 n'est pas créé — le job d'export (backupOffsiteJob.ts)
 * échoue explicitement plutôt que de s'exécuter silencieusement dans le vide.
 */
import {
  S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand, GetObjectCommand,
} from '@aws-sdk/client-s3';

function configurationR2() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      'Configuration R2 incomplète — R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY et ' +
      'R2_BUCKET_NAME sont requis (créer le bucket + les clés API sur le dashboard Cloudflare).'
    );
  }
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function client(): S3Client {
  const { accountId, accessKeyId, secretAccessKey } = configurationR2();
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function televerserObjet(cle: string, contenu: Buffer): Promise<void> {
  const { bucket } = configurationR2();
  await client().send(new PutObjectCommand({ Bucket: bucket, Key: cle, Body: contenu }));
}

export interface ObjetStocke {
  cle: string;
  derniereModification: Date;
  tailleOctets: number;
}

export async function listerObjets(prefixe: string): Promise<ObjetStocke[]> {
  const { bucket } = configurationR2();
  const objets: ObjetStocke[] = [];
  let continuationToken: string | undefined;
  do {
    const reponse = await client().send(new ListObjectsV2Command({
      Bucket: bucket, Prefix: prefixe, ContinuationToken: continuationToken,
    }));
    for (const item of reponse.Contents ?? []) {
      if (item.Key && item.LastModified) {
        objets.push({ cle: item.Key, derniereModification: item.LastModified, tailleOctets: item.Size ?? 0 });
      }
    }
    continuationToken = reponse.IsTruncated ? reponse.NextContinuationToken : undefined;
  } while (continuationToken);
  return objets;
}

export async function supprimerObjet(cle: string): Promise<void> {
  const { bucket } = configurationR2();
  await client().send(new DeleteObjectCommand({ Bucket: bucket, Key: cle }));
}

export async function telechargerObjet(cle: string): Promise<Buffer> {
  const { bucket } = configurationR2();
  const reponse = await client().send(new GetObjectCommand({ Bucket: bucket, Key: cle }));
  const chunks: Buffer[] = [];
  for await (const chunk of reponse.Body as AsyncIterable<Buffer>) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
