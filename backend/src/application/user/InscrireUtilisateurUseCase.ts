/**
 * APPLICATION LAYER — Use Case : Inscrire un utilisateur
 * Logique extraite de controllers/user.ts → register handler
 * Gère la création de tous les types de profils (student/teacher/parent/staff).
 */
import { User } from '@domain/entities/User';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { UserRole, StaffPermissionType } from '@domain/types/enums';
import { getPermissionsPourTitre } from '@domain/rules/StaffPermissionRules';
import type { CredentialsNotificationPort } from '@domain/ports/services/CredentialsNotificationPort';
import type { OutboundMessagingPolicy } from '@domain/ports/services/OutboundMessagingPolicy';
import { generateTemporaryPassword } from '@domain/services/PasswordGenerator';
import bcrypt from 'bcryptjs';

export interface InscrireUtilisateurCommande {
  schoolId: string;
  role: UserRole;
  email?: string;
  phone?: string;
  firstName: string;
  lastName: string;
  passwordHash?: string; // Compatibilité avec les appelants historiques

  // STAFF
  staffTitle?: string;   // "Censeur", "Intendant", etc.
  staffSectionId?: string;
  staffPermissions?: StaffPermissionType[]; // Override manuel si Admin le souhaite

  // TEACHER
  specializations?: string[];
  subjectIds?: string[];

  // STUDENT
  classeId?: string;
  dateOfBirth?: Date;
  gender?: string;

  // PARENT
  parentOfStudentIds?: string[];
}

export interface InscrireUtilisateurResultat {
  userId: string;
  role: UserRole;
  nomComplet: string;
  /**
   * Mode test (réglage plateforme outboundMessagingEnabled désactivé) : le mot de passe
   * temporaire est renvoyé UNE SEULE fois dans la réponse, à qui crée le compte (ADMIN
   * d'école). Jamais stocké en clair — il part en hash bcrypt dans la base.
   */
  motDePasseTemporaire?: string;
}

export class InscrireUtilisateurUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly credentialsNotifier?: CredentialsNotificationPort,
    private readonly politiqueEnvoiSortant?: OutboundMessagingPolicy,
  ) {}

  async execute(commande: InscrireUtilisateurCommande): Promise<InscrireUtilisateurResultat> {
    // 1. Vérifier doublon email/école
    if (commande.email) {
      const existe = await this.userRepository.existsByEmail(
        commande.email, commande.schoolId
      );
      if (existe) {
        throw new Error(
          `Un utilisateur avec l'email "${commande.email}" existe déjà dans cet établissement`
        );
      }
    }

    // 2. Résoudre les permissions STAFF depuis le titre
    let permissions: StaffPermissionType[] = commande.staffPermissions ?? [];
    if (commande.role === 'STAFF' && commande.staffTitle && permissions.length === 0) {
      permissions = getPermissionsPourTitre(commande.staffTitle);
    }

    // 3. Créer l'entité User
    const user = User.create({
      schoolId: commande.schoolId,
      role: commande.role,
      email: commande.email,
      phone: commande.phone,
      firstName: commande.firstName,
      lastName: commande.lastName,
      staffPermissions: permissions,
      staffSectionId: commande.staffSectionId,
      mustChangePassword: true,
    });

    // 4. Sauvegarder avec les données de profil
    const temporaryPassword = generateTemporaryPassword();
    await this.userRepository.saveAvecProfil(user, {
      passwordHash: await bcrypt.hash(temporaryPassword, 10),
      staffTitle: commande.staffTitle,
      specializations: commande.specializations,
      subjectIds: commande.subjectIds,
      classeId: commande.classeId,
      dateOfBirth: commande.dateOfBirth,
      gender: commande.gender,
      parentOfStudentIds: commande.parentOfStudentIds,
    });

    if (this.credentialsNotifier) {
      try {
        await this.credentialsNotifier.sendCredentials({
          schoolId: commande.schoolId,
          email: commande.email ?? null,
          phone: commande.phone ?? null,
          temporaryPassword,
          roleLabel: commande.role === 'STAFF' ? commande.staffTitle ?? 'Staff' : commande.role,
          loginIdentifier: commande.email ?? commande.phone ?? '',
        });
      } catch (error) {
        console.error('[Credentials] Échec envoi après création:', error instanceof Error ? error.message : String(error));
      }
    }

    const envoiSortantActif = this.politiqueEnvoiSortant
      ? await this.politiqueEnvoiSortant.estActive()
      : true;

    return {
      userId: user.id,
      role: user.role,
      nomComplet: user.nomComplet,
      motDePasseTemporaire: envoiSortantActif ? undefined : temporaryPassword,
    };
  }
}
