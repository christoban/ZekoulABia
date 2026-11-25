// src/application/shared/studentEnrollment.ts

import type { EnrollmentRepository, ChangerClasseParams } from '@domain/ports/repositories/EnrollmentRepository';
import type { PebsFiliere } from '@domain/types/enums';

/**
 * Utilitaires de requête pour les inscriptions (Enrollment).
 *
 * Les `where*` sont des fragments de where Prisma purs (pas de dépendance PrismaClient).
 * Les fonctions d'écriture acceptent `EnrollmentRepository` pour respecter l'architecture hexagonale.
 */

// ─── Prisma where-clause helpers (purs, pas de PrismaClient) ─────────────────

/**
 * Fragment de where Prisma pour filtrer les User qui sont élèves
 * dans une classe donnée. À étaler dans un findMany sur User.
 *
 * @example
 * const students = await userRepository.findByClass(schoolId, classId);
 */
export function whereElevesParClasse(classId: string) {
  return {
    studentProfile: {
      enrollmentsYearScoped: {
        some: {
          classId,
          status: 'ACTIVE' as const,
          academicYear: { isCurrent: true },
        },
      },
    },
  } as const;
}

/**
 * Fragment de where Prisma pour filtrer directement les StudentProfile
 * qui sont actifs dans une classe.
 *
 * @example
 * const profiles = await studentProfileRepository.findByClasse(classId);
 */
export function whereProfilesParClasse(classId: string) {
  return {
    enrollmentsYearScoped: {
      some: {
        classId,
        status: 'ACTIVE' as const,
        academicYear: { isCurrent: true },
      },
    },
  } as const;
}

/**
 * Fragment de where Prisma pour filtrer directement les StudentProfile
 * qui sont actifs dans une liste de classes.
 */
export function whereProfilesParClasses(classIds: string[]) {
  return {
    enrollmentsYearScoped: {
      some: {
        classId: { in: classIds },
        status: 'ACTIVE' as const,
        academicYear: { isCurrent: true },
      },
    },
  } as const;
}

// ─── Lecture via EnrollmentRepository ─────────────────────────────────────────

/**
 * ID de la classe actuelle d'un élève (null si aucun enrollment actif).
 */
export async function getClassIdActuelEleve(
  enrollmentRepository: EnrollmentRepository,
  studentId: string,
): Promise<string | null> {
  return enrollmentRepository.getClassIdActuelEleve(studentId);
}

/**
 * Informations sur la classe actuelle d'un élève (null si aucun enrollment actif).
 */
export async function getClasseActuelleEleve(
  enrollmentRepository: EnrollmentRepository,
  studentId: string,
) {
  return enrollmentRepository.getClasseActuelleEleve(studentId);
}

// ─── Écriture via EnrollmentRepository ────────────────────────────────────────

/**
 * Crée un StudentProfile + un Enrollment actif en une seule opération.
 * Pour les tests d'intégration et les scripts de génération de données.
 * Délègue à EnrollmentRepository.creerEleveAvecClasse.
 */
export async function creerEleveAvecClasse(
  enrollmentRepository: EnrollmentRepository,
  params: {
    userId: string;
    classId: string;
    enrolledById: string;
    extraProfileData?: { matricule?: string; matriculeVerifieAt?: Date; gender?: string; dateOfBirth?: Date; pebsFiliere?: PebsFiliere };
  },
) {
  return enrollmentRepository.creerEleveAvecClasse({
    userId: params.userId,
    classId: params.classId,
    enrolledById: params.enrolledById,
    extraProfileData: params.extraProfileData,
  });
}

/**
 * Change la classe d'un seul élève en transaction.
 * Délègue à EnrollmentRepository.changerClasseEleve.
 */
export async function changerClasseEleve(
  enrollmentRepository: EnrollmentRepository,
  params: ChangerClasseParams,
): Promise<void> {
  return enrollmentRepository.changerClasseEleve(params);
}
