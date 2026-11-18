/**
 * DOMAIN LAYER — Port Repository StudentPortalQuery
 * Encapsule les requêtes du portail élève/parent et du profil utilisateur connecté
 * (/users/me, /users/me/avatar, complétude et mise à jour de profil élève/enfant).
 */
import type { PebsFiliere, SchoolOwnership, UserRole } from '@domain/types/enums';

export interface CurrentUserPortalRaw {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: UserRole;
  isActive: boolean;
  school: {
    id: string;
    name: string;
    subdomain: string;
    type: string;
    ownership: SchoolOwnership;
  } | null;
  teacherProfile: {
    id: string;
    specialization: string[];
    teacherSubjects: Array<{
      subject: { id: string; name: string };
    }>;
  } | null;
  studentProfile: {
    id: string;
    matricule: string | null;
    numeroInterne: string | null;
    dateOfBirth: Date | null;
    gender: string | null;
    photoUrl: string | null;
    healthScore: number | null;
    pebsFiliere: PebsFiliere | null;
    lv2Subject: { id: string; name: string } | null;
    enrollmentsYearScoped: Array<{
      class: {
        id: string;
        name: string;
        level: string | null;
        serie: string | null;
        filiere: string | null;
      };
    }>;
    groupMemberships: Array<{ groupId: string }>;
  } | null;
  staffProfile: { id: string; title: string } | null;
  classesProfessorPrincipal: Array<{
    id: string;
    name: string;
    _count: { enrollments: number };
  }>;
  headedDepartments: Array<{
    id: string;
    name: string;
    color: string;
    subjects: Array<{ id: string; name: string }>;
  }>;
}

export interface Lv2StudentGroupMatch {
  id: string;
  groupSetId: string;
}

export interface StudentCompletenessRaw {
  id: string;
  dateOfBirth: Date | null;
  gender: string | null;
  photoUrl: string | null;
  matricule: string | null;
  lv2SubjectId: string | null;
  pebsFiliere: PebsFiliere | null;
  user: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  };
  enrollmentsYearScoped: Array<{
    class: {
      id: string;
      name: string;
      level: string | null;
      serie: string | null;
      filiere: string | null;
    };
  }>;
  parents: Array<{
    relation: string;
    parentProfile: {
      user: {
        firstName: string;
        lastName: string;
        phone: string | null;
      };
    };
  }>;
  lv2Subject: { id: string; name: string } | null;
}

export interface StudentCycleContext {
  id: string;
  activeClass: { name: string; level: string | null } | null;
}

export interface ParentStudentLinkRecord {
  studentProfileId: string;
  studentUserId: string;
}

export interface StudentProfilePatchData {
  dateOfBirth?: Date | null;
  gender?: string;
  photoUrl?: string | null;
}

export interface StudentPortalQueryRepository {
  findCurrentUserPortalInfo(userId: string): Promise<CurrentUserPortalRaw | null>;
  findLv2StudentGroup(lv2SubjectId: string, schoolId: string): Promise<Lv2StudentGroupMatch | null>;
  syncLv2GroupMembershipAsync(
    studentProfileId: string,
    groupId: string,
    groupSetId: string,
    schoolId: string,
  ): Promise<void>;
  findPebsStudentGroupId(pebsFiliere: PebsFiliere, schoolId: string): Promise<string | null>;
  updateUserAvatar(userId: string, avatarUrl: string | null): Promise<{ id: string; avatarUrl: string | null }>;
  findStudentCompletenessData(userId: string): Promise<StudentCompletenessRaw | null>;
  countLv2Subjects(schoolId: string): Promise<number>;
  findStudentCycleContextByUserId(userId: string): Promise<StudentCycleContext | null>;
  findParentProfileByUserId(userId: string): Promise<{ id: string } | null>;
  findParentStudentLink(parentProfileId: string, studentId: string): Promise<ParentStudentLinkRecord | null>;
  updateStudentContactAndProfile(params: {
    userId: string;
    studentProfileId: string;
    phone?: string;
    profileData: StudentProfilePatchData;
  }): Promise<void>;
}
