/**
 * APPLICATION LAYER — Use Case : Connecter un utilisateur
 *
 * Logique extraite de controllers/user.ts → login handler
 * - Vérifie que l'école est ACTIVE ou APPROVED
 * - Auto-active l'école si ADMIN + école APPROVED (premier login)
 * - Récupère les permissions STAFF
 * - Enregistre lastLogin
 *
 * Note : la vérification bcrypt est faite dans l'adapter HTTP avant d'appeler ce use case.
 * Nouveau : résolution multi-comptes par email + password (toutes écoles).
 */
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { TokenService } from '@domain/ports/services/TokenService';
import type { StaffPermissionType } from '@domain/types/enums';

export interface ConnecterUtilisateurCommande {
  email: string;
  plainPassword: string;
  /** Optionnel si résolution par email+password seule */
  schoolId?: string;
  role?: string;
  /** Si l'utilisateur a choisi un compte après multi-match */
  userId?: string;
}

/** Error('ROLE_MISMATCH_MULTIPLE') enrichie d'une liste de rôles candidats. */
export interface RoleMismatchError extends Error {
  availableRoles: string[];
}

/** Error('SCHOOL_SUSPENDED') enrichie d'un code stable pour le contrôleur HTTP. */
export interface SchoolSuspendedError extends Error {
  code: 'SCHOOL_SUSPENDED';
}

/** Error('MULTIPLE_ACCOUNTS') — plusieurs comptes matchent email+password (écoles différentes). */
export interface MultipleAccountsError extends Error {
  code: 'MULTIPLE_ACCOUNTS';
  accounts: Array<{
    userId: string;
    schoolId: string;
    role: string;
    schoolName: string;
    nomComplet: string;
  }>;
}

export interface ConnecterUtilisateurResultat {
  userId: string;
  schoolId: string;
  role: string;
  permissions: StaffPermissionType[];
  nomComplet: string;
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
  roleMismatch?: boolean;
  redirectTo?: string; // présent si l'école était APPROVED → '/admin/configuration'
}

export class ConnecterUtilisateurUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly schoolRepository: SchoolRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(commande: ConnecterUtilisateurCommande): Promise<ConnecterUtilisateurResultat> {
    let schoolId = commande.schoolId;
    let role = commande.role;

    // ── Résolution sans école/rôle fournis ──
    if (!schoolId && !commande.userId) {
      const matches = await this.userRepository.findMatchingAccountsByEmailPassword(
        commande.email,
        commande.plainPassword,
      );

      if (matches.length === 0) {
        throw new Error('Email ou mot de passe incorrect');
      }

      if (matches.length > 1) {
        const err = new Error('MULTIPLE_ACCOUNTS') as MultipleAccountsError;
        err.code = 'MULTIPLE_ACCOUNTS';
        // Ne renvoyer QUE les comptes matchés (pas la liste publique des écoles)
        err.accounts = matches.map(({ userId, schoolId, role, schoolName, nomComplet }) => ({
          userId, schoolId, role, schoolName, nomComplet,
        }));
        throw err;
      }

      // Un seul compte
      schoolId = matches[0].schoolId;
      role = matches[0].role;
    }

    // ── Choix explicite d'un userId (après multi-comptes) ──
    if (commande.userId) {
      const matches = await this.userRepository.findMatchingAccountsByEmailPassword(
        commande.email,
        commande.plainPassword,
      );
      const chosen = matches.find((m) => m.userId === commande.userId);
      if (!chosen) throw new Error('Email ou mot de passe incorrect');
      schoolId = chosen.schoolId;
      role = chosen.role;
    }

    if (!schoolId) throw new Error('Email ou mot de passe incorrect');

    // 1. Charger l'école (nécessaire pour schoolId — pas de vérification de statut ici)
    const school = await this.schoolRepository.findById(schoolId);
    if (!school) throw new Error('École introuvable');

    // 2. Authentifier l'utilisateur EN PREMIER — le statut de l'école ne filtre pas les credentials
    let user = await this.userRepository.authentifier(
      commande.email,
      schoolId,
      commande.plainPassword,
      role,
    );
    let roleMismatch = false;

    if (!user) {
      // Rôle sélectionné incorrect — vérifier les rôles disponibles (mot de passe déjà validé)
      const rolesDisponibles = await this.userRepository.listerRolesAvecMotDePasse(
        commande.email,
        schoolId,
        commande.plainPassword,
      );

      if (rolesDisponibles.length === 0) {
        throw new Error('Email ou mot de passe incorrect');
      }

      if (rolesDisponibles.length > 1) {
        const err = new Error('ROLE_MISMATCH_MULTIPLE') as RoleMismatchError;
        err.availableRoles = rolesDisponibles;
        throw err;
      }

      user = await this.userRepository.authentifier(
        commande.email,
        schoolId,
        commande.plainPassword,
        rolesDisponibles[0],
      );
      roleMismatch = true;
    }

    if (!user || !user.isActive) {
      throw new Error('Email ou mot de passe incorrect');
    }

    // 3. Vérifier le statut de l'école SEULEMENT après validation des credentials
    if (school.estSuspendue()) {
      const err = new Error('SCHOOL_SUSPENDED') as SchoolSuspendedError;
      err.code = 'SCHOOL_SUSPENDED';
      throw err;
    }
    if (school.status !== 'ACTIVE' && school.status !== 'APPROVED') {
      throw new Error("Cet établissement n'est pas encore actif.");
    }

    // 3bis. Premier login Admin sur une école APPROVED → auto-activation (décrit dans le
    // commentaire de classe mais jamais réellement persisté jusqu'ici : School.activer() existe
    // sur l'entité, mais rien n'appelait schoolRepository.update() pour le faire).
    const ecoleVientDetreActivee = user.estAdmin() && school.status === 'APPROVED';
    if (ecoleVientDetreActivee) {
      school.activer();
      await this.schoolRepository.update(school);
    }

    // 4. Enregistrer le dernier login
    user.enregistrerConnexion();
    await this.userRepository.update(user);

    // 5. Générer les tokens
    const tokens = this.tokenService.genererTokens({
      userId: user.id,
      schoolId: user.schoolId,
      role: user.role,
      permissions: user.staffPermissions,
      tokenType: 'access',
    });

    return {
      userId: user.id,
      schoolId: user.schoolId,
      role: user.role,
      permissions: user.staffPermissions,
      nomComplet: user.nomComplet,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      mustChangePassword: user.mustChangePassword,
      roleMismatch,
      // Indique au frontend où rediriger : ADMIN sur école qui vient d'être auto-activée →
      // configuration (school.status vaut déjà 'ACTIVE' à ce stade, d'où le flag capturé plus haut).
      redirectTo: ecoleVientDetreActivee ? '/admin/configuration' : undefined,
    };
  }
}
