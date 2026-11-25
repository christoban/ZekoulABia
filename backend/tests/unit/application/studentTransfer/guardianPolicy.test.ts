import { describe, expect, it } from 'bun:test';
import {
  AGE_MAJORITE_CIVILE,
  estEleveMajeur,
  validerTuteurPrincipal,
} from '../../../../src/application/studentTransfer/guardianPolicy.ts';
import { STUDENT_TRANSFER_CONFIG } from '../../../../src/application/studentTransfer/config.ts';

describe('guardianPolicy', () => {
  it('considère un élève âgé de 21 ans comme majeur', () => {
    expect(estEleveMajeur(new Date('2005-11-06T00:00:00.000Z'), new Date('2026-11-06T12:00:00.000Z'))).toBe(true);
    expect(AGE_MAJORITE_CIVILE).toBe(21);
    expect(STUDENT_TRANSFER_CONFIG.parentReminderDelaysDays).toEqual([3, 10]);
  });

  it('considère un élève de moins de 21 ans comme mineur', () => {
    expect(estEleveMajeur(new Date('2005-11-07T00:00:00.000Z'), new Date('2026-11-06T12:00:00.000Z'))).toBe(false);
  });

  it('refuse zéro ou plusieurs tuteurs principaux', () => {
    expect(() => validerTuteurPrincipal([])).toThrow('exactement un tuteur principal');
    expect(() => validerTuteurPrincipal([
      { parentProfileId: 'parent-a', phone: '+237600000001', phoneVerified: true },
      { parentProfileId: 'parent-b', phone: '+237600000002', phoneVerified: true },
    ])).toThrow('exactement un tuteur principal');
  });

  it('refuse un tuteur principal sans téléphone vérifié', () => {
    expect(() => validerTuteurPrincipal([
      { parentProfileId: 'parent-a', phone: '+237600000001', phoneVerified: false },
    ])).toThrow('téléphone vérifié');
  });

  it('retourne le tuteur principal vérifié', () => {
    expect(validerTuteurPrincipal([
      { parentProfileId: 'parent-a', phone: '+237600000001', phoneVerified: true },
    ])).toEqual({ parentProfileId: 'parent-a', phone: '+237600000001', phoneVerified: true });
  });
});