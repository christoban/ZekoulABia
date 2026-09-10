import { User } from '@domain/entities/User';
import type { UserRepository, EmployeeDetail } from '@domain/ports/repositories/UserRepository';
import type { UserRole } from '@domain/types/enums';

export class InMemoryUserRepository implements UserRepository {
  private store = new Map<string, User>();
  private classesParEleve = new Map<string, string>();
  private parentsParEleve = new Map<string, Set<string>>();
  private utilisateursSupprimes = new Set<string>();
  profilsSauvegardes = new Map<string, {
    staffTitle?: string;
    subjectIds?: string[];
    departmentIds?: string[];
    classeId?: string;
    parentOfStudentIds?: string[];
  }>();

  ajouter(user: User): void {
    this.store.set(user.id, user);
  }

  definirClasseEleve(studentId: string, classId: string): void {
    this.classesParEleve.set(studentId, classId);
  }

  definirParentsEleve(studentId: string, parentIds: string[]): void {
    this.parentsParEleve.set(studentId, new Set(parentIds));
  }

  private estActif(user: User): boolean {
    return !this.utilisateursSupprimes.has(user.id);
  }

  async findById(id: string): Promise<User | null> {
    const user = this.store.get(id);
    return user && this.estActif(user) ? user : null;
  }

  async findByEmail(email: string, schoolId: string): Promise<User | null> {
    return [...this.store.values()].find(
      u => u.email === email && u.schoolId === schoolId && this.estActif(u)
    ) ?? null;
  }

  async findByPhone(phone: string, schoolId: string): Promise<User | null> {
    return [...this.store.values()].find(
      u => u.phone === phone && u.schoolId === schoolId && this.estActif(u)
    ) ?? null;
  }

  async findByPhoneContient(phoneFragment: string, schoolId: string): Promise<User | null> {
    return [...this.store.values()].find(
      u => (u.phone ?? '').includes(phoneFragment) && u.schoolId === schoolId && this.estActif(u)
    ) ?? null;
  }

  async findBySchool(schoolId: string): Promise<User[]> {
    return [...this.store.values()].filter(u => u.schoolId === schoolId && this.estActif(u));
  }

  async findByRole(schoolId: string, role: UserRole): Promise<User[]> {
    return [...this.store.values()].filter(
      u => u.schoolId === schoolId && u.role === role && this.estActif(u)
    );
  }

  async findActiveByRoles(schoolId: string, roles: UserRole[]): Promise<{ id: string }[]> {
    return [...this.store.values()]
      .filter(u => u.schoolId === schoolId && roles.includes(u.role) && u.isActive && this.estActif(u))
      .map(u => ({ id: u.id }));
  }

  async findByClass(schoolId: string, classId: string): Promise<User[]> {
    return [...this.store.values()].filter(
      user =>
        user.schoolId === schoolId &&
        user.role === 'STUDENT' &&
        this.classesParEleve.get(user.id) === classId &&
        this.estActif(user)
    );
  }

  async findEmployeeById(userId: string, schoolId: string): Promise<EmployeeDetail | null> {
    const u = this.store.get(userId);
    if (!u || u.schoolId !== schoolId || (u.role !== 'TEACHER' && u.role !== 'STAFF')) return null;
    return this.toEmployee(u);
  }

  async findEmployees(schoolId: string, activeOnly = false): Promise<EmployeeDetail[]> {
    return [...this.store.values()]
      .filter(u => u.schoolId === schoolId && (u.role === 'TEACHER' || u.role === 'STAFF') && (!activeOnly || u.isActive))
      .map(u => this.toEmployee(u));
  }

  private toEmployee(user: User): EmployeeDetail {
    const p = user.toObject();
    return { id: p.id, firstName: p.firstName, lastName: p.lastName, email: p.email ?? null, phone: p.phone ?? null, role: p.role, createdAt: p.createdAt, updatedAt: p.updatedAt };
  }

