/**
 * APPLICATION LAYER — Moteur générique du catalogue d'actions de l'assistant IA (copilot).
 *
 * Extrait de `adminActionCatalog.ts` lors de l'extension du copilot aux rôles non-Admin
 * (chantier Copilot Unifié, Section 6.2) — un seul copilot, un seul catalogue combiné
 * (Principe 0.1 : « un seul copilot, pas deux systèmes parallèles »), chaque rôle apporte
 * ses propres entrées via son propre fichier `<role>ActionCatalog.ts`, toutes assemblées
 * en un seul tableau `ActionDefinition[]` passé à un unique `AssistantController`.
 *
 * Helpers de résolution nom → entité partagés ici parce qu'utiles à plusieurs rôles
 * (ex. resolveClass/resolveStudent servent aussi bien au catalogue Admin qu'Enseignant).
 * Les helpers propres à un domaine précis (ex. resolvePlanFrais, Finance) restent dans le
 * fichier de catalogue du rôle qui les utilise plutôt que d'être partagés ici.
 */
import { z } from 'zod';
import { tool, type Tool } from 'ai';
import type { PrismaClient } from '@prisma/client';
import type { StaffPermissionType } from '@domain/types/enums';

// ─── Contexte & contrats ─────────────────────────────────────────────────────

export interface ActionContext {
  schoolId: string;
  userId: string;
  role: string;
  prisma: PrismaClient;
}

export interface ActionExecuteResult {
  /** Résumé lisible affiché dans le chat, ex. « Classe "4e D" créée ». */
  resultLabel: string;
  /** Instantané nécessaire à une éventuelle annulation. */
  undoData?: Record<string, unknown>;
  /** Section du dashboard où le changement est visible (navigation auto + refresh). */
  section?: string;
  /** Entité touchée — sert au bus d'événements temps réel côté frontend. */
  entity?: string;
}

export interface ActionDefinition {
  name: string;
  description: string;
  destructive: boolean;
  /**
   * Permission STAFF requise, ou `null` pour une action inhérente au rôle ADMIN.
   * Ignoré si `allowedRoles` est renseigné (voir ce champ).
   */
  requiredPermission: StaffPermissionType | null;
  /**
   * Rôles autorisés à voir cette action. Omis = comportement historique du catalogue
   * Admin (ADMIN voit tout ; STAFF voit uniquement si `requiredPermission` correspond
   * à ses permissions). Renseigné = action scopée à CES rôles précisément, y compris
   * potentiellement à l'exclusion d'ADMIN — pertinent pour une action « mes classes »,
   * « mes notes », etc. qui n'a pas de sens hors du contexte personnel d'un enseignant,
   * parent ou élève connecté (`ctx.userId` désigne alors CE rôle, pas un administrateur
   * consultant les données de quelqu'un d'autre).
   */
  allowedRoles?: string[];
  /**
   * Regroupement thématique optionnel (ex. 'paiements', 'notes_bulletins') — sert
   * UNIQUEMENT à `selectRelevantActions` pour réduire le nombre d'outils transmis à
   * Groq sur un catalogue volumineux (voir ce helper). Une action sans `domain` est
   * toujours incluse, quel que soit le message — c'est le comportement par défaut
   * pour les catalogues déjà assez petits pour ne pas avoir besoin de ce filtrage.
   */
  domain?: string;
  inputSchema: z.ZodTypeAny;
  /** Résumé de ce qui sera perdu — obligatoire pour toute action destructive. */
  summarizeDestructive?: (input: any, ctx: ActionContext) => Promise<string>;
  execute: (input: any, ctx: ActionContext) => Promise<ActionExecuteResult>;
  /** Annulation d'une action non-destructive. Lève une erreur si non annulable. */
  undo: (params: any, undoData: any, ctx: ActionContext) => Promise<void>;
}

// ─── Helpers de résolution nom → entité, partagés entre catalogues de rôles ──

