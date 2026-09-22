/**
 * ADMIN BOOTSTRAP — création one-shot du compte Master (premier déploiement).
 *
 * Sécurisé par design :
 *  - idempotent : refuse de s'exécuter si un MasterUser existe déjà (jamais de reset à volonté)
 *  - aucun secret dans le code : email lu depuis MASTER_BOOTSTRAP_EMAIL, mot de passe depuis
 *    MASTER_BOOTSTRAP_PASSWORD (ou généré aléatoirement et affiché UNE seule fois)
 *  - le mot de passe n'est jamais écrit dans les logs sauf au moment de la création
 *
 * Usage : bun scripts/bootstrap-master.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required (voir backend/.env.example)`);
  }
  return value;
}

async function bootstrapMaster() {
  const email = process.env.MASTER_BOOTSTRAP_EMAIL?.trim() ?? requireEnv("MASTER_BOOTSTRAP_EMAIL");

  // One-shot : refuser si le Master existe déjà — jamais de réinitialisation silencieuse.
  const existing = await prisma.masterUser.findUnique({ where: { email } });
  if (existing) {
    console.error("❌ Master account already exists. Bootstrap refused.");
    console.error("   Utilise la procédure de récupération prévue, pas ce script.");
    await prisma.$disconnect();
    process.exit(1);
  }

  // Mot de passe : même rigueur que les users (PasswordPolicy: 12 chars + maj + min + chiffre + spécial)
  const rawEnvPwd = process.env.MASTER_BOOTSTRAP_PASSWORD?.trim();
  if (rawEnvPwd) {
    const err = (() => {
      const rules = [
        { test: (p: string) => p.length >= 12, msg: 'Au moins 12 caractères' },
        { test: (p: string) => /[A-Z]/.test(p), msg: 'Au moins une lettre majuscule' },
        { test: (p: string) => /[a-z]/.test(p), msg: 'Au moins une lettre minuscule' },
        { test: (p: string) => /[0-9]/.test(p), msg: 'Au moins un chiffre' },
        { test: (p: string) => /[@$!%*?&#^()_+=.\-]/.test(p), msg: 'Au moins un caractère spécial (@$!%*?&#^()_+=.-)' },
      ];
      const errs = rules.filter(r => !r.test(rawEnvPwd)).map(r => r.msg);
      return errs.length ? errs.join(' · ') : null;
    })();
    if (err) throw new Error(`MASTER_BOOTSTRAP_PASSWORD invalide: ${err}`);
  }
  function genererMotDePasseConforme(): string {
    const up = 'ABCDEFGHJKLMNPQRSTUVWXYZ', low = 'abcdefghijkmnpqrstuvwxyz', nums = '23456789', specs = '@$!%*?&#';
    const all = up + low + nums + specs;
    const pick = (s: string) => s[crypto.randomInt(s.length)];
    const arr = [pick(up), pick(low), pick(nums), pick(specs)];
    for (let i = 4; i < 16; i++) arr.push(pick(all));
    for (let i = arr.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr.join('');
  }
  const password = rawEnvPwd || genererMotDePasseConforme();
  const passwordHash = await bcrypt.hash(password, 12);

  const master = await prisma.masterUser.create({
    data: {
      email,
      passwordHash,
      name: "Ndzana Christophe",
      role: "SUPER_ADMIN",
      isSuperAdmin: true,
      isActive: true,
      mfaEnabled: false,      // MFA désactivée → à re-setup via l'interface
      mfaSecret: null,
      mfaTempSecret: null,
      mfaRecoveryCodeHashes: [],
    },
  });

  console.log("✅ MasterUser créé avec succès.");
  console.log("─────────────────────────────────");
  console.log(`📧 Email : ${master.email}`);
  if (!process.env.MASTER_BOOTSTRAP_PASSWORD) {
    console.log(`🔑 Mot de passe temporaire : ${password}`);
  }
  console.log(`🆔 ID    : ${master.id}`);
  console.log("─────────────────────────────────");
  console.log("⚠️  IMPORTANT : change le mot de passe dès la première connexion.");
  console.log("⚠️  IMPORTANT : re-active la MFA dans /master/security.");

  await prisma.$disconnect();
}

bootstrapMaster().catch((err) => {
  console.error("❌ Erreur lors du bootstrap :", err instanceof Error ? err.message : err);
  process.exit(1);
});