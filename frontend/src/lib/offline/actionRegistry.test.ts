import { describe, it, expect } from 'bun:test';
import { OPERATION_RISK_LEVEL, OfflineActionRefusedError } from './actionRegistry';

describe('Offline Action Registry — Phase 5', () => {
  it('autorise les brouillons d\'inscription et l\'émargement en risque MOYEN', () => {
    expect(OPERATION_RISK_LEVEL.ENROLLMENT_DRAFT).toBe('MOYEN');
    expect(OPERATION_RISK_LEVEL.EXAM_ATTENDANCE).toBe('MOYEN');
  });

  it('interdit formellement les opérations structurantes irréversibles en risque FORT', () => {
    expect(OPERATION_RISK_LEVEL.ENROLLMENT_VALIDATE).toBe('FORT');
    expect(OPERATION_RISK_LEVEL.ENROLLMENT_ACTIVATE).toBe('FORT');
    expect(OPERATION_RISK_LEVEL.EXAM_PUBLISH).toBe('FORT');
  });

  it('instancie OfflineActionRefusedError avec le nom du type refusé', () => {
    const err = new OfflineActionRefusedError('ENROLLMENT_VALIDATE');
    expect(err instanceof Error).toBe(true);
    expect(err.name).toBe('OfflineActionRefusedError');
    expect(err.message.includes('ENROLLMENT_VALIDATE')).toBe(true);
    expect(err.message.includes('nécessite une connexion internet')).toBe(true);
  });
});
