import type { UserRole } from '@domain/types/enums';

export function canManageEnrollment(params: {
  role: UserRole | string;
  staffPermissions?: readonly string[];
  adminGereInscriptions?: boolean;
}): boolean {
  if (params.role === 'STAFF' && (params.staffPermissions?.includes('MANAGE_ENROLLMENT') ?? false)) {
    return true;
  }
  if (params.role === 'ADMIN' && (params.adminGereInscriptions ?? false)) {
    return true;
  }
  return false;
}

export function canGererInscriptions(params: {
  role: UserRole | string;
  staffPermissions?: readonly string[];
  adminGereInscriptions?: boolean;
}): boolean {
  return canManageEnrollment(params);
}