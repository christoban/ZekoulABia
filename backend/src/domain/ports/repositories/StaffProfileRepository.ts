/**
 * DOMAIN LAYER — Port Repository StaffProfile (désignation AP / HOD)
 * Opérations liées à la désignation d'un enseignant comme Animateur Pédagogique.
 */
import type { StaffPermissionType } from '@domain/types/enums';

export interface UserPourDesignationAP {
  id: string;
  role: string;
  schoolId: string;
  firstName: string;
  lastName: string;
}

export interface StaffProfileRepository {
  findUserPourDesignationAP(userId: string): Promise<UserPourDesignationAP | null>;
  /** ASSIGN — tx atomique : upsert StaffProfile + permissions + teacherProfile.supervisedSubjectIds. */
  assignerAP(userId: string, schoolId: string, permissions: StaffPermissionType[], departmentSubjectIds: string[]): Promise<void>;
  /** REMOVE — tx atomique : retire permissions, supprime le profil si vide, vide supervisedSubjectIds. */
  retirerAP(userId: string, permissions: StaffPermissionType[]): Promise<void>;
  /** Retourne les userId des conseillers d'orientation (permission MANAGE_ORIENTATION) pour une école. */
  findConseillersOrientation(schoolId: string): Promise<string[]>;
  /** Inngest — relance validation notes : censeurs (permission VALIDATE_GRADES) */
  findCenseurs(schoolId: string): Promise<Array<{ userId: string; email: string | null; firstName: string }>>;
  /** HR — code de section d'un employé (sectionId nullable si aucun profil staff). */
  findSectionIdByUserId(userId: string): Promise<string | null>;
}