export const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export async function resolveClass(ctx: ActionContext, name: string): Promise<{ id: string; name: string }> {
  const classes = await ctx.prisma.class.findMany({
    where: { schoolId: ctx.schoolId },
    select: { id: true, name: true },
  });
  const target = norm(name);
  let matches = classes.filter((c) => norm(c.name) === target);
  if (matches.length === 0) {
    // tolérance : « 4eD » vs « 4e D »
    const compact = target.replace(/\s+/g, '');
    matches = classes.filter((c) => norm(c.name).replace(/\s+/g, '') === compact);
  }
  if (matches.length === 0) throw new Error(`Aucune classe nommée « ${name} » n'existe dans votre établissement.`);
  if (matches.length > 1) throw new Error(`Plusieurs classes correspondent à « ${name} ». Précisez le nom exact.`);
  return matches[0];
}

export async function resolveTeacher(ctx: ActionContext, name: string): Promise<{ id: string; name: string }> {
  const teachers = await ctx.prisma.user.findMany({
    where: { schoolId: ctx.schoolId, role: 'TEACHER' },
    select: { id: true, firstName: true, lastName: true },
  });
  const full = (t: { firstName: string | null; lastName: string | null }) =>
    `${t.firstName ?? ''} ${t.lastName ?? ''}`.trim();
  const target = norm(name);
  let matches = teachers.filter((t) => norm(full(t)) === target);
  if (matches.length === 0) {
    // recherche partielle : nom de famille ou inclusion
    matches = teachers.filter(
      (t) => norm(t.lastName ?? '') === target || norm(full(t)).includes(target),
    );
  }
  if (matches.length === 0) throw new Error(`Aucun enseignant nommé « ${name} » n'a été trouvé.`);
  if (matches.length > 1) throw new Error(`Plusieurs enseignants correspondent à « ${name} ». Précisez le nom complet.`);
  const m = matches[0];
  return { id: m.id, name: full(m) };
}

export async function resolveSubject(ctx: ActionContext, name: string): Promise<{ id: string; name: string }> {
  const subjects = await ctx.prisma.subject.findMany({
    where: { schoolId: ctx.schoolId },
    select: { id: true, name: true },
  });
  const target = norm(name);
  let matches = subjects.filter((s) => norm(s.name) === target);
  if (matches.length === 0) matches = subjects.filter((s) => norm(s.name).includes(target));
  if (matches.length === 0) throw new Error(`Aucune matière nommée « ${name} » n'existe dans votre établissement.`);
  if (matches.length > 1) throw new Error(`Plusieurs matières correspondent à « ${name} ». Précisez le nom exact.`);
  return matches[0];
}

/**
 * Résolution nom → élève. Les homonymes sont fréquents dans une école — si plusieurs
 * élèves correspondent, on ne devine JAMAIS (Principe 4) : on liste les candidats avec
 * leur classe et on demande de préciser, plutôt que d'agir sur le premier trouvé.
 * `className` (si fourni, ex. via le contexte de la commande) filtre la recherche.
 */
export async function resolveStudent(
  ctx: ActionContext,
  name: string,
  className?: string,
): Promise<{ id: string; name: string; className: string | null }> {
  const students = await ctx.prisma.user.findMany({
    where: { schoolId: ctx.schoolId, role: 'STUDENT' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      studentProfile: {
        select: {
          enrollmentsYearScoped: {
            where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
            select: { class: { select: { name: true } } },
            take: 1,
          },
        },
      },
    },
  });
  const full = (s: { firstName: string | null; lastName: string | null }) =>
    `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim();
  const classNameOf = (s: (typeof students)[number]): string | null =>
    s.studentProfile?.enrollmentsYearScoped?.[0]?.class?.name ?? null;
  const target = norm(name);
  let matches = students.filter((s) => norm(full(s)) === target);
  if (matches.length === 0) matches = students.filter((s) => norm(full(s)).includes(target));

  if (matches.length > 1 && className) {
    const classTarget = norm(className);
    const narrowed = matches.filter((s) => classNameOf(s) && norm(classNameOf(s)!) === classTarget);
    if (narrowed.length > 0) matches = narrowed;
  }

  if (matches.length === 0) throw new Error(`Aucun élève nommé « ${name} » n'a été trouvé.`);
  if (matches.length > 1) {
    const list = matches
      .slice(0, 6)
      .map((s) => `${full(s)} (${classNameOf(s) ?? 'sans classe'})`)
      .join(', ');
    throw new Error(`Plusieurs élèves nommés « ${name} » existent : ${list}. Précisez la classe.`);
  }
  const m = matches[0];
  return { id: m.id, name: full(m), className: classNameOf(m) };
}

