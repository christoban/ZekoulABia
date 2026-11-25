/**
 * Tests de `filterCatalogForUser` — la porte RBAC de l'assistant IA.
 *
 * C'est la fonction qui décide QUELLES actions un utilisateur a le droit d'exécuter. Elle est
 * appelée trois fois dans le pipeline (construction du catalogue offert au modèle, puis
 * re-vérification à l'exécution, puis à la confirmation) : une faille ici ouvrirait des actions
 * à des rôles qui n'y ont pas droit, silencieusement, sans qu'aucun autre test ne s'en aperçoive.
 *
 * Fonction pure → testée directement, sans base ni LLM.
 */
import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import { filterCatalogForUser, type ActionDefinition } from '../../../../src/infrastructure/assistant/catalog/catalogShared.ts';

/** Fabrique une action minimale — seuls les champs qui pèsent sur le filtrage sont paramétrés. */
function action(
  name: string,
  overrides: Partial<Pick<ActionDefinition, 'requiredPermission' | 'allowedRoles' | 'destructive'>> = {},
): ActionDefinition {
  return {
    name,
    description: `Action ${name}`,
    destructive: overrides.destructive ?? false,
    requiredPermission: overrides.requiredPermission ?? null,
    ...(overrides.allowedRoles ? { allowedRoles: overrides.allowedRoles } : {}),
    inputSchema: z.object({}),
    async execute() { return { resultLabel: 'ok' }; },
    async undo() { /* no-op */ },
  } as ActionDefinition;
}

const noms = (actions: ActionDefinition[]) => actions.map(a => a.name).sort();

describe('filterCatalogForUser — catalogue sans allowedRoles (comportement Admin historique)', () => {
  const catalogue = [
    action('action_admin_pure'),                                          // requiredPermission null
    action('action_notes', { requiredPermission: 'VALIDATE_GRADES' }),
    action('action_finance', { requiredPermission: 'MANAGE_FINANCE' }),
  ];

  it('ADMIN voit tout, y compris les actions à permission', () => {
    const resultat = filterCatalogForUser(catalogue, { role: 'ADMIN' });
    expect(noms(resultat)).toEqual(['action_admin_pure', 'action_finance', 'action_notes']);
  });

  it('STAFF ne voit QUE les actions dont il détient la permission', () => {
    const resultat = filterCatalogForUser(catalogue, { role: 'STAFF', permissions: ['VALIDATE_GRADES'] });
    expect(noms(resultat)).toEqual(['action_notes']);
  });

  it("STAFF ne voit JAMAIS une action à requiredPermission null (réservée à l'Admin)", () => {
    const resultat = filterCatalogForUser(catalogue, { role: 'STAFF', permissions: ['VALIDATE_GRADES', 'MANAGE_FINANCE'] });
    expect(noms(resultat)).not.toContain('action_admin_pure');
  });

  it('STAFF sans aucune permission ne voit rien', () => {
    expect(filterCatalogForUser(catalogue, { role: 'STAFF', permissions: [] })).toHaveLength(0);
  });

  it('permissions absentes (undefined) équivaut à aucune permission', () => {
    expect(filterCatalogForUser(catalogue, { role: 'STAFF' })).toHaveLength(0);
  });

  it("un rôle non privilégié (TEACHER/PARENT/STUDENT) ne voit rien sans permission", () => {
    for (const role of ['TEACHER', 'PARENT', 'STUDENT']) {
      expect(filterCatalogForUser(catalogue, { role })).toHaveLength(0);
    }
  });
});

