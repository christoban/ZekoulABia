import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { StudentGroupSetRepository } from '@domain/ports/repositories/StudentGroupSetRepository';
import type { StudentGroupRepository } from '@domain/ports/repositories/StudentGroupRepository';
import type { StudentGroupMembershipRepository } from '@domain/ports/repositories/StudentGroupMembershipRepository';
import type { ImportUtilisateursRepository } from '@domain/ports/repositories/ImportUtilisateursRepository';
import type { EmailService } from '@domain/ports/services/EmailService';
import type { CredentialsNotificationPort } from '@domain/ports/services/CredentialsNotificationPort';
import type { CreerClasseService } from '@domain/ports/services/CreerClasseService';
import type { ImportTargetType, ImportConfirmResponse } from './dto/ImportUserDtos';
import { traiterLigneStudent } from './handlers/StudentImportHandler';
import { traiterLigneTeacher } from './handlers/TeacherImportHandler';
import { traiterLigneStaff } from './handlers/StaffImportHandler';
import { traiterLigneParent } from './handlers/ParentImportHandler';
import { traiterLigneClasse } from './handlers/ClasseImportHandler';

export interface ImportRow {
  ligne: number;
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  matricule?: string;
  dateNaissance?: string;
  sexe?: string;
  classe?: string;
  nomParent?: string;
  prenomParent?: string;
  emailParent?: string;
  telephoneParent?: string;
  matieres?: string;
  classePrincipale?: string;
  pebs?: string;
  lv2?: string;
}

export interface ImportErreur {
  ligne: number;
  erreur: string;
}

export interface ImportWarning {
  ligne: number;
  avertissement: string;
}

export class ImporterUtilisateursUseCase {
  constructor(
    private readonly importRepository: ImportUtilisateursRepository,
    private readonly userRepository: UserRepository,
    private readonly anneeRepository: AnneeAcademiqueRepository,
    private readonly groupSetRepository: StudentGroupSetRepository,
    private readonly groupRepository: StudentGroupRepository,
    private readonly membershipRepository: StudentGroupMembershipRepository,
    private readonly emailService: EmailService,
    private readonly creerClasseUseCase: CreerClasseService,
    private readonly credentialsNotifier?: CredentialsNotificationPort,
  ) {}

