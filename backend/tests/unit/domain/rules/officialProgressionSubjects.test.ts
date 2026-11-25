import { describe, it, expect } from 'bun:test';
import {
  CONCRETE_LV2_SUBJECTS,
  etendreMatieresReferenceImport,
  expliquerRejetLibelleAbstrait,
  normaliserNiveauScolaire,
} from '@domain/rules/officialProgressionSubjects';

describe('domain/rules/officialProgressionSubjects (LV2 & Lettres classiques)', () => {
  it('(b) normalise les variantes de niveaux (4e/4ème, 3e/3ème, 1ere/1ère, 6e/6ème, 5e/5ème)', () => {
    expect(normaliserNiveauScolaire('4e')).toBe('4e');
    expect(normaliserNiveauScolaire('4ème')).toBe('4e');
    expect(normaliserNiveauScolaire(' 4eme ')).toBe('4e');
    expect(normaliserNiveauScolaire('3ème')).toBe('3e');
    expect(normaliserNiveauScolaire('1ère')).toBe('1ere');
    expect(normaliserNiveauScolaire('1ere')).toBe('1ere');
    expect(normaliserNiveauScolaire('6ème')).toBe('6e');
    expect(normaliserNiveauScolaire('5ème')).toBe('5e');
  });

  it('A1 + B1 : en 6e/5e, remplace Lettres classiques par Latin uniquement (sans Grec ni LV2)', () => {
    const brutes = ['Mathématiques', 'Français', 'Lettres classiques (Latin/Grec)'];
    for (const lvl of ['6e', '6ème', '5e', '5ème']) {
      const res = etendreMatieresReferenceImport(brutes, lvl);
      expect(res).toContain('Latin');
      expect(res).not.toContain('Grec');
      expect(res).not.toContain('Lettres classiques (Latin/Grec)');
      expect(res).not.toContain('Allemand');
    }
  });

  it('A1 + B1 : en 4e/3e (4e, 4ème, 3e, 3ème), remplace LV2 par les 5 langues et Lettres classiques par Latin + Grec', () => {
    const brutes = ['Mathématiques', 'LV2', 'Lettres classiques (Latin/Grec)'];
    for (const lvl of ['4e', '4ème', '3e', '3ème']) {
      const res = etendreMatieresReferenceImport(brutes, lvl);
      expect(res).not.toContain('LV2');
      expect(res).not.toContain('Lettres classiques (Latin/Grec)');
      for (const langue of CONCRETE_LV2_SUBJECTS) {
        expect(res).toContain(langue);
      }
      expect(res).toContain('Latin');
      expect(res).toContain('Grec');
    }
  });

  it('(c) pas d\'expansion inutile quand le catalogue a déjà les noms concrets (2nde–Tle série A1 : Latin et Grec)', () => {
    const brutesA1 = ['Latin', 'Grec', 'Littérature', 'Mathématiques'];
    for (const lvl of ['2nde', '1ère', '1ere', 'Tle']) {
      const res = etendreMatieresReferenceImport(brutesA1, lvl);
      expect(res).toEqual(['Latin', 'Grec', 'Littérature', 'Mathématiques']);
      // Pas d'expansion LV2 en A1 (LV2 absent)
      expect(res).not.toContain('Allemand');
    }
  });

  it('2nd cycle A2/A4/A5/ABI : remplace LV2 par les 5 langues, sans toucher à LV3 (A5)', () => {
    const brutesA5 = ['Littérature', 'Anglais', 'LV2', 'LV3'];
    const res = etendreMatieresReferenceImport(brutesA5, '1ère');
    expect(res).not.toContain('LV2');
    for (const langue of CONCRETE_LV2_SUBJECTS) {
      expect(res).toContain(langue);
    }
    // (d) LV3 de la série A5 laissé intact (aucune expansion)
    expect(res).toContain('LV3');
    expect(res).not.toContain('Latin');
    expect(res).not.toContain('Grec');
  });

  it('(a) garantit zéro doublon dans la liste étendue même si le catalogue contient déjà une langue ou un doublon de casse/accents', () => {
    const brutesAvecDoublons = [
      'Mathématiques',
      'mathematiques',
      'Allemand',
      'LV2',
      'Latin',
      'Lettres classiques (Latin/Grec)',
      'Grec',
    ];
    const res = etendreMatieresReferenceImport(brutesAvecDoublons, '4ème');
    expect(res.filter((s) => s.toLowerCase() === 'allemand')).toHaveLength(1);
    expect(res.filter((s) => s.toLowerCase() === 'latin')).toHaveLength(1);
    expect(res.filter((s) => s.toLowerCase() === 'grec')).toHaveLength(1);
    expect(res.filter((s) => s.toLowerCase().startsWith('math'))).toHaveLength(1);
    expect(new Set(res).size).toBe(res.length);
  });

  it('B1 : fournit un message explicite listant les noms concrets acceptés quand un libellé abstrait est soumis', () => {
    const brutes4e = ['LV2', 'Lettres classiques (Latin/Grec)'];
    const msgLv2 = expliquerRejetLibelleAbstrait('LV2', brutes4e, '4e');
    expect(msgLv2).toContain('Allemand, Arabe, Chinois, Espagnol, Italien');

    const msgClassiques6e = expliquerRejetLibelleAbstrait('Lettres classiques (Latin/Grec)', brutes4e, '6e');
    expect(msgClassiques6e).toContain('utilisez un nom séparé (Latin).');
    expect(msgClassiques6e).not.toContain('(Latin, Grec)');

    const msgClassiques4e = expliquerRejetLibelleAbstrait('Lettres classiques (Latin/Grec)', brutes4e, '4ème');
    expect(msgClassiques4e).toContain('(Latin, Grec)');

    // Aucun message spécial si le libellé n'est pas dans le scope (ex. LV2 en 6e)
    expect(expliquerRejetLibelleAbstrait('LV2', ['Mathématiques'], '6e')).toBeNull();
  });
});

