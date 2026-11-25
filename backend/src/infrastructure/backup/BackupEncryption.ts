/**
 * UTILITAIRE — Chiffrement au repos des exports offsite (Couche 3, PLAN_IMPLEMENTATION_BACKUP.md
 * §3.2). AES-256-GCM : les exports contiennent des données personnelles sensibles (élèves,
 * parents, paiements), jamais envoyés en clair vers un stockage tiers.
 *
 * Clé attendue dans BACKUP_ENCRYPTION_KEY — 32 octets encodés en base64. Génération recommandée :
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 * Perdre cette clé rend tous les exports déjà envoyés définitivement illisibles — la conserver
 * dans un gestionnaire de mots de passe séparé du repo et de l'environnement de déploiement seul.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHME = 'aes-256-gcm';
const TAILLE_IV = 12; // taille recommandée pour GCM

function cleDechiffrement(): Buffer {
  const cle = process.env.BACKUP_ENCRYPTION_KEY;
  if (!cle) throw new Error('BACKUP_ENCRYPTION_KEY non configurée — export offsite impossible sans clé de chiffrement.');
  const buf = Buffer.from(cle, 'base64');
  if (buf.length !== 32) throw new Error('BACKUP_ENCRYPTION_KEY doit décoder en exactement 32 octets (AES-256).');
  return buf;
}

/** Format du fichier chiffré : [iv (12o)] [authTag (16o)] [ciphertext]. */
export function chiffrerBuffer(clair: Buffer): Buffer {
  const cle = cleDechiffrement();
  const iv = randomBytes(TAILLE_IV);
  const cipher = createCipheriv(ALGORITHME, cle, iv);
  const chiffre = Buffer.concat([cipher.update(clair), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, chiffre]);
}

export function dechiffrerBuffer(enveloppe: Buffer): Buffer {
  const cle = cleDechiffrement();
  const iv = enveloppe.subarray(0, TAILLE_IV);
  const authTag = enveloppe.subarray(TAILLE_IV, TAILLE_IV + 16);
  const chiffre = enveloppe.subarray(TAILLE_IV + 16);
  const decipher = createDecipheriv(ALGORITHME, cle, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(chiffre), decipher.final()]);
}