  async execute(
    schoolId: string,
    targetType: ImportTargetType,
    rows: Record<string, string>[],
  ): Promise<{
    total: number;
    success: number;
    professeursPrincipauxAssignes: number;
    affectationsPedagogiquesPreremplies: number;
    classesCrees: number;
    parentsCrees: number;
    staffCrees: number;
    elevesCrees: number;
    enseignantsCrees: number;
    errors: { ligne: number; erreur: string }[];
    warnings: { ligne: number; avertissement: string }[];
  }> {
    const errors: { ligne: number; erreur: string }[] = [];
    const warnings: { ligne: number; avertissement: string }[] = [];
    let success = 0;
    let professeursPrincipauxAssignes = 0;
    let affectationsPedagogiquesPreremplies = 0;
    let classesCrees = 0;
    let parentsCrees = 0;
    let staffCrees = 0;
    let elevesCrees = 0;
    let enseignantsCrees = 0;

    const contexte = await this.importRepository.chargerContexte(schoolId);
    const schoolName = contexte.schoolName;
    const classeCache = new Map(contexte.classes.map((c) => [c.name, c.id]));
    const lv2NameToId = new Map<string, string>();
    for (const s of contexte.lv2Subjects) {
      lv2NameToId.set(s.name.toLowerCase().trim(), s.id);
    }
    const hasPEBS = contexte.hasPEBS;

    const studentDeps = {
      importRepository: this.importRepository,
      userRepository: this.userRepository,
      anneeRepository: this.anneeRepository,
      groupSetRepository: this.groupSetRepository,
      groupRepository: this.groupRepository,
      membershipRepository: this.membershipRepository,
      emailService: this.emailService,
    };

    const teacherDeps = {
      importRepository: this.importRepository,
      userRepository: this.userRepository,
      emailService: this.emailService,
    };

    const staffDeps = {
      userRepository: this.userRepository,
      emailService: this.emailService,
    };

    const parentDeps = {
      importRepository: this.importRepository,
      userRepository: this.userRepository,
      emailService: this.emailService,
    };

    const classeDeps = {
      creerClasseUseCase: this.creerClasseUseCase,
    };

    const classeImportCounts = new Map<string, number>();

    for (let i = 0; i < rows.length; i++) {
      const ligne = i + 1;
      const rawRow = rows[i];
      try {
        switch (targetType) {
          case 'STUDENT': {
            const classeNom = rawRow['classe']?.trim();
            if (classeNom) {
              const cInfo = contexte.classes.find(
                (c) => c.name.toLowerCase() === classeNom.toLowerCase() || c.name === classeNom,
              );
              if (cInfo && typeof cInfo.capacity === 'number' && cInfo.capacity > 0) {
                const currentCount = (cInfo.currentEnrollments ?? 0) + (classeImportCounts.get(cInfo.id) ?? 0);
                if (currentCount >= cInfo.capacity) {
                  warnings.push({
                    ligne,
                    avertissement: `La classe "${cInfo.name}" a atteint ou dépassé sa capacité maximale (${cInfo.capacity} élèves).`,
                  });
                }
                classeImportCounts.set(cInfo.id, (classeImportCounts.get(cInfo.id) ?? 0) + 1);
              }
            }
            await import('./handlers/StudentImportHandler').then((m) =>
              m.traiterLigneStudent(
                {
                  importRepository: this.importRepository,
                  userRepository: this.userRepository,
                  anneeRepository: this.anneeRepository,
                  groupSetRepository: this.groupSetRepository,
                  groupRepository: this.groupRepository,
                  membershipRepository: this.membershipRepository,
                  emailService: this.emailService,
                  credentialsNotifier: this.credentialsNotifier,
                },
                schoolId,
                rawRow as any,
                '',
                false,
                schoolName,
                new Map(contexte.classes.map((c) => [c.name, c.id])),
                new Map(contexte.lv2Subjects.map((s) => [s.name.toLowerCase().trim(), s.id])),
                contexte.hasPEBS,
              ),
            );
            break;
          }
          case 'TEACHER': {
            const result = await import('./handlers/TeacherImportHandler').then((m) =>
              m.traiterLigneTeacher(
                {
                  importRepository: this.importRepository,
                  userRepository: this.userRepository,
                  emailService: this.emailService,
                  credentialsNotifier: this.credentialsNotifier,
                },
                schoolId,
                rawRow,
                '',
                false,
                schoolName,
                new Map(contexte.classes.map((c) => [c.name, c.id])),
              ),
            );
            if (result.ppAssigned) professeursPrincipauxAssignes++;
            if (result.ppError) warnings.push({ ligne, avertissement: result.ppError });
            affectationsPedagogiquesPreremplies += result.affectationsCreees ?? 0;
            break;
          }
          case 'STAFF': {
            await import('./handlers/StaffImportHandler').then((m) =>
              m.traiterLigneStaff(
                {
                  userRepository: this.userRepository,
                  importRepository: this.importRepository,
                  emailService: this.emailService,
                  credentialsNotifier: this.credentialsNotifier,
                },
                schoolId,
                rawRow as any,
                '',
                false,
                schoolName,
                warnings,
                ligne,
              ),
            );
            break;
          }
          case 'PARENT': {
            await import('./handlers/ParentImportHandler').then((m) =>
              m.traiterLigneParent(
                {
                  importRepository: this.importRepository,
                  userRepository: this.userRepository,
                  emailService: this.emailService,
                  credentialsNotifier: this.credentialsNotifier,
                },
                schoolId,
                rawRow as any,
                '',
                false,
                schoolName,
                warnings,
                ligne,
              ),
            );
            break;
          }
          case 'CLASSE': {
            await import('./handlers/ClasseImportHandler').then((m) =>
              m.traiterLigneClasse(
                {
                  creerClasseUseCase: this.creerClasseUseCase,
                },
                schoolId,
                rawRow as any,
              ),
            );
            break;
          }
        }
        success++;
      } catch (err) {
        errors.push({
          ligne,
          erreur: err instanceof Error ? err.message : 'Erreur inconnue',
        });
      }
    }

    return {
      total: rows.length,
      success,
      professeursPrincipauxAssignes,
      affectationsPedagogiquesPreremplies,
      classesCrees: targetType === 'CLASSE' ? success : 0,
      parentsCrees: targetType === 'PARENT' ? success : 0,
      staffCrees: targetType === 'STAFF' ? success : 0,
      elevesCrees: targetType === 'STUDENT' ? success : 0,
      enseignantsCrees: targetType === 'TEACHER' ? success : 0,
      errors,
      warnings,
    };
  }
}