export async function resolveCurrentAcademicYear(ctx: ActionContext): Promise<{ id: string; name: string }> {
  const year = await ctx.prisma.academicYear.findFirst({
    where: { schoolId: ctx.schoolId, isCurrent: true },
    select: { id: true, name: true },
  });
  if (!year) throw new Error("Aucune année scolaire courante n'est configurée pour cet établissement.");
  return year;
}

export async function resolveCurrentPeriod(ctx: ActionContext): Promise<{ id: string; name: string }> {
  const period = await ctx.prisma.academicPeriod.findFirst({
    where: { academicYear: { schoolId: ctx.schoolId, isCurrent: true }, isCurrent: true },
    select: { id: true, name: true },
  });
  if (!period) throw new Error("Aucune période courante n'est configurée pour cet établissement.");
  return period;
}

export async function resolveCurrentSequence(ctx: ActionContext): Promise<{ id: string; name: string }> {
  const sequence = await ctx.prisma.academicSequence.findFirst({
    where: { schoolId: ctx.schoolId, isCurrent: true },
    select: { id: true, name: true },
  });
  if (!sequence) throw new Error("Aucune séquence courante n'est configurée pour cet établissement.");
  return sequence;
}

/** Moyenne pondérée par coefficient, par élève, pour une classe et une séquence données. */
export async function calculerMoyennesClasseSequence(
  ctx: ActionContext,
  classId: string,
  sequenceId: string,
): Promise<Map<string, number>> {
  // Résolution hasCoefficient au niveau classe (même mécanisme que le moteur)
  let hasCoefficientBySubject = true;
  try {
    const [school, classe] = await Promise.all([
      ctx.prisma.school.findUnique({ where: { id: ctx.schoolId }, select: { subsystem: true } }),
      ctx.prisma.class.findUnique({ where: { id: classId }, select: { level: true } }),
    ]);
    if (school && classe) {
      const { resolveHasCoefficientForClass } = await import('@domain/subsystems/SubsystemDefaults');
      hasCoefficientBySubject = resolveHasCoefficientForClass(school as any, (classe as any).level ?? null);
    }
  } catch {
    // best-effort fallback
  }

  const grades = await ctx.prisma.grade.findMany({
    where: { classId, sequenceId, schoolId: ctx.schoolId, sequenceAverage: { not: null } },
    select: { studentId: true, sequenceAverage: true, coefficient: true, isAbsentGrade: true },
  });
  const parStudent = new Map<string, { somme: number; poids: number }>();
  for (const g of grades) {
    if ((g as any).isAbsentGrade) continue;
    const coeff = hasCoefficientBySubject ? g.coefficient : 1;
    const cur = parStudent.get(g.studentId) ?? { somme: 0, poids: 0 };
    cur.somme += (g.sequenceAverage ?? 0) * coeff;
    cur.poids += coeff;
    parStudent.set(g.studentId, cur);
  }
  const moyennes = new Map<string, number>();
  for (const [studentId, { somme, poids }] of parStudent) {
    if (poids > 0) moyennes.set(studentId, somme / poids);
  }
  return moyennes;
}

