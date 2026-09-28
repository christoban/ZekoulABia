import { User } from '@domain/entities/User';
import type { ImportUtilisateursRepository } from '@domain/ports/repositories/ImportUtilisateursRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { EmailService } from '@domain/ports/services/EmailService';
import type { CredentialsNotificationPort } from '@domain/ports/services/CredentialsNotificationPort';
import type { ParentImportRow } from '../dto/ImportUserDtos';
import { generateTemporaryPassword } from '@domain/services/PasswordGenerator';
import bcrypt from 'bcryptjs';
import type { ImportWarning } from '../ImporterUtilisateursUseCase';

interface Dependencies {
  importRepository: ImportUtilisateursRepository;
  userRepository: UserRepository;
  emailService: EmailService;
  credentialsNotifier?: CredentialsNotificationPort;
}

export async function traiterLigneParent(
  deps: Dependencies,
  schoolId: string,
  row: ParentImportRow,
  passwordHash: string,
  isDevMode: boolean,
  schoolName: string,
  warnings: ImportWarning[] = [],
  ligne = 0,
): Promise<void> {
  const { importRepository, userRepository, emailService } = deps;

  if (!row.nom?.trim()) throw new Error('Nom obligatoire');
  if (!row.prenom?.trim()) throw new Error('Prénom obligatoire');
  const email = row.email?.trim().toLowerCase();
  const phone = row.telephone?.trim() || undefined;
  if (!email && !phone) throw new Error('Email ou téléphone obligatoire');

  const studentProfileIds: string[] = [];

  if (row.matriculesEnfants?.trim()) {
    const matricules = row.matriculesEnfants.split(',').map((m) => m.trim()).filter(Boolean);
    const found = await importRepository.findStudentsParMatricules(schoolId, matricules);
    studentProfileIds.push(...found.map((f) => f.studentProfileId));
  }

  if (row.emailsEnfants?.trim()) {
    const emails = row.emailsEnfants.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    const found = await importRepository.findStudentsParEmails(schoolId, emails);
    studentProfileIds.push(...found.map((f) => f.studentProfileId));
  }

  if ((row.matriculesEnfants?.trim() || row.emailsEnfants?.trim()) && studentProfileIds.length === 0) {
    warnings.push({ ligne, avertissement: 'Aucun enfant trouvé pour les matricules ou emails fournis' });
  }

  const existingParentId = await importRepository.findParentParEmailOuTel(schoolId, email, phone);

  if (existingParentId) {
    for (const studentProfileId of studentProfileIds) {
      await importRepository.lierParentStudent(existingParentId, studentProfileId);
    }
  } else {
    const parentUser = User.create({
      schoolId,
      role: 'PARENT',
      email,
      phone,
      firstName: row.prenom.trim(),
      lastName: row.nom.trim(),
      mustChangePassword: true,
    });

    const temporaryPassword = generateTemporaryPassword();
    const generatedPasswordHash = await bcrypt.hash(temporaryPassword, 10);
    await userRepository.saveAvecProfil(parentUser, {
      passwordHash: generatedPasswordHash,
      parentOfStudentIds: studentProfileIds,
    });

    if (deps.credentialsNotifier) {
      try {
        await deps.credentialsNotifier.sendCredentials({ schoolId, email: email ?? null, phone: phone ?? null, temporaryPassword, roleLabel: 'Parent', loginIdentifier: email || phone || '', schoolName });
      } catch (error) {
        console.error('[Credentials] Échec envoi import parent:', error instanceof Error ? error.message : String(error));
      }
    }
  }
}
