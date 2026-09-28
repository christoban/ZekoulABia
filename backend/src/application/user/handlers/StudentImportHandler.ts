import { User } from '@domain/entities/User';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { StudentGroupSetRepository } from '@domain/ports/repositories/StudentGroupSetRepository';
import type { StudentGroupRepository } from '@domain/ports/repositories/StudentGroupRepository';
import type { StudentGroupMembershipRepository } from '@domain/ports/repositories/StudentGroupMembershipRepository';
import type { ImportUtilisateursRepository } from '@domain/ports/repositories/ImportUtilisateursRepository';
import type { EmailService } from '@domain/ports/services/EmailService';
import type { CredentialsNotificationPort } from '@domain/ports/services/CredentialsNotificationPort';
import { synchroniserAppartenanceLV2, synchroniserAppartenanceProgramme } from '@application/studentGroup/syncGroupMembership';
import type { PebsFiliere } from '@domain/types/enums';
import { parseDateFR } from '../../../shared/date/parseDateFR';
import type { StudentImportRow, ImportRow } from '../dto/ImportUserDtos';
import { generateTemporaryPassword } from '@domain/services/PasswordGenerator';
import bcrypt from 'bcryptjs';

const DEV_PASS = 'chris123456789';

interface Dependencies {
  importRepository: ImportUtilisateursRepository;
  userRepository: UserRepository;
  anneeRepository: AnneeAcademiqueRepository;
  groupSetRepository: StudentGroupSetRepository;
  groupRepository: StudentGroupRepository;
  membershipRepository: StudentGroupMembershipRepository;
  emailService: EmailService;
  credentialsNotifier?: CredentialsNotificationPort;
}

