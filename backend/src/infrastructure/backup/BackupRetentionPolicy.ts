/**
 * UTILITAIRE — Rotation dégressive des exports offsite (Couche 3, PLAN_IMPLEMENTATION_BACKUP.md
 * §3.3). Fonction pure, testable sans DB ni stockage réel : reçoit la liste des objets déjà
 * présents dans le bucket, retourne l'ensemble des clés à CONSERVER (tout le reste est à purger).
 *
 * Schéma : 7 derniers quotidiens (un par jour) + 4 dernières semaines au-delà de 7 jours (un par
 * semaine, le plus récent de chaque semaine) + 12 derniers mois au-delà de 35 jours (un par mois
 * calendaire, le plus récent). Un job de nettoyage applique cette règle après chaque export réussi.
 */

export interface ObjetDatable {
  cle: string;
  derniereModification: Date;
}

const MS_JOUR = 86400000;

function ageEnJours(d: Date, maintenant: Date): number {
  return Math.floor((maintenant.getTime() - d.getTime()) / MS_JOUR);
}

/** Bucket semaine simple (pas calendaire ISO — suffisant pour un regroupement de rétention). */
function cleSemaine(d: Date): string {
  return String(Math.floor(d.getTime() / MS_JOUR / 7));
}

function cleMois(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function cleJour(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function calculerClesAConserver(objets: ObjetDatable[], maintenant: Date = new Date()): Set<string> {
  const tries = [...objets].sort((a, b) => b.derniereModification.getTime() - a.derniereModification.getTime());
  const conserves = new Set<string>();

  // Palier 1 — 7 derniers jours, un par jour calendaire (le plus récent de ce jour). age 0..6
  // inclus = exactement 7 valeurs possibles, pas 8 (age===7 appartient déjà au palier suivant).
  const joursVus = new Set<string>();
  for (const o of tries) {
    if (ageEnJours(o.derniereModification, maintenant) >= 7) continue;
    const j = cleJour(o.derniereModification);
    if (joursVus.has(j)) continue;
    joursVus.add(j);
    conserves.add(o.cle);
  }

  // Palier 2 — 4 semaines suivantes (7 à 35 jours), un par semaine.
  const semainesVues = new Set<string>();
  for (const o of tries) {
    if (conserves.has(o.cle)) continue;
    const age = ageEnJours(o.derniereModification, maintenant);
    if (age < 7 || age > 35) continue;
    const s = cleSemaine(o.derniereModification);
    if (semainesVues.has(s)) continue;
    if (semainesVues.size >= 4) continue;
    semainesVues.add(s);
    conserves.add(o.cle);
  }

  // Palier 3 — 12 mois suivants (au-delà de 35 jours), un par mois calendaire.
  const moisVus = new Set<string>();
  for (const o of tries) {
    if (conserves.has(o.cle)) continue;
    const age = ageEnJours(o.derniereModification, maintenant);
    if (age <= 35) continue;
    const m = cleMois(o.derniereModification);
    if (moisVus.has(m)) continue;
    if (moisVus.size >= 12) continue;
    moisVus.add(m);
    conserves.add(o.cle);
  }

  return conserves;
}