// ─── Filtrage RBAC ───────────────────────────────────────────────────────────

/**
 * Filtre le catalogue combiné (tous rôles) selon le rôle/les permissions réels de
 * l'utilisateur connecté. Utilisé À LA FOIS pour construire les tools exposés au modèle
 * ET pour la double-vérification serveur avant exécution (on ne fait jamais confiance
 * au prompt).
 *
 * Deux régimes selon que `allowedRoles` est renseigné sur l'action :
 * - Renseigné (action pensée pour un ou plusieurs rôles précis, ex. TEACHER, STAFF) :
 *   visible uniquement pour ces rôles (ADMIN exclu sauf s'il y figure explicitement —
 *   une action « mes classes » n'a pas de sens pour un administrateur). Si l'action
 *   porte AUSSI un `requiredPermission` (ex. une action STAFF qui exige MANAGE_DISCIPLINE
 *   précisément, pas n'importe quel STAFF), cette permission est revérifiée en plus —
 *   sauf pour ADMIN, qui n'est jamais bloqué par un `requiredPermission`.
 * - Omis (comportement historique du catalogue Admin) : ADMIN voit tout ; STAFF voit
 *   uniquement les actions dont `requiredPermission` figure dans ses `permissions`.
 */
export function filterCatalogForUser(
  catalog: ActionDefinition[],
  user: { role: string; permissions?: string[] },
): ActionDefinition[] {
  const role = user.role.toUpperCase();
  const perms = new Set(user.permissions ?? []);
  return catalog.filter((a) => {
    if (a.allowedRoles) {
      if (!a.allowedRoles.includes(role)) return false;
      if (role === 'ADMIN') return true;
      return a.requiredPermission === null || perms.has(a.requiredPermission);
    }
    if (role === 'ADMIN') return true;
    // `role === 'STAFF'` explicite : sans lui, la seule détention de la permission suffisait,
    // quel que soit le rôle. Non exploitable à l'époque (seuls les comptes STAFF reçoivent des
    // permissions persistées, PrismaUserRepository:85), mais l'accès se serait ouvert en silence
    // le jour où une permission aurait été accordée à un enseignant ou un parent.
    return role === 'STAFF' && a.requiredPermission !== null && perms.has(a.requiredPermission);
  });
}

const normaliserMessage = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // retire les accents pour un matching robuste (é/è/ê → e)

/** Mots-clés déclenchant chaque domaine — un domaine matche dès qu'un seul de ses mots-clés apparaît dans le message. */
const MOTS_CLES_PAR_DOMAINE: Record<string, string[]> = {
  classes: ['classe', 'emploi du temps', 'edt', 'professeur principal'],
  matieres: ['matiere', 'matières', 'coefficient'],
  eleves: ['eleve', 'élève', 'inscri', 'transfer', 'matricule'],
  lv2_pebs: ['lv2', 'langue vivante', 'pebs', 'bilingue'],
  concours: ['concours', 'cep', 'candidat'],
  notes_bulletins: ['note', 'bulletin', 'moyenne', 'classement', 'excel'],
  conseil_classe: ['conseil de classe', 'conseil'],
  periode_annee: ['periode', 'période', 'trimestre', 'sequence', 'séquence', 'cloture', 'clôture', "fin d'annee", "fin d'année"],
  paiements: ['paiement', 'facture', 'frais', 'impaye', 'impayé', 'retard de paiement', 'cash'],
  absences: ['absence', 'absent', 'justifi'],
  enseignants_rh: ['enseignant', 'professeur', 'diplome', 'diplôme', 'conge', 'congé', 'programme'],
  communication: ['message', 'sms', 'email', 'diffus', 'notifier', 'notification'],
  sante_risque: ['risque', 'sante', 'santé', 'decrochage', 'décrochage'],
  salle_gestion: ['salle', 'salles', 'laboratoire', 'atelier', 'équipement', 'equipement'],
  salle_affectation: ['affect', 'attribuer', 'habituelle', 'salle de la classe', 'correspondance'],
};

