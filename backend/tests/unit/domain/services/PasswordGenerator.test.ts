import { describe, expect, test } from 'bun:test';
import { generateTemporaryPassword } from '../../../../src/domain/services/PasswordGenerator.ts';

describe('PasswordGenerator', () => {
  test('génère un mot de passe temporaire fort et lisible', () => {
    const password = generateTemporaryPassword();

    expect(password).toHaveLength(10);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[2-9]/);
    expect(password).toMatch(/[!@#$%&*]/);
  });

  test('refuse une longueur qui ne peut pas contenir les quatre catégories', () => {
    expect(() => generateTemporaryPassword(3)).toThrow();
  });
});