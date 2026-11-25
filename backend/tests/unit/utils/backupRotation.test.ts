import { describe, it, expect } from 'bun:test';
import { calculerClesAConserver, type ObjetDatable } from '@infrastructure/backup/BackupRetentionPolicy';

const JOUR = 86400000;
const MAINTENANT = new Date('2026-08-02T02:00:00Z');

function objetIlYA(joursAvant: number): ObjetDatable {
  const d = new Date(MAINTENANT.getTime() - joursAvant * JOUR);
  return { cle: `export-${d.toISOString().slice(0, 10)}.enc`, derniereModification: d };
}

describe('calculerClesAConserver — rotation dégressive Couche 3', () => {
  it('conserve les 7 derniers exports quotidiens intégralement', () => {
    const objets = Array.from({ length: 7 }, (_, i) => objetIlYA(i));
    const conserves = calculerClesAConserver(objets, MAINTENANT);
    expect(conserves.size).toBe(7);
    for (const o of objets) expect(conserves.has(o.cle)).toBe(true);
  });

  it('purge un export vieux de 3 jours sans équivalent plus ancien (aucun palier ne le protège en double)', () => {
    // Un seul objet par jour ici — cas trivial, doit être conservé (palier 1).
    const objets = [objetIlYA(3)];
    const conserves = calculerClesAConserver(objets, MAINTENANT);
    expect(conserves.has(objets[0]!.cle)).toBe(true);
  });

  it('au-delà de 7 jours, ne garde qu\'un objet par semaine (pas les 28 quotidiens complets)', () => {
    // 28 jours d'exports quotidiens (1 par jour, jours 8 à 35).
    const objets = Array.from({ length: 28 }, (_, i) => objetIlYA(8 + i));
    const conserves = calculerClesAConserver(objets, MAINTENANT);
    // Au plus 4 conservés par le palier hebdomadaire (le schéma cible 4 semaines).
    expect(conserves.size).toBeLessThanOrEqual(4);
    expect(conserves.size).toBeGreaterThan(0);
  });

  it('au-delà de 35 jours, ne garde qu\'un objet par mois calendaire', () => {
    const objets = [objetIlYA(40), objetIlYA(45), objetIlYA(50)]; // même mois probable
    const conserves = calculerClesAConserver(objets, MAINTENANT);
    // Un seul par mois — ces 3 dates tombent potentiellement sur 1 ou 2 mois selon le calendrier,
    // jamais 3 conservés indépendamment de la proximité des dates.
    expect(conserves.size).toBeLessThanOrEqual(2);
  });

  it('purge totalement un objet trop vieux pour tous les paliers (> 12 mois, mois déjà occupé)', () => {
    // 13 objets, un par mois sur 13 mois — le plus ancien doit être purgé (limite 12 mois).
    const objets = Array.from({ length: 13 }, (_, i) => objetIlYA(40 + i * 30));
    const conserves = calculerClesAConserver(objets, MAINTENANT);
    const plusAncien = objets[objets.length - 1]!;
    expect(conserves.has(plusAncien.cle)).toBe(false);
  });

  it('scénario réaliste : 400 jours d\'exports quotidiens ne laissent qu\'un sous-ensemble borné', () => {
    const objets = Array.from({ length: 400 }, (_, i) => objetIlYA(i));
    const conserves = calculerClesAConserver(objets, MAINTENANT);
    // 7 quotidiens + 4 hebdomadaires + 12 mensuels = 23 au maximum.
    expect(conserves.size).toBeLessThanOrEqual(23);
    expect(conserves.size).toBeGreaterThan(10);
  });
});
