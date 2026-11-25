import { User } from '@domain/entities/User';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { ImportUtilisateursRepository } from '@domain/ports/repositories/ImportUtilisateursRepository';
import type { EmailService } from '@domain/ports/services/EmailService';
import type { CredentialsNotificationPort } from '@domain/ports/services/CredentialsNotificationPort';
import type { TeacherImportRow, ImportRow } from '../dto/ImportUserDtos';
import { generateTemporaryPassword } from '@domain/services/PasswordGenerator';
import bcrypt from 'bcryptjs';

interface Dependencies {
  importRepository: ImportUtilisateursRepository;
  userRepository: UserRepository;
  emailService: EmailService;
  credentialsNotifier?: CredentialsNotificationPort;
}

export async function traiterLigneTeacher(
  deps: Dependencies,
  schoolId: string,
  row: Record<string, string>,
  passwordHash: string,
  isDevMode: boolean,
  schoolName: string,
  classeCache: Map<string, string>,
): Promise<{ ppAssigned: boolean; ppError?: string; affectationsCreees?: number }> {
  const { importRepository, userRepository, emailService } = deps;

  if (!row.nom?.trim()) throw new Error('Nom obligatoire');
  if (!row.prenom?.trim()) throw new Error('Prénom obligatoire');
  if (!row.email?.trim()) throw new Error('Email obligatoire pour les enseignants');

  const email = row.email.trim().toLowerCase();

  const existe = await userRepository.existsByEmail(email, schoolId);
  if (existe) throw new Error('Email déjà utilisé');

  let subjectIds: string[] = [];
  if (row.matieres?.trim()) {
    const matiereNames = row.matieres.split(',').map((m) => m.trim()).filter(Boolean);
    const found = await importRepository.findSubjectsParNoms(schoolId, matiereNames);
    const foundNames = new Set(found.map((s) => s.name));
    const missing = matiereNames.filter((m) => !foundNames.has(m));
    if (missing.length > 0) {
      throw new Error(`Matières introuvables : ${missing.join(', ')}`);
    }
    subjectIds = found.map((s) => s.id);
  }

  let departmentIds: string[] = [];
  if (row.departementAp?.trim()) {
    const departmentNames = row.departementAp.split(',').map((d) => d.trim()).filter(Boolean);
    const found = await importRepository.findDepartmentsParNoms(schoolId, departmentNames);
    const foundNames = new Set(found.map((d) => d.name));
    const missing = departmentNames.filter((d) => !foundNames.has(d));
    if (missing.length > 0) {
      throw new Error(`Départements introuvables : ${missing.join(', ')}`);
    }
    departmentIds = found.map((d) => d.id);
  }

  const teacherUser = User.create({
    schoolId,
    role: 'TEACHER',
    email,
    phone: row.telephone?.trim() || undefined,
    firstName: row.prenom.trim(),
    lastName: row.nom.trim(),
    mustChangePassword: true,
  });

  const temporaryPassword = generateTemporaryPassword();
  const generatedPasswordHash = await bcrypt.hash(temporaryPassword, 10);
  await userRepository.saveAvecProfil(teacherUser, { passwordHash: generatedPasswordHash, subjectIds, departmentIds });

  if (deps.credentialsNotifier) {
    try {
      await deps.credentialsNotifier.sendCredentials({ schoolId, email, phone: row.telephone?.trim() || null, temporaryPassword, roleLabel: 'Enseignant', loginIdentifier: email, schoolName });
    } catch (error) {
      console.error('[Credentials] Échec envoi import enseignant:', error instanceof Error ? error.message : String(error));
    }
  }

  let ppAssigned = false;
  let ppError: string | undefined;
  if (row.classePrincipale?.trim()) {
    const className = row.classePrincipale.trim();
    const classe = await importRepository.findClassePourPP(schoolId, className);
    if (!classe) {
      ppError = `Classe '${className}' introuvable pour classe_principale`;
    } else if (classe.professorPrincipalId) {
      const ppName = await importRepository.findNomProfesseurPrincipal(classe.professorPrincipalId) ?? 'inconnu';
      ppError = `Classe '${className}' a déjà un Professeur Principal (${ppName})`;
    } else {
      const autreClasse = await importRepository.findAutreClasseDePP(teacherUser.id, schoolId, classe.id);
      if (autreClasse) {
        ppError = `Cet enseignant est déjà Professeur Principal de '${autreClasse.name}'. Un enseignant ne peut être PP que d'une seule classe.`;
      } else {
        await importRepository.assignerProfesseurPrincipal(classe.id, teacherUser.id);
        ppAssigned = true;
      }
    }
  }

  let affectationsCreees = 0;
  if (ppAssigned && subjectIds.length > 0 && row.classePrincipale?.trim()) {
    const classe = await importRepository.findClasseProgramme(schoolId, row.classePrincipale.trim());
    if (classe) {
      const codeSerie = classe.serie ?? classe.filiere ?? null;
      const programmSubjectIds = new Set(
        await importRepository.findSubjectsDuProgramme(schoolId, classe.level, codeSerie, classe.id),
      );

      const subjectsInProgramme = subjectIds.filter((id) => programmSubjectIds.has(id));
      if (subjectsInProgramme.length > 0) {
        affectationsCreees = await importRepository.creerAffectations(
          subjectsInProgramme.map((subjectId) => ({
            classId: classe.id,
            subjectId,
            teacherId: teacherUser.id,
            schoolId,
            academicYearId: classe.academicYearId,
          })),
        );
      }
    }
  }

  return { ppAssigned, ppError, affectationsCreees };}
