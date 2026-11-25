/**
 * APPLICATION LAYER — Use Case : Autoriser la connexion d'un compte élève ou parent (accès complet)
 *
 * Permet à l'Admin ou à un Staff (avec permission MANAGE_ENROLLMENT) de faire passer
 * un compte existant d'un mode restreint (SMS_ONLY, NO_LOGIN) au mode complet (FULL_ACCESS).
 * Génère un mot de passe temporaire, l'enregistre avec mustChangePassword=true,
 * révoque les sessions existantes, notifie l'utilisateur de ses identifiants
 * et enregistre l'action dans le journal d'activité (ActivitiesLog).
 */
import bcrypt from 'bcryptjs';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { CredentialsNotificationPort, CredentialsChannel } from '@domain/ports/services/CredentialsNotificationPort';
import type { ActivityLogPort } from '@domain/ports/services/ActivityLogPort';
import { generateTemporaryPassword } from '@domain/services/PasswordGenerator';

export interface AutoriserConnexionCommande {
  operatorUserId: string;
  operatorRole: string;
  operatorPermissions?: readonly string[];
  schoolId: string;
  targetUserId: string;
}

export interface AutoriserConnexionResultat {
  success: boolean;
  targetUserId: string;
  role: string;
  accessMode: 'FULL_ACCESS';
  channelUtilise: CredentialsChannel;
}

export class AutoriserConnexionUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly schoolRepository: SchoolRepository,
    private readonly credentialsNotifier: CredentialsNotificationPort,
    private readonly activityLog: ActivityLogPort,
  ) {}

  async execute(cmd: AutoriserConnexionCommande): Promise<AutoriserConnexionResultat> {
    const isAdmin = cmd.operatorRole === 'ADMIN';
    const hasEnrollmentPermission = cmd.operatorPermissions?.includes('MANAGE_ENROLLMENT') ?? false;

    if (!isAdmin && !hasEnrollmentPermission) {
      throw new Error('Vous n’avez pas les droits nécessaires pour autoriser la connexion.');
    }

    const school = await this.schoolRepository.findById(cmd.schoolId);
    if (!school) {
      throw new Error('Établissement introuvable');
    }

    const user = await this.userRepository.findById(cmd.targetUserId);
    if (!user || user.schoolId !== cmd.schoolId) {
      throw new Error('Utilisateur introuvable dans cet établissement');
    }

    if (!user.isActive) {
      throw new Error('Impossible d’autoriser la connexion pour un compte inactif');
    }

    user.autoriserAccesComplet();

    const loginIdentifier = user.email ?? user.phone;
    if (!loginIdentifier) {
      throw new Error('L’utilisateur doit posséder au moins une adresse email ou un numéro de téléphone.');
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    await this.userRepository.definirMotDePasseTemporaire(user.id, passwordHash);

    const roleLabel = user.estParent() ? 'Parent' : 'Élève';
    const channelUtilise = await this.credentialsNotifier.sendCredentials({
      schoolId: cmd.schoolId,
      email: user.email ?? null,
      phone: user.phone ?? null,
      temporaryPassword,
      roleLabel,
      loginIdentifier,
      schoolName: school.name,
    });

    await this.activityLog.log({
      userId: cmd.operatorUserId,
      schoolId: cmd.schoolId,
      action: 'USER_ACCESS_MODE_UPDATED',
      details: `Accès direct autorisé pour le compte ${user.nomComplet} (${user.role}) via ${channelUtilise}`,
    });

    return {
      success: true,
      targetUserId: user.id,
      role: user.role,
      accessMode: 'FULL_ACCESS',
      channelUtilise,
    };
  }
}
