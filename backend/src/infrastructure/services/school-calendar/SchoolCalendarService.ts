/**
 * Calendrier scolaire d'un établissement — pas d'entité "calendrier national" séparée à
 * maintenir : les vacances se déduisent des intervalles ENTRE deux AcademicPeriod déjà
 * définies pour l'année scolaire courante (avant la première période, entre deux périodes,
 * après la dernière), complétées par :
 *  - les jours fériés nationaux camerounais (fixes + lundi de Pâques, calculable), qui eux
 *    tombent souvent EN PLEIN MILIEU d'un trimestre actif et ne seraient donc jamais détectés
 *    par le seul découpage en périodes ;
 *  - les exceptions locales (SchoolCalendarException) propres à chaque établissement.
 * Les fêtes religieuses à date mobile non calculables de façon fiable (Aïd el-Fitr, Aïd
 * el-Kebir, Mawlid — calendrier lunaire, confirmées chaque année par les autorités religieuses)
 * ne sont volontairement PAS devinées ici : un établissement qui les observe les ajoute lui-même
 * via SchoolCalendarException, le mécanisme existe déjà pour exactement ce cas.
 */
import type { PrismaClient } from '@prisma/client';

function memeJour(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Jours fériés camerounais à date fixe : [mois (1-12), jour]. */
const JOURS_FERIES_FIXES: Array<[number, number]> = [
  [1, 1],   // Jour de l'an
  [2, 11],  // Fête de la Jeunesse
  [5, 1],   // Fête du Travail
  [5, 20],  // Fête Nationale
  [8, 15],  // Assomption
  [12, 25], // Noël
];

/** Lundi de Pâques (algorithme de Computus — Gauss, calendrier grégorien). */
function lundiDePaques(annee: number): Date {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const numeroJour = h + l - 7 * m + 114;
  const mois = Math.floor(numeroJour / 31); // 3 = mars, 4 = avril
  const jour = (numeroJour % 31) + 1;
  const dimanchePaques = new Date(annee, mois - 1, jour);
  const lundi = new Date(dimanchePaques);
  lundi.setDate(lundi.getDate() + 1);
  return lundi;
}

function estJourFerieNational(date: Date): boolean {
  const mois = date.getMonth() + 1;
  const jour = date.getDate();
  if (JOURS_FERIES_FIXES.some(([m, j]) => m === mois && j === jour)) return true;
  return memeJour(date, lundiDePaques(date.getFullYear()));
}

export async function estJourOuvreScolaire(
  prisma: PrismaClient,
  schoolId: string,
  date: Date,
): Promise<boolean> {
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { saturdaySchedule: true } });
  const jourSemaine = date.getDay(); // 0 = dimanche, 6 = samedi
  if (jourSemaine === 0) return false;
  if (jourSemaine === 6 && !(school?.saturdaySchedule ?? true)) return false;

  if (estJourFerieNational(date)) return false;

  const exception = await prisma.schoolCalendarException.findFirst({
    where: { schoolId, date: { gte: new Date(date.toDateString()), lt: new Date(new Date(date.toDateString()).getTime() + 86400000) }, type: 'FERMETURE' },
    select: { id: true },
  });
  if (exception) return false;

  const periodes = await prisma.academicPeriod.findMany({
    where: { academicYear: { schoolId, isCurrent: true } },
    select: { startDate: true, endDate: true },
    orderBy: { orderIndex: 'asc' },
  });
  if (periodes.length === 0) return true; // pas de découpage configuré — on ne bloque rien par défaut

  return periodes.some((p) => date >= p.startDate && date <= p.endDate);
}

/**
 * Avance `date` du nombre de jours ouvrés scolaires demandé — utilisé pour les rappels
 * ("3 jours ouvrés avant la clôture").
 */
export async function ajouterJoursOuvresScolaires(
  prisma: PrismaClient,
  schoolId: string,
  date: Date,
  joursOuvres: number,
): Promise<Date> {
  const resultat = new Date(date);
  let restants = joursOuvres;
  let garde = 0;
  while (restants > 0 && garde < 400) {
    resultat.setDate(resultat.getDate() + 1);
    garde++;
    if (await estJourOuvreScolaire(prisma, schoolId, resultat)) restants--;
  }
  return resultat;
}

/**
 * Prolongation d'une fenêtre glissante (Type 3) — appelée une fois par jour par le job Inngest
 * pour CHAQUE jour de fermeture rencontré tant que la fenêtre est encore ouverte. En cumulant
 * jour après jour (plutôt qu'en ne regardant que si la date de clôture elle-même tombe un jour
 * fermé), une coupure de plusieurs semaines en plein milieu de la fenêtre — vacances de Noël
 * pendant le choix LV2, par exemple — est intégralement compensée au fil des passages du job,
 * pas seulement le cas où la clôture coïncide par hasard avec un jour fermé.
 * Retourne la nouvelle date de clôture si `aujourdhui` est un jour de fermeture, sinon `null`.
 */
export async function prolongerSiFermetureAujourdhui(
  prisma: PrismaClient,
  schoolId: string,
  closeDate: Date,
  aujourdhui: Date,
): Promise<Date | null> {
  if (await estJourOuvreScolaire(prisma, schoolId, aujourdhui)) return null;
  const nouvelleCloture = new Date(closeDate);
  nouvelleCloture.setDate(nouvelleCloture.getDate() + 1);
  return nouvelleCloture;
}
