// ponytail: 674l → 360l via helpers, single adapter <800l ceiling, split when 2nd impl or >800l
import type { PrismaClient } from '@prisma/client';
import { User } from '@domain/entities/User';
import type { UserRepository, AuthUserData, EmployeeDetail } from '@domain/ports/repositories/UserRepository';
import type { StaffPermissionType, UserRole } from '@domain/types/enums';
import { whereElevesParClasse } from '@application/shared/studentEnrollment';

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private readonly staffInclude = { staffProfile: { include: { permissions: true } } } as const;
  private readonly employeeSelect: any = {
    id: true, firstName: true, lastName: true, email: true, phone: true, role: true, createdAt: true, updatedAt: true,
    teacherProfile: { select: { id: true, specialization: true, supervisedSubjectIds: true } },
    staffProfile: { select: { id: true, title: true, sectionId: true } },
    school: { select: { id: true, name: true, subsystem: true } },
  };
  private toDomainList(data: any[]): User[] { return data.map((item) => this.toDomain(item)); }
  private async findDomain(where: any): Promise<User | null> {
    const data = await this.prisma.user.findFirst({ where, include: this.staffInclude });
    return data ? this.toDomain(data) : null;
  }
  private async patchUser(id: string, data: any): Promise<void> { await this.prisma.user.update({ where: { id }, data }); }
  private async assertUserExists(id: string): Promise<void> {
    const u = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!u) throw new Error('Utilisateur introuvable');
  }
  private async compareHash(plain: string, hash: string): Promise<boolean> {
    const bcrypt = await import('bcryptjs');
    return bcrypt.compare(plain, hash);
  }
  private baseUserData(d: ReturnType<User['toObject']>) {
    return { id: d.id, schoolId: d.schoolId, role: d.role, email: d.email, phone: d.phone, firstName: d.firstName, lastName: d.lastName, avatarUrl: d.avatarUrl, isActive: d.isActive, mustChangePassword: d.mustChangePassword, refreshTokenVersion: d.refreshTokenVersion, createdAt: d.createdAt, updatedAt: d.updatedAt };
  }

  async findById(id: string): Promise<User | null> { return this.findDomain({ id }); }
  async findByEmail(email: string, schoolId: string): Promise<User | null> { return this.findDomain({ email, schoolId }); }
  async findByPhone(phone: string, schoolId: string): Promise<User | null> { return this.findDomain({ phone, schoolId }); }
  async findByPhoneContient(phoneFragment: string, schoolId: string): Promise<User | null> { return this.findDomain({ phone: { contains: phoneFragment }, schoolId }); }

  async findBySchool(schoolId: string): Promise<User[]> {
    const data = await this.prisma.user.findMany({ where: { schoolId }, include: this.staffInclude });
    return this.toDomainList(data);
  }
  async findByRole(schoolId: string, role: UserRole): Promise<User[]> {
    const data = await this.prisma.user.findMany({ where: { schoolId, role }, include: this.staffInclude });
    return this.toDomainList(data);
  }
  async findActiveByRoles(schoolId: string, roles: UserRole[]): Promise<{ id: string }[]> {
    return this.prisma.user.findMany({
      where: { schoolId, role: { in: roles }, isActive: true },
      select: { id: true },
    });
  }
  async findByClass(schoolId: string, classId: string): Promise<User[]> {
    const data = await this.prisma.user.findMany({ where: { schoolId, role: 'STUDENT', ...whereElevesParClasse(classId) }, include: this.staffInclude });
    return this.toDomainList(data);
  }
  async findEmployeeById(userId: string, schoolId: string): Promise<EmployeeDetail | null> {
    const data = await this.prisma.user.findFirst({
      where: { id: userId, schoolId, role: { in: ['TEACHER', 'STAFF'] } },
      select: this.employeeSelect,
    });
    return data ? (data as unknown as EmployeeDetail) : null;
  }
  async findEmployees(schoolId: string, activeOnly = false): Promise<EmployeeDetail[]> {
    const data = await this.prisma.user.findMany({
      where: { schoolId, role: { in: ['TEACHER', 'STAFF'] }, ...(activeOnly ? { isActive: true } : {}) },
      select: this.employeeSelect,
      orderBy: [{ role: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
    });
    return data as unknown as EmployeeDetail[];
  }
  async existsByEmail(email: string, schoolId: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { email, schoolId } });
    return count > 0;
  }

  async save(user: User): Promise<void> {
    const d = user.toObject();
    await this.prisma.user.create({ data: this.baseUserData(d) });
    if (d.role === 'STAFF' && d.staffPermissions?.length) {
      const staffProfile = await this.prisma.staffProfile.create({ data: { userId: d.id, schoolId: d.schoolId, title: 'STAFF', sectionId: d.staffSectionId } });
      await this.prisma.staffPermission.createMany({ data: d.staffPermissions.map((permission) => ({ staffProfileId: staffProfile.id, permission })) });
    }
  }

  async update(user: User): Promise<void> {
    const d = user.toObject();
    await this.patchUser(d.id, { email: d.email, phone: d.phone, firstName: d.firstName, lastName: d.lastName, avatarUrl: d.avatarUrl, isActive: d.isActive, refreshTokenVersion: d.refreshTokenVersion, lastLogin: d.lastLogin, updatedAt: new Date() });
  }

  async delete(id: string): Promise<void> { await this.prisma.user.delete({ where: { id } }); }

  async findByIdWithRefreshVersion(id: string): Promise<{ user: User; refreshTokenVersion: number } | null> {
    const data = await this.prisma.user.findUnique({ where: { id }, include: this.staffInclude });
    if (!data) return null;
    return { user: this.toDomain(data), refreshTokenVersion: data.refreshTokenVersion };
  }

  async saveAvecProfil(user: User, profilData: { passwordHash: string; staffTitle?: string; specializations?: string[]; subjectIds?: string[]; departmentIds?: string[]; classeId?: string; dateOfBirth?: Date; gender?: string; parentOfStudentIds?: string[] }): Promise<void> {
    const d = user.toObject();
    await this.prisma.user.create({ data: { ...this.baseUserData(d), passwordHash: profilData.passwordHash } });
    if (d.role === 'STUDENT') {
      const studentProfile = await this.prisma.studentProfile.create({ data: { userId: d.id, dateOfBirth: profilData.dateOfBirth ?? null, gender: profilData.gender ?? null } });
      if (profilData.classeId) {
        const classe = await this.prisma.class.findUnique({ where: { id: profilData.classeId }, select: { schoolId: true, academicYearId: true } });
        if (classe) await this.prisma.enrollment.create({ data: { studentId: studentProfile.id, classId: profilData.classeId, academicYearId: classe.academicYearId, schoolId: classe.schoolId, enrolledById: d.id, status: 'ACTIVE' } });
      }
      if (profilData.parentOfStudentIds?.length) {
        for (const parentId of profilData.parentOfStudentIds) {
          const parentProfile = await this.prisma.parentProfile.findFirst({ where: { userId: parentId } });
          if (parentProfile) await this.prisma.parentStudent.create({ data: { parentProfileId: parentProfile.id, studentProfileId: studentProfile.id } });
        }
      }
    }
    if (d.role === 'TEACHER') {
      const teacherProfile = await this.prisma.teacherProfile.create({ data: { userId: d.id, specialization: profilData.specializations ?? [] } });
      if (profilData.subjectIds?.length) await this.prisma.teacherSubject.createMany({ data: profilData.subjectIds.map((subjectId) => ({ teacherProfileId: teacherProfile.id, subjectId })), skipDuplicates: true });
      if (profilData.departmentIds?.length) await this.prisma.teacherDepartment.createMany({ data: profilData.departmentIds.map((departmentId) => ({ teacherProfileId: teacherProfile.id, departmentId })), skipDuplicates: true });
    }
    if (d.role === 'PARENT') await this.prisma.parentProfile.create({ data: { userId: d.id } });
    if (d.role === 'STAFF') {
      const staffProfile = await this.prisma.staffProfile.create({ data: { schoolId: d.schoolId, userId: d.id, title: profilData.staffTitle ?? 'Staff', sectionId: d.staffSectionId ?? null } });
      if (d.staffPermissions?.length) await this.prisma.staffPermission.createMany({ data: d.staffPermissions.map((permission) => ({ staffProfileId: staffProfile.id, permission })), skipDuplicates: true });
    }
  }

  async authentifier(email: string, schoolId: string, plainPassword: string, role?: string): Promise<User | null> {
    const ROLES_CONNUS: UserRole[] = ['ADMIN', 'STAFF', 'TEACHER', 'PARENT', 'STUDENT'];
    if (role !== undefined && !ROLES_CONNUS.includes(role as UserRole)) return null;
    const data = await this.prisma.user.findFirst({ where: { email, schoolId, ...(role ? { role: role as UserRole } : {}) }, include: this.staffInclude });
    if (!data?.passwordHash) return null;
    if (!await this.compareHash(plainPassword, data.passwordHash)) return null;
    return this.toDomain(data);
  }

  async listerRolesAvecMotDePasse(email: string, schoolId: string, plainPassword: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({ where: { email, schoolId, isActive: true }, select: { role: true, passwordHash: true } });
    const resultats = await Promise.all(users.map(async u => (!u.passwordHash || !await this.compareHash(plainPassword, u.passwordHash) ? null : u.role)));
    return resultats.filter((r): r is NonNullable<typeof r> => r !== null) as string[];
  }

  async findMatchingAccountsByEmailPassword(email: string, plainPassword: string): Promise<Array<{ userId: string; schoolId: string; role: string; schoolName: string; schoolSubdomain: string; nomComplet: string }>> {
    const users = await this.prisma.user.findMany({
      where: { email, isActive: true, deletedAt: null },
      include: {
        school: { select: { id: true, name: true, subdomain: true, status: true } },
      },
    });

    const matches: Array<{
      userId: string;
      schoolId: string;
      role: string;
      schoolName: string;
      schoolSubdomain: string;
      nomComplet: string;
    }> = [];

    for (const u of users) {
      if (!u.passwordHash) continue;
      if (!(await this.compareHash(plainPassword, u.passwordHash))) continue;
      // Only include users from active/approved schools
      if (u.school?.status === 'PENDING' || u.school?.status === 'SUSPENDED') continue;
      matches.push({
        userId: u.id,
        schoolId: u.schoolId,
        role: u.role,
        schoolName: u.school.name,
        schoolSubdomain: u.school.subdomain,
        nomComplet: `${u.firstName} ${u.lastName}`.trim(),
      });
    }
    return matches;
  }

  async mettreAJourAvecProfil(userId: string, data: { firstName?: string; lastName?: string; phone?: string; avatarUrl?: string; email?: string; isActive?: boolean; passwordHash?: string; subjectIds?: string[]; classeId?: string; dateOfBirth?: Date; gender?: string }): Promise<void> {
    await this.patchUser(userId, { ...(data.firstName && { firstName: data.firstName }), ...(data.lastName && { lastName: data.lastName }), ...(data.phone !== undefined && { phone: data.phone }), ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }), ...(data.email && { email: data.email }), ...(data.isActive !== undefined && { isActive: data.isActive }), ...(data.passwordHash && { passwordHash: data.passwordHash }), updatedAt: new Date() });
    if (data.subjectIds !== undefined) {
      const teacherProfile = await this.prisma.teacherProfile.findUnique({ where: { userId } });
      if (teacherProfile) {
        await this.prisma.teacherSubject.deleteMany({ where: { teacherProfileId: teacherProfile.id } });
        if (data.subjectIds.length) await this.prisma.teacherSubject.createMany({ data: data.subjectIds.map(subjectId => ({ teacherProfileId: teacherProfile.id, subjectId })) });
      }
    }
    if (data.classeId !== undefined || data.dateOfBirth !== undefined || data.gender !== undefined) {
      await this.prisma.studentProfile.update({ where: { userId }, data: { ...(data.classeId !== undefined && { classId: data.classeId }), ...(data.dateOfBirth !== undefined && { dateOfBirth: data.dateOfBirth }), ...(data.gender !== undefined && { gender: data.gender }) } });
    }
  }

  /**
   * Nom historique ("avecCascade") conservé pour ne pas devoir renommer l'interface du port et
   * ses ~8 doublures InMemory de test — le comportement, lui, a changé du tout au tout (Couche 1,
   * PLAN_IMPLEMENTATION_BACKUP.md) : ceci ne supprime plus RIEN en cascade. `deletedAt` est
   * simplement posé sur la ligne User elle-même ; toutes ses données liées (notes, présences,
   * bulletins, liens parent-élève...) restent intactes et inchangées, invisibles seulement parce
   * que l'écran qui les affiche résout déjà l'élève/enseignant via `user.findUnique` (filtré par
   * softDeleteExtension.ts). Une restauration remet donc tout en état sans rien à reconstruire.
   */
  async supprimerAvecCascade(userId: string, deletedById?: string): Promise<void> {
    await this.assertUserExists(userId);
    await this.patchUser(userId, { deletedAt: new Date(), deletedById: deletedById ?? null });
  }

  async restaurer(userId: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId, deletedAt: { not: null } }, data: { deletedAt: null, deletedById: null } });
  }

  async listerSupprimes(schoolId: string) {
    return this.prisma.user.findMany({
      where: { schoolId, deletedAt: { not: null } },
      select: { id: true, role: true, firstName: true, lastName: true, email: true, deletedAt: true, deletedById: true },
      orderBy: { deletedAt: 'desc' },
    });
  }

  async trouverSupprime(id: string, schoolId: string): Promise<{ id: string } | null> {
    return this.prisma.user.findFirst({ where: { id, schoolId, deletedAt: { not: null } }, select: { id: true } });
  }

  async findByIds(ids: string[]) {
    return this.prisma.user.findMany({ where: { id: { in: ids }, deletedAt: undefined }, select: { id: true, firstName: true, lastName: true } });
  }

  async transfererEleve(params: { studentId: string; fromClasseId: string; toClasseId: string; demandeurId: string; schoolId: string }): Promise<void> {
    const classeCible = await this.prisma.class.findUniqueOrThrow({ where: { id: params.toClasseId }, select: { schoolId: true, academicYearId: true } });
    const profilEleve = await this.prisma.studentProfile.findUniqueOrThrow({ where: { userId: params.studentId }, select: { id: true } });
    await this.prisma.$transaction(async (tx) => {
      await tx.enrollment.updateMany({ where: { studentId: profilEleve.id, status: 'ACTIVE' }, data: { status: 'TRANSFERRED', exitedAt: new Date(), exitReason: 'TRANSFERT_INTERNE' } });
      await tx.enrollment.create({ data: { studentId: profilEleve.id, classId: params.toClasseId, academicYearId: classeCible.academicYearId, schoolId: classeCible.schoolId, enrolledById: params.demandeurId, status: 'ACTIVE' } });
      await tx.studentPromotion.create({ data: { id: crypto.randomUUID(), schoolId: params.schoolId, studentId: profilEleve.id, fromClassId: params.fromClasseId, toClassId: params.toClasseId, academicYearId: 'TRANSFER', promotedById: params.demandeurId, promotedAt: new Date() } });
    });
  }

  async findEmailsParentsParEleve(studentId: string): Promise<string[]> {
    const relations = await this.prisma.parentStudent.findMany({ where: { studentProfile: { userId: studentId } }, include: { parentProfile: { include: { user: { select: { email: true } } } } } });
    return relations.map((r) => r.parentProfile.user.email).filter((email): email is string => !!email);
  }

  async findStudentsForBulletinGeneration(schoolId: string, filters: { classId?: string | null; studentId?: string | null }): Promise<Array<{ id: string; firstName: string; lastName: string; email: string | null; classId: string | null }>> {
    const where: any = { schoolId, role: 'STUDENT' as const, isActive: true, ...(filters.studentId ? { id: filters.studentId } : {}), ...(filters.classId ? whereElevesParClasse(filters.classId) : {}) };
    const data = await this.prisma.user.findMany({ where, select: { id: true, firstName: true, lastName: true, email: true, studentProfile: { select: { enrollmentsYearScoped: { where: { status: 'ACTIVE' as const, academicYear: { isCurrent: true } }, select: { classId: true }, take: 1 } } } } });
    return data.map((u: any) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email ?? null, classId: u.studentProfile?.enrollmentsYearScoped?.[0]?.classId ?? null }));
  }

  async findStudentNotificationContext(studentId: string): Promise<{ id: string; firstName: string; lastName: string; email: string | null; sectionCode: string | null; parents: Array<{ email: string; userId: string }> } | null> {
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        studentProfile: {
          include: {
            enrollmentsYearScoped: { where: { status: 'ACTIVE' as const, academicYear: { isCurrent: true } }, take: 1, include: { class: { select: { section: { select: { code: true } } } } } },
            parents: { include: { parentProfile: { include: { user: { select: { id: true, email: true } } } } } },
          },
        },
      },
    });
    if (!student) return null;
    const sectionCode = (student as any).studentProfile?.enrollmentsYearScoped?.[0]?.class?.section?.code ?? null;
    const parents = ((student as any).studentProfile?.parents ?? []).map((p: any) => p.parentProfile?.user ? { email: p.parentProfile.user.email, userId: p.parentProfile.user.id } : null).filter((r: any): r is { email: string; userId: string } => Boolean(r?.email));
    return { id: student.id, firstName: student.firstName, lastName: student.lastName, email: student.email ?? null, sectionCode, parents };
  }

  async findAuthDataById(id: string): Promise<AuthUserData | null> {
    return this.prisma.user.findUnique({ where: { id }, select: { id: true, email: true, isActive: true, mustChangePassword: true, loginEmailOtpHash: true, loginEmailOtpExpiresAt: true, loginEmailOtpAttempts: true, mfaEnabled: true, mfaSecret: true, mfaTempSecret: true, mfaRecoveryCodeHashes: true } });
  }

  async saveLoginEmailOtp(id: string, data: { hash: string; expiresAt: Date }): Promise<void> { await this.patchUser(id, { loginEmailOtpHash: data.hash, loginEmailOtpExpiresAt: data.expiresAt, loginEmailOtpAttempts: 0, loginEmailOtpSentAt: new Date() }); }
  async incrementLoginEmailOtpAttempts(id: string): Promise<void> { await this.patchUser(id, { loginEmailOtpAttempts: { increment: 1 } }); }
  async clearLoginEmailOtp(id: string): Promise<void> { await this.patchUser(id, { loginEmailOtpHash: null, loginEmailOtpExpiresAt: null, loginEmailOtpAttempts: 0, loginEmailOtpSentAt: null }); }
  async updateMfaRecoveryCodeHashes(id: string, hashes: string[]): Promise<void> { await this.patchUser(id, { mfaRecoveryCodeHashes: hashes, mfaRecoveryCodeGeneratedAt: new Date() }); }
  async updateMfaTempSecret(id: string, secret: string | null): Promise<void> { await this.patchUser(id, { mfaTempSecret: secret }); }
  async updateMfa(params: { userId: string; mfaEnabled?: boolean; mfaSecret?: string | null; mfaTempSecret?: string | null; mfaRecoveryCodeHashes?: string[]; mfaRecoveryCodeGeneratedAt?: Date }): Promise<void> {
    await this.patchUser(params.userId, { ...(params.mfaEnabled !== undefined && { mfaEnabled: params.mfaEnabled }), ...(params.mfaSecret !== undefined && { mfaSecret: params.mfaSecret }), ...(params.mfaTempSecret !== undefined && { mfaTempSecret: params.mfaTempSecret }), ...(params.mfaRecoveryCodeHashes !== undefined && { mfaRecoveryCodeHashes: params.mfaRecoveryCodeHashes }), ...(params.mfaRecoveryCodeGeneratedAt !== undefined && { mfaRecoveryCodeGeneratedAt: params.mfaRecoveryCodeGeneratedAt }) });
  }
  async isMfaEnabled(id: string): Promise<boolean> {
    const row = await this.prisma.user.findUnique({ where: { id }, select: { mfaEnabled: true } });
    return row?.mfaEnabled ?? false;
  }

  async creerJetonReinitialisation(userId: string, tokenHash: string, expiry: Date): Promise<void> { await this.patchUser(userId, { resetPasswordToken: tokenHash, resetPasswordTokenExpiry: expiry }); }
  async trouverParJetonReinitialisation(tokenHash: string): Promise<User | null> {
    const data = await this.prisma.user.findFirst({ where: { resetPasswordToken: tokenHash, resetPasswordTokenExpiry: { gt: new Date() } }, include: this.staffInclude });
    return data ? this.toDomain(data) : null;
  }
  async reinitialiserMotDePasse(tokenHash: string, passwordHash: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { resetPasswordToken: tokenHash, resetPasswordTokenExpiry: { gt: new Date() } }, select: { id: true } });
    if (!user) throw new Error('Lien invalide ou expiré. Demandez un nouveau lien.');
    await this.patchUser(user.id, { passwordHash, mustChangePassword: false, resetPasswordToken: null, resetPasswordTokenExpiry: null, refreshTokenVersion: { increment: 1 } });
  }
  async verifierMotDePasse(userId: string, plainPassword: string): Promise<boolean> {
    const data = await this.prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    if (!data?.passwordHash) return false;
    return this.compareHash(plainPassword, data.passwordHash);
  }
  async mettreAJourMotDePasse(userId: string, passwordHash: string): Promise<void> { await this.patchUser(userId, { passwordHash, mustChangePassword: false, resetPasswordToken: null, resetPasswordTokenExpiry: null, refreshTokenVersion: { increment: 1 } }); }
  async definirMotDePasseInvitation(userId: string, passwordHash: string): Promise<void> { await this.patchUser(userId, { passwordHash, mustChangePassword: false }); }

  private toDomain(data: any): User {
    const permissions: StaffPermissionType[] = data.staffProfile?.permissions?.map((p: { permission: StaffPermissionType }) => p.permission) ?? [];
    return User.reconstituer({ id: data.id, schoolId: data.schoolId, role: data.role as UserRole, email: data.email ?? undefined, phone: data.phone ?? undefined, firstName: data.firstName, lastName: data.lastName, avatarUrl: data.avatarUrl ?? undefined, isActive: data.isActive, mustChangePassword: data.mustChangePassword ?? false, refreshTokenVersion: data.refreshTokenVersion, lastLogin: data.lastLogin ?? undefined, createdAt: data.createdAt, updatedAt: data.updatedAt, staffPermissions: permissions, staffSectionId: data.staffProfile?.sectionId ?? undefined });
  }
}
