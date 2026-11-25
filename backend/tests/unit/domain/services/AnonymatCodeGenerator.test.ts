import { describe, it, expect } from 'bun:test';
import { generateAnonymatCode, generateAnonymatCodes } from '@domain/services/AnonymatCodeGenerator';

describe('AnonymatCodeGenerator', () => {
  it('génère un code au format 2 lettres + 2 chiffres (lettres/chiffres filtrés)', () => {
    const set = new Set<string>();
    const code = generateAnonymatCode(set);
    // Lettres A-Z sans I/O, chiffres 2-9
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ]{2}[23456789]{2}$/);
  });

  it('n\'utilise jamais I, O, 0 ou 1', () => {
    const codes = generateAnonymatCodes(500);
    for (const code of codes) {
      expect(code).not.toMatch(/[IO01]/);
    }
  });

  it('garantit l\'unicité sur 500 générations', () => {
    const codes = generateAnonymatCodes(500);
    const unique = new Set(codes);
    expect(unique.size).toBe(500);
  });

  it('ajoute le code généré au Set fourni', () => {
    const set = new Set<string>();
    const code = generateAnonymatCode(set);
    expect(set.has(code)).toBe(true);
    expect(set.size).toBe(1);
  });
});
