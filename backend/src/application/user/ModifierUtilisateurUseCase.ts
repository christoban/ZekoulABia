/**
 * APPLICATION LAYER — Use Case : Modifier un utilisateur
 * Logique extraite de controllers/user.ts → updateUser handler
 *
 * Règles :
 * - Admin peut tout modifier (email, isActive, role, password)
 * - L'utilisateur lui-même ne peut modifier que ses infos de base
 * - Seul l'Admin peut désactiver ou changer l'email
 */
import type { UserRepository } from '@domain/ports/repositories/UserRepository';

export interface ModifierUtilisateurCommande {
  cibleUserId: string;
  demandeurId: string;
  demandeurRole: string;
  schoolId: string;

  // Champs modifiables par tous
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;

  // Champs réservés à l'Admin
  email?: string;
  isActive?: boolean;
  passwordHash?: string;

  // TEACHER : sync matières
  subjectIds?: string[];

  // STUDENT : sync classe
  classeId?: string;
  dateOfBirth?: Date;
  gender?: string;
}

export class ModifierUtilisateurUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(commande: ModifierUtilisateurCommande): Promise<void> {
    const estAdmin = commande.demandeurRole === 'ADMIN';
    const estSoi = commande.demandeurId === commande.cibleUserId;

    if (!estAdmin && !estSoi) {
      throw new Error('Permission refusée : vous ne pouvez modifier que votre propre profil');
    }

    // Champs réservés à l'Admin
    if (!estAdmin) {
      if (commande.email !== undefined) {
        throw new Error("Accès refusé : seul un Admin peut modifier l'email");
      }
      if (commande.isActive !== undefined) {
        throw new Error('Accès refusé : seul un Admin peut activer/désactiver un compte');
      }
      if (commande.passwordHash !== undefined) {
        throw new Error('Utilisez la route dédiée pour changer votre mot de passe');
      }
    }

    const user = await this.userRepository.findById(commande.cibleUserId);
    if (!user) throw new Error('Utilisateur introuvable');

    // Vérifier isolation multi-tenant
    if (user.schoolId !== commande.schoolId) {
      throw new Error('Accès refusé : utilisateur hors de votre établissement');
    }

    await this.userRepository.mettreAJourAvecProfil(commande.cibleUserId, {
      firstName: commande.firstName,
      lastName: commande.lastName,
      phone: commande.phone,
      avatarUrl: commande.avatarUrl,
      email: estAdmin ? commande.email : undefined,
      isActive: estAdmin ? commande.isActive : undefined,
      passwordHash: estAdmin ? commande.passwordHash : undefined,
      subjectIds: commande.subjectIds,
      classeId: commande.classeId,
      dateOfBirth: commande.dateOfBirth,
      gender: commande.gender,
    });
  }
}
