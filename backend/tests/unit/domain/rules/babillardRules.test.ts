import { describe, it, expect } from 'bun:test';
import { Publication } from '../../../../src/domain/entities/Publication';
import { peutVoir, type UtilisateurContexte } from '../../../../src/domain/rules/BabillardVisibilityRules';
import {
  peutPublierBabillard,
  peutEpinglerBabillard,
  peutGererToutesPublications,
  peutModifierPublication,
  peutSupprimerPublication,
} from '../../../../src/domain/rules/BabillardPermissionRules';

describe('Babillard — Visibility Rules (peutVoir)', () => {
  const basePub = (override: Partial<ConstructorParameters<typeof Publication>[0]> = {}) =>
    new Publication({
      id: 'pub-1',
      tenantId: 'school-1',
      type: 'ANNONCE',
      titre: 'Communiqué rentrée',
      corps: 'Bienvenue à tous.',
      corpsFormat: 'HTML_SAFE',
      categorie: 'COMMUNIQUE',
      priorite: 'NORMALE',
      audience: { roles: ['STUDENT', 'PARENT', 'TEACHER'] },
      epinglee: false,
      statut: 'PUBLIEE',
      publieeLe: new Date('2026-09-01T08:00:00Z'),
      dureeVisibilite: 'PERMANENT',
      auteurId: 'admin-1',
      piecesJointes: [],
      createdAt: new Date('2026-09-01T08:00:00Z'),
      updatedAt: new Date('2026-09-01T08:00:00Z'),
      ...override,
    });

  it('refuse immédiatement si le tenantId est différent (isolation école)', () => {
    const pub = basePub({ tenantId: 'school-1' });
    const user: UtilisateurContexte = {
      userId: 'u-2',
      schoolId: 'school-OTHER',
      role: 'STUDENT',
    };
    expect(peutVoir(user, pub)).toBe(false);
  });

  it('autorise toujours l’auteur et l’administrateur même sur un brouillon', () => {
    const pub = basePub({ statut: 'BROUILLON', auteurId: 'author-1' });
    const auteur: UtilisateurContexte = { userId: 'author-1', schoolId: 'school-1', role: 'STAFF', titre: 'Censeur' };
    const admin: UtilisateurContexte = { userId: 'admin-99', schoolId: 'school-1', role: 'ADMIN' };
    const autre: UtilisateurContexte = { userId: 'other-1', schoolId: 'school-1', role: 'TEACHER' };

    expect(peutVoir(auteur, pub)).toBe(true);
    expect(peutVoir(admin, pub)).toBe(true);
    expect(peutVoir(autre, pub)).toBe(false);
  });

  it('gère correctement les publications programmées', () => {
    const futureDate = new Date('2026-10-01T10:00:00Z');
    const pub = basePub({
      statut: 'PROGRAMMEE',
      programmeeLe: futureDate,
    });

    const user: UtilisateurContexte = { userId: 'eleve-1', schoolId: 'school-1', role: 'STUDENT' };

    // Avant l'échéance : masqué
    expect(peutVoir(user, pub, { maintenant: new Date('2026-09-20T10:00:00Z') })).toBe(false);

    // Après l'échéance : visible
    expect(peutVoir(user, pub, { maintenant: new Date('2026-10-02T10:00:00Z') })).toBe(true);
  });

  it('filtre selon les rôles de l’audience', () => {
    const pub = basePub({ audience: { roles: ['STUDENT'] } });
    const student: UtilisateurContexte = { userId: 's-1', schoolId: 'school-1', role: 'STUDENT' };
    const teacher: UtilisateurContexte = { userId: 't-1', schoolId: 'school-1', role: 'TEACHER' };

    expect(peutVoir(student, pub)).toBe(true);
    expect(peutVoir(teacher, pub)).toBe(false);
  });

  it('filtre selon les classes ciblées pour les élèves', () => {
    const pub = basePub({
      audience: { roles: ['STUDENT'], classeIds: ['class-3A', 'class-3B'] },
    });

    const eleve3A: UtilisateurContexte = {
      userId: 'el-1',
      schoolId: 'school-1',
      role: 'STUDENT',
      classeIds: ['class-3A'],
    };
    const eleve4A: UtilisateurContexte = {
      userId: 'el-2',
      schoolId: 'school-1',
      role: 'STUDENT',
      classeIds: ['class-4A'],
    };

    expect(peutVoir(eleve3A, pub)).toBe(true);
    expect(peutVoir(eleve4A, pub)).toBe(false);
  });

  it('masque les annonces expirées sauf si inclureArchives est activé', () => {
    const pub = basePub({
      expireLe: new Date('2026-09-10T00:00:00Z'),
    });
    const user: UtilisateurContexte = { userId: 'u-1', schoolId: 'school-1', role: 'STUDENT' };
    const maintenant = new Date('2026-09-15T00:00:00Z');

    expect(peutVoir(user, pub, { maintenant, inclureArchives: false })).toBe(false);
    expect(peutVoir(user, pub, { maintenant, inclureArchives: true })).toBe(true);
  });
});

describe('Babillard — Permission Rules', () => {
  it('accorde la publication à ADMIN et Censeur, refuse aux autres rôles STAFF', () => {
    const admin: UtilisateurContexte = { userId: '1', schoolId: 's', role: 'ADMIN' };
    const censeur: UtilisateurContexte = { userId: '2', schoolId: 's', role: 'STAFF', titre: 'Censeur' };
    const vp: UtilisateurContexte = { userId: '3', schoolId: 's', role: 'STAFF', titre: 'Vice-Principal' };
    const secretaire: UtilisateurContexte = { userId: '4', schoolId: 's', role: 'STAFF', titre: 'Secrétaire' };
    const surveillant: UtilisateurContexte = { userId: '5', schoolId: 's', role: 'STAFF', titre: 'Surveillant Général' };
    const prof: UtilisateurContexte = { userId: '6', schoolId: 's', role: 'TEACHER' };
    const eleve: UtilisateurContexte = { userId: '7', schoolId: 's', role: 'STUDENT' };

    expect(peutPublierBabillard(admin)).toBe(true);
    expect(peutPublierBabillard(censeur)).toBe(true);
    expect(peutPublierBabillard(vp)).toBe(true);

    expect(peutPublierBabillard(secretaire)).toBe(false);
    expect(peutPublierBabillard(surveillant)).toBe(false);
    expect(peutPublierBabillard(prof)).toBe(false);
    expect(peutPublierBabillard(eleve)).toBe(false);
  });

  it('seul ADMIN peut gérer les publications de tiers', () => {
    const admin: UtilisateurContexte = { userId: 'admin', schoolId: 's', role: 'ADMIN' };
    const censeur1: UtilisateurContexte = { userId: 'c1', schoolId: 's', role: 'STAFF', titre: 'Censeur' };
    const censeur2: UtilisateurContexte = { userId: 'c2', schoolId: 's', role: 'STAFF', titre: 'Censeur' };

    expect(peutGererToutesPublications(admin)).toBe(true);
    expect(peutGererToutesPublications(censeur1)).toBe(false);

    // Censeur 1 peut modifier sa propre publication
    expect(peutModifierPublication(censeur1, 'c1')).toBe(true);
    // Censeur 1 ne peut pas modifier celle de Censeur 2
    expect(peutModifierPublication(censeur1, 'c2')).toBe(false);

    // Admin peut modifier celle de Censeur 2
    expect(peutModifierPublication(admin, 'c2')).toBe(true);
  });
});