/**
 * Réduit un catalogue au sous-ensemble d'actions pertinentes pour le message reçu, en se basant
 * sur le `domain` de chaque action (voir `ActionDefinition.domain`). Existe parce qu'un gros
 * catalogue (54 actions pour ADMIN) retransmis en entier à Groq à CHAQUE tour, même pour un
 * simple « bonjour », coûte à lui seul l'essentiel du plafond de tokens/minute du compte
 * (~5800 tokens mesurés pour une conversation vide) — constaté en test réel, cause directe de
 * réponses lentes (~20s) voire d'échecs par rate-limit.
 *
 * Heuristique volontairement simple (mots-clés, pas d'appel IA supplémentaire) : moins précise
 * qu'un vrai classifieur, mais gratuite et quasi instantanée. Filet de sécurité : si AUCUN
 * domaine ne matche (formulation inattendue), on retransmet le catalogue COMPLET plutôt que de
 * risquer de priver le modèle d'un outil dont il aurait besoin — on dégrade uniquement le coût,
 * jamais la capacité à agir.
 */
export function selectRelevantActions(catalog: ActionDefinition[], message: string): ActionDefinition[] {
  const texte = normaliserMessage(message);
  const domainesTouches = new Set(
    Object.entries(MOTS_CLES_PAR_DOMAINE)
      .filter(([, motsCles]) => motsCles.some((mot) => texte.includes(normaliserMessage(mot))))
      .map(([domaine]) => domaine),
  );

  const sansDomaine = catalog.filter((a) => !a.domain);
  if (domainesTouches.size === 0) return catalog;

  return [...sansDomaine, ...catalog.filter((a) => a.domain && domainesTouches.has(a.domain))];
}

/** Construit les tools AI SDK (inputSchema uniquement, SANS execute → le modèle propose, le serveur décide). */
/**
 * Groq (et les modèles de function-calling en général) envoie très souvent `null` pour un champ
 * optionnel qu'il ne renseigne pas, plutôt que d'omettre la clé — comportement observé
 * concrètement (`lister_eleves_a_risque` sans classe précisée → `{className: null}`), alors que
 * `z.string().optional()` n'accepte QUE `undefined`, jamais `null`. Résultat sans ce correctif :
 * échec de validation AVANT même que `execute()` ne soit atteint, tout le tour de conversation
 * s'effondre sur le message générique "service momentanément indisponible" — pour une question
 * parfaitement légitime et courante ("quels sont les élèves à risque ?", sans filtre de classe).
 *
 * Corrigé une seule fois ici plutôt que sur chacun des ~75 champs `.optional()` à travers les 5
 * catalogues : chaque champ optionnel de premier niveau devient aussi tolérant à `null`. Aucun
 * changement de comportement côté `execute()` — tous les sites d'utilisation traitent déjà
 * `input.champ` par test de vérité (`input.x ? ... : ...`) ou `??`, qui traitent `null` et
 * `undefined` de façon identique.
 */
function rendreOptionnelsNullTolerants(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (!(schema instanceof z.ZodObject)) return schema;
  const shape = schema.shape as Record<string, z.ZodTypeAny>;
  const nouveauShape: Record<string, z.ZodTypeAny> = {};
  for (const [cle, champ] of Object.entries(shape)) {
    nouveauShape[cle] = champ instanceof z.ZodOptional ? champ.unwrap().nullable().optional() : champ;
  }
  return z.object(nouveauShape);
}

export function buildTools(catalog: ActionDefinition[]): Record<string, Tool> {
  const tools: Record<string, Tool> = {};
  for (const action of catalog) {
    tools[action.name] = tool({
      description: action.description,
      inputSchema: rendreOptionnelsNullTolerants(action.inputSchema),
    });
  }
  return tools;
}
