import type { StudentGuardianRepository } from '@domain/ports/repositories/StudentGuardianRepository';

export interface ConfigurerTuteurPrincipalCommand {
  studentProfileId: string;
  schoolId: string;
  parentProfileId: string;
}

/**
 * Phase 1C : désigne le tuteur principal. La vérification téléphone reste un
 * prérequis de l'ÉMISSION du consentement (issuer), pas de la désignation,
 * sinon le circuit OTP serait impossible à démarrer.
 */
export class ConfigurerTuteurPrincipalUseCase {
  constructor(private readonly guardianRepository: StudentGuardianRepository) {}

  async execute(command: ConfigurerTuteurPrincipalCommand): Promise<void> {
    const guardians = await this.guardianRepository.findGuardiansByStudent(
      command.studentProfileId,
      command.schoolId,
    );
    const guardian = guardians.find(
      candidate => candidate.parentProfileId === command.parentProfileId,
    );

    if (!guardian) {
      throw new Error('Le tuteur enregistré doit appartenir à la même école que l’élève.');
    }
    if (!guardian.phone) {
      throw new Error('Le tuteur principal doit disposer d’un téléphone.');
    }

    await this.guardianRepository.setPrimaryGuardian(command);
  }
}
