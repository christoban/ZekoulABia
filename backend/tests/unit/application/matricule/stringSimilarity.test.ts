import { describe, it, expect } from 'bun:test';
import { normalizeForMatch, compareNames } from '../../../../src/application/matricule/stringSimilarity.ts';

describe('normalizeForMatch', () => {
  it('met en minuscules et retire les accents', () => {
    expect(normalizeForMatch('NDZOMO Éric')).toBe('ndzomo eric');
  });

  it("sépare les tirets et apostrophes en mots distincts", () => {
    expect(normalizeForMatch("M'Barga")).toBe('m barga');
    expect(normalizeForMatch('Marie-Claire')).toBe('marie claire');
  });

  it('réduit les espaces multiples et les espaces en bord de chaîne', () => {
    expect(normalizeForMatch('  Jean   Pierre  ')).toBe('jean pierre');
  });
});

describe('compareNames — utilisé par le matching onboarding (verrou date de naissance déjà passé) et par ImporterMatriculesUseCase', () => {
  it('retourne 1 (ou très proche) pour une correspondance exacte', () => {
    expect(compareNames('Ndzomo', 'Christophe', 'Ndzomo', 'Christophe')).toBeCloseTo(1, 5);
  });

  it('est insensible à la casse et aux accents', () => {
    expect(compareNames('NDZOMO', 'ÉRIC', 'ndzomo', 'eric')).toBeCloseTo(1, 5);
  });

  it("gère nativement l'inversion nom/prénom (bag-of-words, pas deux champs figés)", () => {
    const inverse = compareNames('Ndzomo', 'Eric', 'Eric', 'Ndzomo');
    expect(inverse).toBeCloseTo(1, 5);
  });

  it('gère un nom composé de plusieurs mots dans un ordre différent (ex. deux prénoms)', () => {
    const score = compareNames('Ndzi', 'Jean Pierre', 'Ndzi', 'Pierre Jean');
    expect(score).toBeCloseTo(1, 5);
  });

  it('donne un score élevé pour une faute de frappe mineure (variante réaliste)', () => {
    const score = compareNames('Nguemo', 'Christophe', 'Nguemou', 'Christophe');
    expect(score).toBeGreaterThan(0.85);
  });

  it('reste sous le seuil de fuzzy-matching (0.85) pour un nom de famille différent malgré un prénom identique', () => {
    // Un mot exactement partagé sur deux tire le score vers le haut (bag-of-words) — mesuré
    // ici à ~0.71, pas un score "bas" au sens absolu. La propriété de sécurité qui compte
    // réellement est de rester sous FUZZY_SIMILARITY_THRESHOLD (0.85, voir
    // ImporterMatriculesUseCase/SoumettreFormulaireOnboardingUseCase) pour ne jamais être
    // proposé comme correspondance probable.
    const score = compareNames('Essomba', 'Christophe', 'Nguemo', 'Christophe');
    expect(score).toBeLessThan(0.85);
  });

  it('reste sous le seuil de fuzzy-matching (0.85) pour deux personnes homonymes de prénom mais pas de nom (cas adversarial)', () => {
    // Même prénom courant, noms de famille sans rapport — ne doit jamais être classé "probable"
    const score = compareNames('Ateba', 'Marie', 'Fouda', 'Marie');
    expect(score).toBeLessThan(0.85);
  });

  it('un mot en trop ou manquant d\'un côté fait baisser le score (MIN directionnel, pas moyenne)', () => {
    // "Jean Pierre Ndzi" vs "Ndzi" seul : un des deux mots supplémentaires ne trouve pas de
    // bon appariement dans l'autre sens, donc le score global reste tiré vers le bas.
    const score = compareNames('Ndzi', 'Jean Pierre', 'Ndzi', 'Jean');
    expect(score).toBeLessThan(1);
    expect(score).toBeGreaterThan(0.5);
  });

  it('retourne 0 si un des deux côtés est vide', () => {
    expect(compareNames('', '', 'Ndzomo', 'Eric')).toBe(0);
  });
});
