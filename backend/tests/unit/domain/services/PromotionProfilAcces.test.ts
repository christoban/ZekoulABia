import { describe, it, expect } from 'bun:test';
import { CycleResolver } from '@domain/services/CycleResolver';
import { ProfilAccesResolver } from '@domain/services/ProfilAccesResolver';

describe('Promotion de cycle & Recalcul du profil d’accès numérique', () => {
  it('détecte correctement le passage du premier cycle au second cycle', () => {
    expect(CycleResolver.resolveCycle('3e')).toBe('PREMIER_CYCLE');
    expect(CycleResolver.resolveCycle('2nde C')).toBe('SECOND_CYCLE');
    expect(CycleResolver.resolveCycle('Form 5')).toBe('PREMIER_CYCLE');
    expect(CycleResolver.resolveCycle('LowerSixth Arts')).toBe('SECOND_CYCLE');
  });

  it('propose un profil d’accès autonome (FULL, STUDENT) pour un élève du second cycle avec smartphone', () => {
    const profil3e = ProfilAccesResolver.resoudre({
      cycle: 'PREMIER_CYCLE',
      eleveSmartphone: true,
      parentSmartphone: true,
      parentTelSimple: true,
    });

    // En 3e (1er cycle) : l'élève est en READ_ONLY, géré par le parent
    expect(profil3e.eleveAccessScope).toBe('READ_ONLY');
    expect(profil3e.profileManagedBy).toBe('PARENT');

    // Promotion en 2nde (2nd cycle)
    const profil2nde = ProfilAccesResolver.resoudre({
      cycle: 'SECOND_CYCLE',
      eleveSmartphone: true,
      parentSmartphone: true,
      parentTelSimple: true,
    });

    // En 2nde (2nd cycle) : l'élève passe en autonomie FULL et gère son profil (STUDENT)
    expect(profil2nde.eleveAccessScope).toBe('FULL');
    expect(profil2nde.profileManagedBy).toBe('STUDENT');
    expect(profil2nde.notificationChannel).toBe('APPLI_ELEVE');
  });
});
