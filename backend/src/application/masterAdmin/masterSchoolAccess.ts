import type { MasterAdminQueryRepository } from '@domain/ports/repositories/MasterAdminQueryRepository';

export interface MasterOperatorContext {
  id: string;
  role: string;
  isOwner?: boolean;
  assignedSchoolIds?: string[];
}

export function estSuperAdminMaster(operateur?: MasterOperatorContext | null): boolean {
  return operateur?.role === 'super_admin' || operateur?.role === 'SUPER_ADMIN';
}

export function aVueGlobaleEcolesMaster(operateur?: MasterOperatorContext | null): boolean {
  if (!operateur) return false;
  return (
    estSuperAdminMaster(operateur) ||
    operateur.role === 'platform_admin' ||
    operateur.role === 'PLATFORM_ADMIN'
  );
}

export function peutGererEcoleMaster(
  operateur: MasterOperatorContext | null | undefined,
  schoolId: string,
  createdByMasterId?: string | null,
): boolean {
  if (!operateur) return false;
  if (aVueGlobaleEcolesMaster(operateur)) return true;
  if (operateur.role === 'support' || operateur.role === 'SUPPORT') return false;

  const assigned = operateur.assignedSchoolIds ?? [];
  if (assigned.includes(schoolId)) return true;
  if (createdByMasterId && createdByMasterId === operateur.id) return true;
  return false;
}

export function peutVoirEcoleMaster(
  operateur: MasterOperatorContext | null | undefined,
  schoolId: string,
  createdByMasterId?: string | null,
): boolean {
  if (!operateur) return false;
  if (aVueGlobaleEcolesMaster(operateur)) return true;

  const assigned = operateur.assignedSchoolIds ?? [];
  if (operateur.role === 'support' || operateur.role === 'SUPPORT') {
    return assigned.length === 0 || assigned.includes(schoolId);
  }

  return peutGererEcoleMaster(operateur, schoolId, createdByMasterId);
}

export async function verifierAccesGestionEcoleMaster(
  queryRepo: MasterAdminQueryRepository,
  operateur: MasterOperatorContext | null | undefined,
  schoolId: string,
): Promise<{ autorise: boolean; introuvable?: boolean }> {
  const school = await queryRepo.findSchoolBasic(schoolId);
  if (!school) {
    return { autorise: false, introuvable: true };
  }
  return {
    autorise: peutGererEcoleMaster(operateur, school.id, school.createdByMasterId),
  };
}

