import { User } from '@domain/entities/User';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { ImportUtilisateursRepository } from '@domain/ports/repositories/ImportUtilisateursRepository';
import type { CredentialsNotificationPort } from '@domain/ports/services/CredentialsNotificationPort';
import type { EmailService } from '@domain/ports/services/EmailService';
import type { StaffImportRow } from '../dto/ImportUserDtos';
import { getPermissionsPourTitre } from '@domain/rules/StaffPermissionRules';
import { generateTemporaryPassword } from '@domain/services/PasswordGenerator';
import bcrypt from 'bcryptjs';
import type { ImportWarning } from '../ImporterUtilisateursUseCase';

interface Dependencies {
  userRepository: UserRepository;
  importRepository: ImportUtilisateursRepository;
  emailService: EmailService;
  credentialsNotifier?: CredentialsNotificationPort;
}

export async function traiterLigneStaff(
  deps: Dependencies,
  schoolId: string,
  row: StaffImportRow,
  passwordHash: string,
  isDevMode: boolean,
  schoolName: string,
  warnings: ImportWarning[],
  ligne: number,
): Promise<void> {
  const { userRepository, importRepository, emailService } = deps;

  if (!row.nom?.trim()) throw new Error('Nom obligatoire');
  if (!row.prenom?.trim()) throw new Error('Prénom obligatoire');
  if (!row.email?.trim()) throw new Error('Email obligatoire pour le personnel');
  if (!row.fonction?.trim()) throw new Error('Fonction/Titre obligatoire pour le personnel');

  const email = row.email.trim().toLowerCase();

  const existe = await deps.userRepository.existsByEmail(email, schoolId);
  if (existe) throw new Error('Email déjà utilisé');

  const fonction = row.fonction.trim();
  const permissions = getPermissionsPourTitre(fonction);
  if (permissions.length === 0) {
    warnings.push({ ligne, avertissement: `Fonction "${fonction}" non reconnue — aucune permission assignée automatiquement` });
  }

  // Résoudre la section si fournie
  let staffSectionId: string | undefined;
  if (row.section?.trim()) {
    const section = await importRepository.findSectionParNom(schoolId, row.section.trim());
    if (section) {
      staffSectionId = section.id;
    } else {
      warnings.push({ ligne, avertissement: `Section "${row.section.trim()}" introuvable — import continué sans section` });
    }
  }

  const staffUser = User.create({
    schoolId,
    role: 'STAFF',
    email,
    phone: row.telephone?.trim() || undefined,
    firstName: row.prenom.trim(),
    lastName: row.nom.trim(),
    staffPermissions: permissions,
    staffSectionId,
    mustChangePassword: true,
  });

  const temporaryPassword = generateTemporaryPassword();
  const generatedPasswordHash = await bcrypt.hash(temporaryPassword, 10);
  await deps.userRepository.saveAvecProfil(staffUser, {
    passwordHash: generatedPasswordHash,
    staffTitle: fonction,
  });

  if (deps.credentialsNotifier) {
    try {
      await deps.credentialsNotifier.sendCredentials({ schoolId, email, phone: row.telephone?.trim() || null, temporaryPassword, roleLabel: fonction, loginIdentifier: email, schoolName });
    } catch (error) {
      console.error('[Credentials] Échec envoi import staff:', error instanceof Error ? error.message : String(error));
    }
  }
}
