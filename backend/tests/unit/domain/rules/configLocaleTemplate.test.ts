import { describe, it, expect } from 'bun:test';
import {
  CHAMPS_CONFIG_LOCALE,
  extraireChampsConfigModifies,
  ajouterOverrides,
  fusionnerConfigLocaleTemplate,
} from '../../../../src/domain/rules/configLocaleTemplate';

describe('configLocaleTemplate — règle V2.2', () => {
  it('fusionnerConfigLocaleTemplate : un champ overridé garde la valeur locale', () => {
    const resultat = fusionnerConfigLocaleTemplate(
      { passMark: 10, councilPassMark: 10, maxAbsences: 10 },
      { passMark: 12, councilPassMark: 10, maxAbsences: 10 },
      ['passMark'],
    );
    expect(resultat.passMark).toBe(12);
    expect(resultat.councilPassMark).toBe(10);
    expect(resultat.maxAbsences).toBe(10);
  });

  it('fusionnerConfigLocaleTemplate : sans override, tout suit le template', () => {
    const resultat = fusionnerConfigLocaleTemplate(
      { passMark: 10, smsEnabled: false },
      { passMark: 14, smsEnabled: true },
      [],
    );
    expect(resultat.passMark).toBe(10);
    expect(resultat.smsEnabled).toBe(false);
  });

  it('fusionnerConfigLocaleTemplate : un override absent du local est ignoré', () => {
    const resultat = fusionnerConfigLocaleTemplate(
      { passMark: 10 },
      { passMark: 12 },
      ['smsEnabled'],
    );
    expect(resultat.passMark).toBe(10);
  });

  it('extraireChampsConfigModifies : ne garde que les champs de la liste blanche', () => {
    const champs = extraireChampsConfigModifies({
      passMark: 12,
      schoolId: 'school-1',
      demandeurRole: 'ADMIN',
      timezone: 'Africa/Douala',
      smsEnabled: true,
    });
    expect(champs).toEqual(['passMark', 'smsEnabled']);
  });

  it('extraireChampsConfigModifies : ignore les champs undefined', () => {
    const champs = extraireChampsConfigModifies({ passMark: undefined, maxAbsences: 5 });
    expect(champs).toEqual(['maxAbsences']);
  });

  it('ajouterOverrides : union sans doublon', () => {
    expect(ajouterOverrides(['passMark'], ['passMark', 'smsEnabled'])).toEqual(['passMark', 'smsEnabled']);
  });

  it('CHAMPS_CONFIG_LOCALE ne contient pas de champs hors SchoolConfig', () => {
    expect(CHAMPS_CONFIG_LOCALE).not.toContain('schoolId');
    expect(CHAMPS_CONFIG_LOCALE).not.toContain('timezone');
    expect(CHAMPS_CONFIG_LOCALE).not.toContain('locale');
  });
});
