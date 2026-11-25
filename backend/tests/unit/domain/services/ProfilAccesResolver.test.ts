import { describe, it, expect } from 'bun:test';
import { ProfilAccesResolver } from '../../../../src/domain/services/ProfilAccesResolver.ts';

describe('ProfilAccesResolver — Règle de décision d\'accès numérique (Tableau 7.2)', () => {
  // ── 1er cycle ──
  it('1er cycle : élève smartphone + parent smartphone → élève READ_ONLY, loginEnabled true, appli parent', () => {
    const res = ProfilAccesResolver.resoudre({
      cycle: 'PREMIER_CYCLE',
      eleveSmartphone: true,
      parentSmartphone: true,
      parentTelSimple: false,
    });

    expect(res.eleveAccessMode).toBe('FULL_ACCESS');
    expect(res.loginEnabled).toBe(true);
    expect(res.eleveAccessScope).toBe('READ_ONLY');
    expect(res.parentAccessMode).toBe('FULL_ACCESS');
    expect(res.profileManagedBy).toBe('PARENT');
    expect(res.notificationChannel).toBe('APPLI_PARENT');
  });

  it('1er cycle : élève SANS smartphone + parent smartphone → élève NO_LOGIN, loginEnabled false, appli parent', () => {
    const res = ProfilAccesResolver.resoudre({
      cycle: 'PREMIER_CYCLE',
      eleveSmartphone: false,
      parentSmartphone: true,
      parentTelSimple: false,
    });

    expect(res.eleveAccessMode).toBe('NO_LOGIN');
    expect(res.loginEnabled).toBe(false);
    expect(res.eleveAccessScope).toBe('READ_ONLY');
    expect(res.parentAccessMode).toBe('FULL_ACCESS');
    expect(res.profileManagedBy).toBe('PARENT');
    expect(res.notificationChannel).toBe('APPLI_PARENT');
  });

  it('1er cycle : parent avec téléphone simple, élève sans smartphone → élève NO_LOGIN, parent SMS_ONLY, canal SMS', () => {
    const res = ProfilAccesResolver.resoudre({
      cycle: 'PREMIER_CYCLE',
      eleveSmartphone: false,
      parentSmartphone: false,
      parentTelSimple: true,
    });

    expect(res.eleveAccessMode).toBe('NO_LOGIN');
    expect(res.loginEnabled).toBe(false);
    expect(res.parentAccessMode).toBe('SMS_ONLY');
    expect(res.profileManagedBy).toBe('SECRETARIAT');
    expect(res.notificationChannel).toBe('SMS');
  });

  it('1er cycle : cas limite — élève smartphone mais parent téléphone simple → élève READ_ONLY, parent SMS', () => {
    const res = ProfilAccesResolver.resoudre({
      cycle: 'PREMIER_CYCLE',
      eleveSmartphone: true,
      parentSmartphone: false,
      parentTelSimple: true,
    });

    expect(res.eleveAccessMode).toBe('FULL_ACCESS');
    expect(res.loginEnabled).toBe(true);
    expect(res.eleveAccessScope).toBe('READ_ONLY');
    expect(res.parentAccessMode).toBe('SMS_ONLY');
    expect(res.profileManagedBy).toBe('SECRETARIAT');
    expect(res.notificationChannel).toBe('SMS');
  });

  it('1er cycle : aucun contact téléphonique → élève NO_LOGIN, canal PAPIER', () => {
    const res = ProfilAccesResolver.resoudre({
      cycle: 'PREMIER_CYCLE',
      eleveSmartphone: false,
      parentSmartphone: false,
      parentTelSimple: false,
    });

    expect(res.eleveAccessMode).toBe('NO_LOGIN');
    expect(res.loginEnabled).toBe(false);
    expect(res.parentAccessMode).toBe('NO_LOGIN');
    expect(res.profileManagedBy).toBe('SECRETARIAT');
    expect(res.notificationChannel).toBe('PAPIER');
  });

  // ── 2nd cycle ──
  it('2nd cycle : élève smartphone + parent smartphone → élève FULL, autonome, notifications appli élève', () => {
    const res = ProfilAccesResolver.resoudre({
      cycle: 'SECOND_CYCLE',
      eleveSmartphone: true,
      parentSmartphone: true,
      parentTelSimple: false,
    });

    expect(res.eleveAccessMode).toBe('FULL_ACCESS');
    expect(res.loginEnabled).toBe(true);
    expect(res.eleveAccessScope).toBe('FULL');
    expect(res.parentAccessMode).toBe('FULL_ACCESS');
    expect(res.profileManagedBy).toBe('STUDENT');
    expect(res.notificationChannel).toBe('APPLI_ELEVE');
  });

  it('2nd cycle : élève smartphone + parent téléphone simple → élève FULL, parent SMS_ONLY', () => {
    const res = ProfilAccesResolver.resoudre({
      cycle: 'SECOND_CYCLE',
      eleveSmartphone: true,
      parentSmartphone: false,
      parentTelSimple: true,
    });

    expect(res.eleveAccessMode).toBe('FULL_ACCESS');
    expect(res.loginEnabled).toBe(true);
    expect(res.eleveAccessScope).toBe('FULL');
    expect(res.parentAccessMode).toBe('SMS_ONLY');
    expect(res.profileManagedBy).toBe('STUDENT');
    expect(res.notificationChannel).toBe('APPLI_ELEVE');
  });

  it('2nd cycle : élève SANS smartphone + parent smartphone → élève NO_LOGIN, géré par parent', () => {
    const res = ProfilAccesResolver.resoudre({
      cycle: 'SECOND_CYCLE',
      eleveSmartphone: false,
      parentSmartphone: true,
      parentTelSimple: false,
    });

    expect(res.eleveAccessMode).toBe('NO_LOGIN');
    expect(res.loginEnabled).toBe(false);
    expect(res.parentAccessMode).toBe('FULL_ACCESS');
    expect(res.profileManagedBy).toBe('PARENT');
    expect(res.notificationChannel).toBe('APPLI_PARENT');
  });

  it('2nd cycle : élève sans smartphone + parent téléphone simple → NO_LOGIN, SMS', () => {
    const res = ProfilAccesResolver.resoudre({
      cycle: 'SECOND_CYCLE',
      eleveSmartphone: false,
      parentSmartphone: false,
      parentTelSimple: true,
    });

    expect(res.eleveAccessMode).toBe('NO_LOGIN');
    expect(res.loginEnabled).toBe(false);
    expect(res.parentAccessMode).toBe('SMS_ONLY');
    expect(res.profileManagedBy).toBe('SECRETARIAT');
    expect(res.notificationChannel).toBe('SMS');
  });

  it('2nd cycle : aucun contact → NO_LOGIN, canal PAPIER', () => {
    const res = ProfilAccesResolver.resoudre({
      cycle: 'SECOND_CYCLE',
      eleveSmartphone: false,
      parentSmartphone: false,
      parentTelSimple: false,
    });

    expect(res.eleveAccessMode).toBe('NO_LOGIN');
    expect(res.loginEnabled).toBe(false);
    expect(res.parentAccessMode).toBe('NO_LOGIN');
    expect(res.profileManagedBy).toBe('SECRETARIAT');
    expect(res.notificationChannel).toBe('PAPIER');
  });

  // ── Cas limites et fallbacks ──
  it('cycle INCONNU avec âge < seuil (13 ans < 15) → traité comme 1er cycle', () => {
    const res = ProfilAccesResolver.resoudre({
      cycle: 'INCONNU',
      ageEleve: 13,
      seuilAgeParent: 15,
      eleveSmartphone: true,
      parentSmartphone: true,
      parentTelSimple: false,
    });

    expect(res.eleveAccessScope).toBe('READ_ONLY');
    expect(res.profileManagedBy).toBe('PARENT');
  });

  it('cycle INCONNU avec âge >= seuil (17 ans >= 15) → traité comme 2nd cycle', () => {
    const res = ProfilAccesResolver.resoudre({
      cycle: 'INCONNU',
      ageEleve: 17,
      seuilAgeParent: 15,
      eleveSmartphone: true,
      parentSmartphone: true,
      parentTelSimple: false,
    });

    expect(res.eleveAccessScope).toBe('FULL');
    expect(res.profileManagedBy).toBe('STUDENT');
  });

  it('cycle PRIMAIRE → suit les règles de protection du 1er cycle', () => {
    const res = ProfilAccesResolver.resoudre({
      cycle: 'PRIMAIRE',
      eleveSmartphone: true,
      parentSmartphone: true,
      parentTelSimple: false,
    });

    expect(res.eleveAccessScope).toBe('READ_ONLY');
    expect(res.profileManagedBy).toBe('PARENT');
  });
});
