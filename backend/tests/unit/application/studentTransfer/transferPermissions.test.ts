import { describe, expect, it } from 'bun:test';
import { getPermissionsPourTitre } from '../../../../src/domain/rules/StaffPermissionRules.ts';

describe('permissions de transfert élève', () => {
  it('autorise la secrétaire à créer une demande', () => {
    expect(getPermissionsPourTitre('Secrétaire')).toContain('TRANSFER_REQUEST');
    expect(getPermissionsPourTitre('School Secretary')).toContain('TRANSFER_REQUEST');
  });

  it('autorise le censeur et le conseiller à consulter le dossier transféré', () => {
    expect(getPermissionsPourTitre('Censeur')).toContain('TRANSFER_DOSSIER_VIEW');
    expect(getPermissionsPourTitre("Conseiller d'Orientation")).toContain('TRANSFER_DOSSIER_VIEW');
    expect(getPermissionsPourTitre('Guidance Counsellor')).toContain('TRANSFER_DOSSIER_VIEW');
    expect(getPermissionsPourTitre('Conseiller Pédagogique')).toContain('TRANSFER_DOSSIER_VIEW');
    expect(getPermissionsPourTitre('Pedagogic Coordinator')).toContain('TRANSFER_DOSSIER_VIEW');
  });

  it('ne donne pas l’approbation source aux titres de consultation', () => {
    expect(getPermissionsPourTitre('Secrétaire')).not.toContain('TRANSFER_APPROVE');
    expect(getPermissionsPourTitre('Censeur')).not.toContain('TRANSFER_APPROVE');
  });
});