describe('filterCatalogForUser — catalogue avec allowedRoles (actions scopées à un rôle)', () => {
  const catalogue = [
    action('mes_classes', { allowedRoles: ['TEACHER'] }),
    action('mes_notes', { allowedRoles: ['STUDENT', 'PARENT'] }),
    action('staff_avec_perm', { allowedRoles: ['STAFF'], requiredPermission: 'VALIDATE_GRADES' }),
  ];

  it('un rôle listé accède à son action scopée', () => {
    expect(noms(filterCatalogForUser(catalogue, { role: 'TEACHER' }))).toEqual(['mes_classes']);
  });

  it('un rôle NON listé est exclu, même ADMIN', () => {
    // Point subtil et volontaire : une action « mes classes » n'a pas de sens pour un Admin qui
    // consulte les données d'autrui — allowedRoles peut donc légitimement exclure ADMIN.
    const resultat = filterCatalogForUser(catalogue, { role: 'ADMIN' });
    expect(noms(resultat)).not.toContain('mes_classes');
    expect(noms(resultat)).not.toContain('mes_notes');
  });

  it('ADMIN listé dans allowedRoles court-circuite la vérification de permission', () => {
    const catalogueAdminListe = [
      action('action_mixte', { allowedRoles: ['ADMIN', 'STAFF'], requiredPermission: 'MANAGE_FINANCE' }),
    ];
    // ADMIN passe sans détenir MANAGE_FINANCE…
    expect(filterCatalogForUser(catalogueAdminListe, { role: 'ADMIN' })).toHaveLength(1);
    // …mais STAFF ne passe pas sans elle.
    expect(filterCatalogForUser(catalogueAdminListe, { role: 'STAFF', permissions: [] })).toHaveLength(0);
    expect(filterCatalogForUser(catalogueAdminListe, { role: 'STAFF', permissions: ['MANAGE_FINANCE'] })).toHaveLength(1);
  });

  it("STAFF listé mais sans la permission requise reste exclu", () => {
    expect(filterCatalogForUser(catalogue, { role: 'STAFF', permissions: [] })).toHaveLength(0);
    expect(noms(filterCatalogForUser(catalogue, { role: 'STAFF', permissions: ['VALIDATE_GRADES'] })))
      .toEqual(['staff_avec_perm']);
  });

  it('un rôle listé avec requiredPermission null passe sans permission', () => {
    expect(filterCatalogForUser(catalogue, { role: 'PARENT' })).toHaveLength(1);
  });
});

describe('filterCatalogForUser — robustesse', () => {
  it('le rôle est comparé en majuscules (un JWT en minuscules ne contourne pas le filtre)', () => {
    const catalogue = [action('mes_classes', { allowedRoles: ['TEACHER'] })];
    expect(filterCatalogForUser(catalogue, { role: 'teacher' })).toHaveLength(1);
    expect(filterCatalogForUser(catalogue, { role: 'Teacher' })).toHaveLength(1);
  });

  it("un rôle inconnu n'accède ni aux actions Admin, ni aux actions scopées par allowedRoles", () => {
    const catalogue = [
      action('action_admin_pure'),
      action('mes_classes', { allowedRoles: ['TEACHER'] }),
    ];
    expect(filterCatalogForUser(catalogue, { role: 'ROLE_INCONNU', permissions: ['VALIDATE_GRADES'] })).toHaveLength(0);
  });

  /**
   * RÉGRESSION — sur la branche sans `allowedRoles`, le filtre ne vérifiait QUE la permission :
   * n'importe quel rôle la détenant franchissait la porte, alors que le contrat annonce
   * « ADMIN voit tout ; STAFF voit uniquement si requiredPermission correspond ». Ce n'était pas
   * exploitable (seuls les comptes STAFF reçoivent des permissions persistées), mais l'accès se
   * serait ouvert en silence dès qu'une permission aurait été accordée à un autre rôle — par
   * exemple VALIDATE_GRADES à un professeur principal.
   */
  it("un rôle non-STAFF porteur de la permission NE franchit PAS le filtre", () => {
    const catalogue = [action('action_notes', { requiredPermission: 'VALIDATE_GRADES' })];

    for (const role of ['TEACHER', 'PARENT', 'STUDENT']) {
      expect(filterCatalogForUser(catalogue, { role, permissions: ['VALIDATE_GRADES'] })).toHaveLength(0);
    }
    // Le STAFF légitime, lui, passe toujours — la correction ne restreint que les autres rôles.
    expect(filterCatalogForUser(catalogue, { role: 'STAFF', permissions: ['VALIDATE_GRADES'] })).toHaveLength(1);
  });

  it('catalogue vide → résultat vide, sans erreur', () => {
    expect(filterCatalogForUser([], { role: 'ADMIN' })).toHaveLength(0);
  });
});
