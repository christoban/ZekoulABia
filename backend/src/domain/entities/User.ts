/**
 * DOMAIN LAYER — Entité User
 * Représente tout utilisateur de la plateforme ZekoulABia au sein d'un établissement.
 * Rôles : ADMIN, STAFF, TEACHER, PARENT, STUDENT
 */
import type { UserRole, StaffPermissionType, UserAccessMode } from '@domain/types/enums';

export interface UserProps {
  id: string;
  schoolId: string;
  role: UserRole;
  email?: string;
  phone?: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  isActive: boolean;
  mustChangePassword?: boolean;
  refreshTokenVersion: number;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  accessMode?: UserAccessMode;
  // Permissions STAFF (chargées si role === 'STAFF' ou enseignant AP)
  staffPermissions?: StaffPermissionType[];
  // Section STAFF (FR ou EN dans un établissement bilingue)
  staffSectionId?: string;
  // IDs des classes dont l'utilisateur est Professeur Principal
  professorPrincipalClassIds?: string[];
}

export interface CreerUserProps {
  schoolId: string;
  role: UserRole;
  email?: string;
  phone?: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  mustChangePassword?: boolean;
  accessMode?: UserAccessMode;
  staffPermissions?: StaffPermissionType[];
  staffSectionId?: string;
  professorPrincipalClassIds?: string[];
}

export class User {
  private constructor(private readonly props: UserProps) {}

  // --- Factories ---

  static create(props: CreerUserProps): User {
    if (!props.firstName?.trim()) throw new Error('Le prénom est obligatoire');
    if (!props.lastName?.trim()) throw new Error('Le nom est obligatoire');
    if (!props.email && !props.phone) {
      throw new Error('Un email ou un numéro de téléphone est obligatoire');
    }
    return new User({
      ...props,
      id: crypto.randomUUID(),
      isActive: true,
      mustChangePassword: props.mustChangePassword ?? false,
      refreshTokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstituer(props: UserProps): User {
    return new User(props);
  }

  // --- Getters ---

  get id(): string { return this.props.id; }
  get schoolId(): string { return this.props.schoolId; }
  get role(): UserRole { return this.props.role; }
  get email(): string | undefined { return this.props.email; }
  get phone(): string | undefined { return this.props.phone; }
  get firstName(): string { return this.props.firstName; }
  get lastName(): string { return this.props.lastName; }
  get isActive(): boolean { return this.props.isActive; }
  get mustChangePassword(): boolean { return this.props.mustChangePassword ?? false; }
  get accessMode(): UserAccessMode { return this.props.accessMode ?? 'FULL_ACCESS'; }
  get staffPermissions(): StaffPermissionType[] { return this.props.staffPermissions ?? []; }
  get nomComplet(): string { return `${this.props.firstName} ${this.props.lastName}`; }

  // --- Méthodes de rôle ---

  estAdmin(): boolean { return this.props.role === 'ADMIN'; }
  estStaff(): boolean { return this.props.role === 'STAFF'; }
  estEnseignant(): boolean { return this.props.role === 'TEACHER'; }
  estParent(): boolean { return this.props.role === 'PARENT'; }
  estEleve(): boolean { return this.props.role === 'STUDENT'; }

  aPermission(permission: StaffPermissionType): boolean {
    if (this.estAdmin()) return true; // L'admin a toutes les permissions
    return this.props.staffPermissions?.includes(permission) ?? false;
  }

  // Vrai si l'utilisateur est Animateur Pédagogique (AP / HOD)
  estAP(): boolean {
    return this.aPermission('SUPERVISE_TEACHERS') || this.aPermission('SUPERVISE_DEPARTMENT_TEACHERS');
  }

  // Vrai si l'utilisateur est Professeur Principal (optionnel : d'une classe spécifique)
  estProfesseurPrincipal(classeId?: string): boolean {
    const ids = this.props.professorPrincipalClassIds ?? [];
    if (classeId !== undefined) return ids.includes(classeId);
    return ids.length > 0;
  }

  // --- Méthodes métier ---

  desactiver(): void {
    if (!this.props.isActive) throw new Error('Cet utilisateur est déjà inactif');
    this.props.isActive = false;
    this.props.updatedAt = new Date();
  }

  invaliderTokens(): void {
    this.props.refreshTokenVersion += 1;
    this.props.updatedAt = new Date();
  }

  enregistrerConnexion(): void {
    this.props.lastLogin = new Date();
    this.props.updatedAt = new Date();
  }

  autoriserAccesComplet(): void {
    if (this.props.role !== 'STUDENT' && this.props.role !== 'PARENT') {
      throw new Error('Seuls les comptes élèves et parents peuvent être basculés en accès complet via cette action.');
    }
    this.props.accessMode = 'FULL_ACCESS';
    this.props.mustChangePassword = true;
    this.props.refreshTokenVersion += 1;
    this.props.updatedAt = new Date();
  }

  // --- Sérialisation ---

  toObject(): UserProps {
    return { ...this.props };
  }
}
