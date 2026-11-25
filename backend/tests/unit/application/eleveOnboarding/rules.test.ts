import { describe, it, expect } from 'bun:test';
import { determinerRecipientType, peutTransitionnerDepuisPendingValidation, peutSoumettreFormulaire } from '../../../../src/application/eleveOnboarding/rules.ts';

describe('determinerRecipientType', () => {
  it('force PARENT pour sourceType CONCOURS, même sans rien d\'autre renseigné', () => {
    expect(determinerRecipientType({ sourceType: 'CONCOURS' })).toBe('PARENT');
  });

  it('force PARENT pour CONCOURS même si un recipientType explicite ELEVE est passé (aucun override possible)', () => {
    expect(determinerRecipientType({ sourceType: 'CONCOURS', recipientTypeExplicite: 'ELEVE' })).toBe('PARENT');
  });

  it('force PARENT pour CONCOURS même si defaultRecipient de l\'école est ELEVE', () => {
    expect(determinerRecipientType({ sourceType: 'CONCOURS', defaultRecipient: 'ELEVE' })).toBe('PARENT');
  });

  it('force PARENT pour CONCOURS même si recipientTypeExplicite ET defaultRecipient valent tous deux ELEVE', () => {
    expect(determinerRecipientType({ sourceType: 'CONCOURS', recipientTypeExplicite: 'ELEVE', defaultRecipient: 'ELEVE' })).toBe('PARENT');
  });

  it('utilise le recipientType explicite pour AUTOSERVICE quand fourni', () => {
    expect(determinerRecipientType({ sourceType: 'AUTOSERVICE', recipientTypeExplicite: 'LES_DEUX', defaultRecipient: 'ELEVE' })).toBe('LES_DEUX');
  });

  it('retombe sur defaultRecipient pour AUTOSERVICE si aucun recipientType explicite', () => {
    expect(determinerRecipientType({ sourceType: 'AUTOSERVICE', defaultRecipient: 'PARENT' })).toBe('PARENT');
  });

  it('retombe sur ELEVE par défaut si ni recipientType explicite ni defaultRecipient', () => {
    expect(determinerRecipientType({ sourceType: 'AUTOSERVICE' })).toBe('ELEVE');
  });

  it('même comportement de repli pour IMPORT_MASSE (aucun forçage spécifique, contrairement à CONCOURS)', () => {
    expect(determinerRecipientType({ sourceType: 'IMPORT_MASSE', recipientTypeExplicite: 'PARENT' })).toBe('PARENT');
    expect(determinerRecipientType({ sourceType: 'IMPORT_MASSE' })).toBe('ELEVE');
  });

  it('force PARENT pour une classe de maternelle, même sans rien d\'autre renseigné', () => {
    expect(determinerRecipientType({ sourceType: 'AUTOSERVICE', sectionCycle: 'maternelle' })).toBe('PARENT');
  });

  it('force PARENT pour une classe de primaire même si un recipientType explicite ELEVE est passé (aucun override possible)', () => {
    expect(determinerRecipientType({ sourceType: 'AUTOSERVICE', sectionCycle: 'primaire', recipientTypeExplicite: 'ELEVE' })).toBe('PARENT');
  });

  it('ne force rien pour secondaire/technique (seuls maternelle/primaire sont forcés)', () => {
    expect(determinerRecipientType({ sourceType: 'AUTOSERVICE', sectionCycle: 'secondaire' })).toBe('ELEVE');
    expect(determinerRecipientType({ sourceType: 'AUTOSERVICE', sectionCycle: 'technique', defaultRecipient: 'ELEVE' })).toBe('ELEVE');
  });

  it('bascule sur PARENT quand l\'élève n\'a pas de dispositif mais le parent oui (signal de repli, pas de forçage)', () => {
    expect(determinerRecipientType({ sourceType: 'AUTOSERVICE', eleveADispositif: false, parentADispositif: true })).toBe('PARENT');
  });

  it('un recipientType explicite prévaut sur le signal de capacité numérique', () => {
    expect(determinerRecipientType({ sourceType: 'AUTOSERVICE', eleveADispositif: false, parentADispositif: true, recipientTypeExplicite: 'ELEVE' })).toBe('ELEVE');
  });

  it('utilise ageThresholdForParent comme repli secondaire quand l\'âge est connu et aucun recipientType explicite', () => {
    expect(determinerRecipientType({ sourceType: 'AUTOSERVICE', studentAge: 12, ageThresholdForParent: 15 })).toBe('PARENT');
    expect(determinerRecipientType({ sourceType: 'AUTOSERVICE', studentAge: 17, ageThresholdForParent: 15 })).toBe('ELEVE');
  });
});

describe('peutEtreInscritOuRejete (inscription directe en 1 étape)', () => {
  it('autorise l inscription directe depuis SUBMITTED, DRAFT, LINK_SENT', () => {
    expect(peutTransitionnerDepuisPendingValidation('SUBMITTED')).toBe(true);
    expect(peutTransitionnerDepuisPendingValidation('DRAFT')).toBe(true);
    expect(peutTransitionnerDepuisPendingValidation('LINK_SENT')).toBe(true);
  });

  it('refuse toute transition depuis les statuts terminaux', () => {
    const statutsTerminaux = ['VALIDATED', 'ACTIVATED', 'REJECTED', 'EXPIRED'] as const;
    for (const statut of statutsTerminaux) {
      expect(peutTransitionnerDepuisPendingValidation(statut)).toBe(false);
    }
  });

  it('refuse une double validation (dossier déjà ACTIVATED)', () => {
    expect(peutTransitionnerDepuisPendingValidation('ACTIVATED')).toBe(false);
  });

  it('refuse de réinscrire ou rejeter un dossier déjà REJECTED', () => {
    expect(peutTransitionnerDepuisPendingValidation('REJECTED')).toBe(false);
  });
});

describe('peutSoumettreFormulaire', () => {
  it('autorise la soumission uniquement depuis LINK_SENT', () => {
    expect(peutSoumettreFormulaire('LINK_SENT')).toBe(true);
  });

  it('refuse la soumission depuis les autres statuts (déjà soumis, expiré, etc.)', () => {
    const autresStatuts = ['DRAFT', 'SUBMITTED', 'VALIDATED', 'ACTIVATED', 'REJECTED', 'EXPIRED'] as const;
    for (const statut of autresStatuts) {
      expect(peutSoumettreFormulaire(statut)).toBe(false);
    }
  });
});