  async existsByEmail(email: string, schoolId: string): Promise<boolean> {
    return [...this.store.values()].some(
      u => u.email === email && u.schoolId === schoolId && this.estActif(u)
    );
  }

  async save(user: User): Promise<void> {
    this.store.set(user.id, user);
  }

  async update(user: User): Promise<void> {
    this.store.set(user.id, user);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async findByIdWithRefreshVersion(id: string): Promise<{ user: User; refreshTokenVersion: number } | null> {
    const user = this.store.get(id);
    if (!user) return null;
    return { user, refreshTokenVersion: user.toObject().refreshTokenVersion };
  }

  async authentifier(email: string, schoolId: string, _plainPassword: string, role?: string): Promise<User | null> {
    return [...this.store.values()].find(
      u => u.email === email && u.schoolId === schoolId && this.estActif(u) && (!role || u.role === role)
    ) ?? null;
  }

  async listerRolesAvecMotDePasse(email: string, schoolId: string, _plainPassword: string): Promise<string[]> {
    return [...this.store.values()]
      .filter(u => u.email === email && u.schoolId === schoolId && this.estActif(u))
      .map(u => u.role);
  }

  async findMatchingAccountsByEmailPassword(email: string, _plainPassword: string): Promise<Array<{ userId: string; schoolId: string; role: string; schoolName: string; schoolSubdomain: string; nomComplet: string }>> {
    // In-memory: return all users with matching email (password check simplified for tests)
    return [...this.store.values()]
      .filter(u => u.email === email && this.estActif(u))
      .map(u => ({
        userId: u.id,
        schoolId: u.schoolId,
        role: u.role,
        schoolName: u.schoolId, // Simplified for in-memory
        schoolSubdomain: u.schoolId,
        nomComplet: `${u.firstName} ${u.lastName}`.trim(),
      }));
  }

  async saveAvecProfil(user: User, profilData: {
    passwordHash: string;
    staffTitle?: string;
    specializations?: string[];
    subjectIds?: string[];
    departmentIds?: string[];
    classeId?: string;
    dateOfBirth?: Date;
    gender?: string;
    parentOfStudentIds?: string[];
  }): Promise<void> {
    this.store.set(user.id, user);
    this.profilsSauvegardes.set(user.id, {
      staffTitle: profilData.staffTitle,
      subjectIds: profilData.subjectIds,
      departmentIds: profilData.departmentIds,
      classeId: profilData.classeId,
      parentOfStudentIds: profilData.parentOfStudentIds,
    });

    if (profilData.classeId !== undefined) {
      this.classesParEleve.set(user.id, profilData.classeId);
    }
  }

  async mettreAJourAvecProfil(userId: string, data: {
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
  }): Promise<void> {
    const user = this.store.get(userId);
    if (!user) {
      throw new Error('Utilisateur introuvable');
    }

    const props = user.toObject();
    this.store.set(
      userId,
      User.reconstituer({
        ...props,
        firstName: data.firstName ?? props.firstName,
        lastName: data.lastName ?? props.lastName,
        phone: data.phone ?? props.phone,
        avatarUrl: data.avatarUrl ?? props.avatarUrl,
        email: data.email ?? props.email,
        isActive: data.isActive ?? props.isActive,
      })
    );

    if (data.classeId !== undefined) {
      this.classesParEleve.set(userId, data.classeId);
    }
  }

  async supprimerAvecCascade(userId: string): Promise<void> {
    if (!this.store.has(userId)) {
      throw new Error('Utilisateur introuvable');
    }
    this.utilisateursSupprimes.add(userId);
  }

  async restaurer(userId: string): Promise<void> {
    if (!this.store.has(userId)) {
      throw new Error('Utilisateur introuvable');
    }
    this.utilisateursSupprimes.delete(userId);
  }

  async listerSupprimes(schoolId: string) {
    return [...this.store.values()]
      .filter(u => u.schoolId === schoolId && !this.estActif(u))
      .map(u => ({
        id: u.id, role: u.role, firstName: u.firstName, lastName: u.lastName,
        email: u.email ?? null, deletedAt: null, deletedById: null,
      }));
  }

  async trouverSupprime(id: string, schoolId: string): Promise<{ id: string } | null> {
    const u = this.store.get(id);
    return u && u.schoolId === schoolId && !this.estActif(u) ? { id: u.id } : null;
  }

  async findByIds(ids: string[]) {
    return [...this.store.values()].filter(u => ids.includes(u.id)).map(u => ({ id: u.id, firstName: u.firstName, lastName: u.lastName }));
  }

  async transfererEleve(params: {
    studentId: string;
    fromClasseId: string;
    toClasseId: string;
    demandeurId: string;
    schoolId: string;
  }): Promise<void> {
    const user = this.store.get(params.studentId);
    if (!user) {
      throw new Error('Élève introuvable');
    }
    if (user.schoolId !== params.schoolId || user.role !== 'STUDENT') {
      throw new Error('Élève introuvable');
    }

    this.classesParEleve.set(params.studentId, params.toClasseId);
  }

  async findEmailsParentsParEleve(studentId: string): Promise<string[]> {
    const parentIds = this.parentsParEleve.get(studentId) ?? new Set();

    return [...this.store.values()]
      .filter(user => parentIds.has(user.id) && user.email !== undefined && this.estActif(user))
      .map(user => user.email!);
  }

  async findStudentsForBulletinGeneration(
    schoolId: string,
    filters: { classId?: string | null; studentId?: string | null },
  ): Promise<Array<{ id: string; firstName: string; lastName: string; email: string | null; classId: string | null }>> {
    return [...this.store.values()]
      .filter(u => u.schoolId === schoolId && u.role === 'STUDENT' && this.estActif(u) && u.isActive)
      .filter(u => !filters.studentId || u.id === filters.studentId)
      .filter(u => !filters.classId || this.classesParEleve.get(u.id) === filters.classId)
      .map(u => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email ?? null,
        classId: this.classesParEleve.get(u.id) ?? null,
      }));
  }

  async findStudentNotificationContext(
    studentId: string,
  ): Promise<{ id: string; firstName: string; lastName: string; email: string | null; sectionCode: string | null; parents: Array<{ email: string; userId: string }> } | null> {
    const student = this.store.get(studentId);
    if (!student || !this.estActif(student)) return null;
    const parentIds = this.parentsParEleve.get(studentId) ?? new Set();
    const parents = [...this.store.values()]
      .filter(u => parentIds.has(u.id) && u.email && this.estActif(u))
      .map(u => ({ email: u.email!, userId: u.id }));
    // sectionCode non suivi en mémoire (pas de SectionRepository simulé) — null
    return {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email ?? null,
      sectionCode: null,
      parents,
    };
  }

  private authData = new Map<string, { mfaEnabled: boolean; mfaSecret: string | null; mfaTempSecret: string | null; mfaRecoveryCodeHashes: string[] }>();

  async findAuthDataById(id: string) {
    const base = this.store.get(id);
    const extra = this.authData.get(id);
    if (!base) return null;
    return {
      id: base.id,
      email: base.email ?? null,
      isActive: base.isActive,
      loginEmailOtpHash: null,
      loginEmailOtpExpiresAt: null,
      loginEmailOtpAttempts: 0,
      mfaEnabled: extra?.mfaEnabled ?? false,
      mfaSecret: extra?.mfaSecret ?? null,
      mfaTempSecret: extra?.mfaTempSecret ?? null,
      mfaRecoveryCodeHashes: extra?.mfaRecoveryCodeHashes ?? [],
    };
  }
  async saveLoginEmailOtp(_id: string, _data: { hash: string; expiresAt: Date }): Promise<void> {}
  async incrementLoginEmailOtpAttempts(_id: string): Promise<void> {}
  async clearLoginEmailOtp(_id: string): Promise<void> {}
  async updateMfaRecoveryCodeHashes(id: string, hashes: string[]): Promise<void> {
    const cur = this.authData.get(id) ?? { mfaEnabled: false, mfaSecret: null, mfaTempSecret: null, mfaRecoveryCodeHashes: [] };
    this.authData.set(id, { ...cur, mfaRecoveryCodeHashes: hashes });
  }
  async updateMfaTempSecret(id: string, secret: string | null): Promise<void> {
    const cur = this.authData.get(id) ?? { mfaEnabled: false, mfaSecret: null, mfaTempSecret: null, mfaRecoveryCodeHashes: [] };
    this.authData.set(id, { ...cur, mfaTempSecret: secret });
  }
  async updateMfa(params: { userId: string; mfaEnabled?: boolean; mfaSecret?: string | null; mfaTempSecret?: string | null; mfaRecoveryCodeHashes?: string[]; mfaRecoveryCodeGeneratedAt?: Date }): Promise<void> {
    const cur = this.authData.get(params.userId) ?? { mfaEnabled: false, mfaSecret: null, mfaTempSecret: null, mfaRecoveryCodeHashes: [] };
    this.authData.set(params.userId, {
      mfaEnabled: params.mfaEnabled ?? cur.mfaEnabled,
      mfaSecret: params.mfaSecret !== undefined ? params.mfaSecret : cur.mfaSecret,
      mfaTempSecret: params.mfaTempSecret !== undefined ? params.mfaTempSecret : cur.mfaTempSecret,
      mfaRecoveryCodeHashes: params.mfaRecoveryCodeHashes ?? cur.mfaRecoveryCodeHashes,
    });
  }
  async isMfaEnabled(id: string): Promise<boolean> {
    return this.authData.get(id)?.mfaEnabled ?? false;
  }
  private passwordHashes = new Map<string, string>();
  private resetTokens = new Map<string, { hash: string; expiry: Date }>();

  async creerJetonReinitialisation(userId: string, tokenHash: string, expiry: Date): Promise<void> {
    this.resetTokens.set(userId, { hash: tokenHash, expiry });
  }
  async trouverParJetonReinitialisation(tokenHash: string): Promise<User | null> {
    for (const [userId, data] of this.resetTokens) {
      if (data.hash === tokenHash && data.expiry > new Date()) return this.store.get(userId) ?? null;
    }
    return null;
  }
  async reinitialiserMotDePasse(tokenHash: string, passwordHash: string): Promise<void> {
    for (const [userId, data] of this.resetTokens) {
      if (data.hash === tokenHash && data.expiry > new Date()) {
        this.passwordHashes.set(userId, passwordHash);
        this.resetTokens.delete(userId);
        return;
      }
    }
    throw new Error('Lien invalide ou expiré. Demandez un nouveau lien.');
  }
  async verifierMotDePasse(userId: string, plainPassword: string): Promise<boolean> {
    const hash = this.passwordHashes.get(userId);
    if (!hash) return false;
    const bcrypt = await import('bcryptjs');
    return bcrypt.compare(plainPassword, hash);
  }
  async mettreAJourMotDePasse(userId: string, passwordHash: string): Promise<void> {
    this.passwordHashes.set(userId, passwordHash);
    this.resetTokens.delete(userId);
  }
  async definirMotDePasseInvitation(userId: string, passwordHash: string): Promise<void> {
    this.passwordHashes.set(userId, passwordHash);
  }
  // helpers de test
  definirMotDePasse(userId: string, plainOrHash: string): void {
    this.passwordHashes.set(userId, plainOrHash);
  }
  definirJetonReinitialisation(userId: string, hash: string, expiry: Date): void {
    this.resetTokens.set(userId, { hash, expiry });
  }
  // helper de test
  definirMfa(id: string, data: Partial<{ mfaEnabled: boolean; mfaSecret: string | null; mfaTempSecret: string | null; mfaRecoveryCodeHashes: string[] }>): void {
    const cur = this.authData.get(id) ?? { mfaEnabled: false, mfaSecret: null, mfaTempSecret: null, mfaRecoveryCodeHashes: [] };
    this.authData.set(id, { ...cur, ...data });
  }
}
