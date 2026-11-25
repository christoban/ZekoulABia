/**
 * DOMAIN LAYER — Règles d'autorisation pour l'anonymat des évaluations
 */

export function canManageAnonymat(params: {
  role: string;
  staffPermissions?: readonly string[];
}): boolean {
  if (params.role === 'ADMIN') return true;
  return (
    params.role === 'STAFF' &&
    (params.staffPermissions?.includes('MANAGE_ANONYMAT') ?? false)
  );
}
