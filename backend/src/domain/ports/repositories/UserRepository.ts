/**
 * DOMAIN LAYER — Port Repository User
 * Contrat que toute implémentation (Prisma, mémoire...) doit respecter.
 */
import type { User } from '@domain/entities/User';
import type { UserRole } from '@domain/types/enums';

export interface EmployeeDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  teacherProfile?: { id: string; specialization: string[]; supervisedSubjectIds: string[] } | null;
  staffProfile?: { id: string; title: string | null; sectionId: string | null } | null;
  school?: { id: string; name: string; subsystem: string } | null;
}

/** Données d'authentification d'un compte école (OTP email + MFA). */
export interface AuthUserData {
  id: string;
  email: string | null;
  isActive: boolean;
  mustChangePassword?: boolean;
  loginEmailOtpHash: string | null;
  loginEmailOtpExpiresAt: Date | null;
  loginEmailOtpAttempts: number;
  mfaEnabled: boolean;
  mfaSecret: string | null;
  mfaTempSecret: string | null;
  mfaRecoveryCodeHashes: string[];
}

export interface UserRepository {
  // Lecture
  findById(id: string): Promise<User | null>;
  findByEmail(email: string, schoolId: string): Promise<User | null>;
  findByPhone(phone: string, schoolId: string): Promise<User | null>;
  /** Recherche floue par téléphone (contains) — SMS de présence. */
  findByPhoneContient(phoneFragment: string, schoolId: string): Promise<User | null>;
  findBySchool(schoolId: string): Promise<User[]>;
  findByRole(schoolId: string, role: UserRole): Promise<User[]>;
  /** Destinataires actifs d'une annonce, ciblés par rôle(s) — ids seulement. */
  findActiveByRoles(schoolId: string, roles: UserRole[]): Promise<{ id: string }[]>;

  // Authentification simplifiée — recherche par email + password toutes écoles
  findMatchingAccountsByEmailPassword(
    email: string,
    plainPassword: string,
  ): Promise<Array<{
    userId: string;
    schoolId: string;
    role: string;
    schoolName: string;
    schoolSubdomain: string;
    nomComplet: string;
  }>>;

  // HR — lectures employé (TEACHER/STAFF) avec profils embarqués
  findEmployeeById(userId: string, schoolId: string): Promise<EmployeeDetail | null>;
  findEmployees(schoolId: string, activeOnly?: boolean): Promise<EmployeeDetail[]>;
  /** Élèves (role STUDENT) inscrits dans une classe donnée, via StudentProfile.classId. */
  findByClass(schoolId: string, classId: string): Promise<User[]>;
  existsByEmail(email: string, schoolId: string): Promise<boolean>;

  // Écriture
  save(user: User): Promise<void>;
  update(user: User): Promise<void>;
  delete(id: string): Promise<void>;

  // Spécifique auth
  findByIdWithRefreshVersion(id: string): Promise<{ user: User; refreshTokenVersion: number } | null>;

  // Authentification — bcrypt.compare dans l'adapter Prisma
  // Retourne null si email introuvable OU mot de passe incorrect
  // role optionnel : filtre sur le rôle exact si fourni
  authentifier(email: string, schoolId: string, plainPassword: string, role?: string): Promise<User | null>;

  // Retourne tous les rôles disponibles pour cet email+école SI le mot de passe est correct
  // Utilisé pour détecter un mismatch multi-rôles sans exposer les rôles sans vérification
  listerRolesAvecMotDePasse(email: string, schoolId: string, plainPassword: string): Promise<string[]>;

  // Création avec profil de rôle (student/teacher/parent/staff)
  saveAvecProfil(user: User, profilData: {
    passwordHash: string;
    staffTitle?: string;
    specializations?: string[];
    subjectIds?: string[];
    departmentIds?: string[];
    classeId?: string;
    dateOfBirth?: Date;
    gender?: string;
    parentOfStudentIds?: string[];
  }): Promise<void>;

  // Mise à jour partielle avec sync des sous-profils
  mettreAJourAvecProfil(userId: string, data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatarUrl?: string;
    email?: string;
    isActive?: boolean;
    passwordHash?: string;
    subjectIds?: string[];
    classeId?: string;
    dateOfBirth?: Date;
    gender?: string;
  }): Promise<void>;

  // Suppression douce (Couche 1) — pose deletedAt, ne touche plus aux données liées.
  // Nom historique conservé ("avecCascade"), comportement changé — voir PrismaUserRepository.
  supprimerAvecCascade(userId: string, deletedById?: string): Promise<void>;
  restaurer(userId: string): Promise<void>;

  // Corbeille (Couche 1) — éléments soft-deleted d'une école.
  listerSupprimes(schoolId: string): Promise<Array<{ id: string; role: string; firstName: string; lastName: string; email: string | null; deletedAt: Date | null; deletedById: string | null }>>;
  trouverSupprime(id: string, schoolId: string): Promise<{ id: string } | null>;
  findByIds(ids: string[]): Promise<Array<{ id: string; firstName: string; lastName: string }>>;

  // Transfert d'élève vers une autre classe
  transfererEleve(params: {
    studentId: string;
    fromClasseId: string;
    toClasseId: string;
    demandeurId: string;
    schoolId: string;
  }): Promise<void>;

  /**
   * Retourne les adresses email de tous les parents d'un élève.
   * Utilisé par EnvoyerBulletinsUseCase pour envoyer aux parents, pas à l'élève.
   */
  findEmailsParentsParEleve(studentId: string): Promise<string[]>;

  // Auth OTP email + MFA (LoginEmailOtpUseCase, VerifierMfaConnexionUseCase)
  findAuthDataById(id: string): Promise<AuthUserData | null>;
  saveLoginEmailOtp(id: string, data: { hash: string; expiresAt: Date }): Promise<void>;
  incrementLoginEmailOtpAttempts(id: string): Promise<void>;
  clearLoginEmailOtp(id: string): Promise<void>;
  updateMfaRecoveryCodeHashes(id: string, hashes: string[]): Promise<void>;
  updateMfaTempSecret(id: string, secret: string | null): Promise<void>;
  updateMfa(params: {
    userId: string;
    mfaEnabled?: boolean;
    mfaSecret?: string | null;
    mfaTempSecret?: string | null;
    mfaRecoveryCodeHashes?: string[];
    mfaRecoveryCodeGeneratedAt?: Date;
  }): Promise<void>;
  isMfaEnabled(id: string): Promise<boolean>;

  // Inngest — génération bulletins : requêtes groupées (évite prisma direct dans l'infrastructure)
  findStudentsForBulletinGeneration(
    schoolId: string,
    filters: { classId?: string | null; studentId?: string | null },
  ): Promise<Array<{ id: string; firstName: string; lastName: string; email: string | null; classId: string | null }>>;
  findStudentNotificationContext(
    studentId: string,
  ): Promise<{ id: string; firstName: string; lastName: string; email: string | null; sectionCode: string | null; parents: Array<{ email: string; userId: string }> } | null>;

  // Mot de passe / invitation
  creerJetonReinitialisation(userId: string, tokenHash: string, expiry: Date): Promise<void>;
  trouverParJetonReinitialisation(tokenHash: string): Promise<User | null>;
  reinitialiserMotDePasse(tokenHash: string, passwordHash: string): Promise<void>;
  verifierMotDePasse(userId: string, plainPassword: string): Promise<boolean>;
  mettreAJourMotDePasse(userId: string, passwordHash: string): Promise<void>;
  definirMotDePasseInvitation(userId: string, passwordHash: string): Promise<void>;
}