export async function traiterLigneStudent(
  deps: Dependencies,
  schoolId: string,
  row: ImportRow,
  passwordHash: string,
  isDevMode: boolean,
  schoolName: string,
  classeCache: Map<string, string>,
  lv2NameToId: Map<string, string>,
  hasPEBS: boolean,
): Promise<void> {
  if (!row.nom?.trim()) throw new Error('Nom obligatoire');
  if (!row.prenom?.trim()) throw new Error('Prénom obligatoire');

  const email = row.email?.trim().toLowerCase();
  const phone = row.telephone?.trim() || undefined;
  if (!email && !phone) throw new Error('Email ou téléphone obligatoire');

  let classeId: string | undefined;
  if (row.classe?.trim()) {
    classeId = classeCache.get(row.classe.trim());
    if (!classeId) throw new Error(`Classe "${row.classe.trim()}" introuvable`);
  }

  let dateOfBirth: Date | undefined;
  if (row.dateNaissance?.trim()) {
    dateOfBirth = parserDate(row.dateNaissance.trim());
  }

  const gender = parserSexe(row.sexe);

  let parentUserId: string | undefined;
  const parentEmail = row.emailParent?.trim().toLowerCase();
  const parentPhone = row.telephoneParent?.trim();

  if (parentEmail || parentPhone) {
    const existingParentId = await deps.importRepository.findParentParEmailOuTel(schoolId, parentEmail, parentPhone);
    if (existingParentId) {
      parentUserId = existingParentId;
    } else {
      const parentUser = User.create({
        schoolId,
        role: 'PARENT',
        email: parentEmail || undefined,
        phone: parentPhone || undefined,
        firstName: row.prenomParent?.trim() || `Parent de ${row.prenom.trim()}`,
        lastName: row.nomParent?.trim() || row.nom.trim(),
        mustChangePassword: true,
      });
      const parentTemporaryPassword = generateTemporaryPassword();
      await deps.userRepository.saveAvecProfil(parentUser, {
        passwordHash: await bcrypt.hash(parentTemporaryPassword, 10),
      });
      if (deps.credentialsNotifier) {
        try {
          await deps.credentialsNotifier.sendCredentials({ schoolId, email: parentEmail ?? null, phone: parentPhone ?? null, temporaryPassword: parentTemporaryPassword, roleLabel: 'Parent', loginIdentifier: parentEmail || parentPhone || '', schoolName });
        } catch (error) {
          console.error('[Credentials] Échec envoi parent importé:', error instanceof Error ? error.message : String(error));
        }
      }
      parentUserId = parentUser.id;
    }
  }

  let targetUserId: string | undefined;
  let importedProfileId: string | undefined;

  // Vérifier si l'élève existe déjà dans l'établissement
  const existingStudent = await deps.importRepository.findStudentParEmailOuTel(schoolId, email, phone);

  if (existingStudent) {
    targetUserId = existingStudent.userId;
    importedProfileId = existingStudent.studentProfileId;
    // Si l'élève existe déjà, garantir la liaison parent
    if (parentUserId) {
      await deps.importRepository.lierParentStudent(parentUserId, existingStudent.studentProfileId);
    }
  } else {
    // Si l'élève est nouveau, le créer avec sa relation parent
    const studentUser = User.create({
      schoolId,
      role: 'STUDENT',
      email,
      phone,
      firstName: row.prenom.trim(),
      lastName: row.nom.trim(),
      mustChangePassword: true,
    });
    targetUserId = studentUser.id;

    const temporaryPassword = generateTemporaryPassword();
    await deps.userRepository.saveAvecProfil(studentUser, {
      passwordHash: await bcrypt.hash(temporaryPassword, 10),
      classeId,
      dateOfBirth,
      gender,
      parentOfStudentIds: parentUserId ? [parentUserId] : [],
    });
    if (deps.credentialsNotifier) {
      try {
        await deps.credentialsNotifier.sendCredentials({ schoolId, email: email ?? null, phone: phone ?? null, temporaryPassword, roleLabel: 'Élève', loginIdentifier: email || phone || '', schoolName });
      } catch (error) {
        console.error('[Credentials] Échec envoi élève importé:', error instanceof Error ? error.message : String(error));
      }
    }
  }

  const pebsVal = row.pebs?.trim().toUpperCase() ?? '';
  const lv2Val = row.lv2?.trim() ?? '';
  const syncRepos = {
    anneeRepository: deps.anneeRepository,
    groupSetRepository: deps.groupSetRepository,
    groupRepository: deps.groupRepository,
    membershipRepository: deps.membershipRepository,
  };

  // Écrire PEBS et LV2 dans un seul appel (atomicité native — single UPDATE SQL)
  if (pebsVal || lv2Val) {
    if (!importedProfileId && targetUserId) {
      importedProfileId = await deps.importRepository.findStudentProfileId(targetUserId) ?? undefined;
    }

    let resolvedPebs: PebsFiliere | null = null;
    let resolvedLv2: string | null = null;

    if (pebsVal) {
      if (!['FR_PEBS', 'EN_PEBS'].includes(pebsVal)) {
        throw new Error(`Valeur PEBS invalide : "${pebsVal}" (attendu FR_PEBS ou EN_PEBS)`);
      }
      resolvedPebs = pebsVal as PebsFiliere;
    }

    if (lv2Val) {
      const subjectId = lv2NameToId.get(lv2Val.toLowerCase().trim());
      if (!subjectId) {
        throw new Error(`Langue LV2 introuvable : "${lv2Val}" — consultez la liste des langues disponibles dans votre établissement`);
      }
      resolvedLv2 = subjectId;
    }

    // Un seul UPDATEMany = atomicité garantie (pas de transaction nécessaire)
    if (targetUserId) {
      await deps.importRepository.updatePeBSAndLv2(targetUserId, resolvedPebs, resolvedLv2);
    }

    // Sync StudentGroupMembership (opérations idempotentes, hors écriture principale)
    if (resolvedPebs && importedProfileId) {
      await synchroniserAppartenanceProgramme(syncRepos, { schoolId, studentProfileId: importedProfileId, pebsFiliere: resolvedPebs });
    }
    if (resolvedLv2 && importedProfileId) {
      await synchroniserAppartenanceLV2(syncRepos, { schoolId, studentProfileId: importedProfileId, lv2SubjectId: resolvedLv2 });
    }
  }

}

function parserSexe(sexe?: string): string | undefined {
  const v = sexe?.trim().toUpperCase();
  if (!v) return undefined;
  if (['F', 'FEMALE', 'FEMININ', 'FÉMININ', 'FEMME', 'FILLE'].includes(v)) return 'F';
  if (['M', 'MALE', 'MASCULIN', 'HOMME', 'GARCON', 'GARÇON'].includes(v)) return 'M';
  throw new Error(`Valeur sexe invalide : "${sexe}" (attendu M ou F)`);
}

function parserDate(dateStr: string): Date {
  const d = parseDateFR(dateStr);
  if (!d) {
    throw new Error(`Date invalide : "${dateStr}" (attendu JJ/MM/AAAA ou AAAA-MM-JJ)`);
  }
  return d;
}