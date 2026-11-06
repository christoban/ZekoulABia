import type { IOrientationRepository } from '@domain/ports/repositories/IOrientationRepository';
import type { GradeOrientationRepository } from '@domain/ports/repositories/GradeOrientationRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { StaffProfileRepository } from '@domain/ports/repositories/StaffProfileRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import { GenererRecommandationOrientationUseCase } from './GenererRecommandationOrientationUseCase';
import { RelancerElevesEnAttenteUseCase } from './RelancerElevesEnAttenteUseCase';
import { FinaliserParDefautUseCase } from './FinaliserParDefautUseCase';
import { ListerElevesAOrienterUseCase } from './ListerElevesAOrienterUseCase';
import type { ConseillerResolverPort } from '@domain/ports/services/ConseillerResolverPort';
import { messageErreur } from '@application/shared/messageErreur';
import type { PersonnelNotificationPort } from '@domain/ports/services/PersonnelNotificationPort';

export interface VerifierOrientationCheckpointsDeps {
  schoolRepository: SchoolRepository;
  orientationRepository: IOrientationRepository;
  gradeOrientationRepository: GradeOrientationRepository;
  anneeRepository: AnneeAcademiqueRepository;
  conseillerResolverPort?: ConseillerResolverPort;
  staffProfileRepository?: StaffProfileRepository;
  userRepository?: UserRepository;
  personnelNotificationPort: PersonnelNotificationPort;
}

function dansLaFenetreOrientation(
  config: { windowStartMonth: number; windowStartDay: number; windowEndMonth: number; windowEndDay: number },
  now: Date,
): boolean {
  const cur = (now.getMonth() + 1) * 100 + now.getDate();
  const start = config.windowStartMonth * 100 + config.windowStartDay;
  const end = config.windowEndMonth * 100 + config.windowEndDay;
  return start <= end ? cur >= start && cur <= end : cur >= start || cur <= end;
}

export class VerifierOrientationCheckpointsUseCase {
  constructor(private readonly deps: VerifierOrientationCheckpointsDeps) {}

  private async resolveConseillers(schoolId: string): Promise<string[]> {
    if (this.deps.staffProfileRepository) {
      const conseillers = await this.deps.staffProfileRepository.findConseillersOrientation(schoolId).catch(() => [] as string[]);
      if (conseillers.length > 0) return conseillers;
      if (this.deps.userRepository) {
        const admins = await this.deps.userRepository.findByRole(schoolId, 'ADMIN').catch(() => []);
        return admins.map((a) => a.id);
      }
      return conseillers;
    }
    if (this.deps.conseillerResolverPort) {
      return this.deps.conseillerResolverPort.resolverConseillersOrientation(schoolId);
    }
    return [];
  }

  async execute(params?: { schoolId?: string }): Promise<{ checked: boolean }> {
    const now = new Date();
    const orientationRepo = this.deps.orientationRepository;
    const gradeOrientationRepo = this.deps.gradeOrientationRepository;
    const genererUseCase = new GenererRecommandationOrientationUseCase(orientationRepo, gradeOrientationRepo);
    const relancerUseCase = new RelancerElevesEnAttenteUseCase(orientationRepo);
    const finaliserUseCase = new FinaliserParDefautUseCase(orientationRepo);
    const listerUseCase = new ListerElevesAOrienterUseCase(orientationRepo);

    const schools: { id: string }[] = params?.schoolId
      ? [{ id: params.schoolId }]
      : (await this.deps.schoolRepository.findByStatus('ACTIVE')).map((s) => ({ id: s.id }));

    for (const school of schools) {
      try {
        const anneeCourante = await this.deps.anneeRepository.findCourante(school.id);
        if (!anneeCourante) continue;

        const conseillerIds = await this.resolveConseillers(school.id);

        const configs = await orientationRepo.findCheckpointConfigsActives(school.id);
        for (const config of configs) {
          if (!dansLaFenetreOrientation(config, now)) continue;

          const eleves = await listerUseCase.execute({
            schoolId: school.id,
            checkpointType: config.type,
            academicYearId: anneeCourante.id,
          });
          for (const eleve of eleves) {
            if (eleve.hasRecommendation) continue;
            if (conseillerIds.length === 0) continue;

            const aDesDonnees = await gradeOrientationRepo.hasValidatedGrade(school.id, eleve.studentId);
            if (!aDesDonnees) continue;

            try {
              await genererUseCase.execute({
                schoolId: school.id,
                studentId: eleve.studentId,
                checkpointType: config.type,
                academicYearId: anneeCourante.id,
                conseillerId: conseillerIds[0]!,
              });
              for (const cId of conseillerIds) {
                await this.deps.personnelNotificationPort.notifierPersonnel(
                  cId,
                  school.id,
                  "Nouvelle recommandation d'orientation",
                  `Une proposition a été calculée pour ${eleve.firstName} ${eleve.lastName} (${eleve.className}).`,
                );
              }
            } catch (err) {
              console.error(`[Orientation] génération recommandation (${eleve.studentId}):`, messageErreur(err));
            }
          }
        }

        const relances = await relancerUseCase.execute(school.id);
        for (const reco of relances) {
          await this.deps.personnelNotificationPort.notifierPersonnel(
            reco.studentId,
            school.id,
            'Rappel — proposition d\'orientation en attente',
            `Votre délai de réponse approche pour votre proposition d'orientation. Répondez avant l'échéance.`,
          );
        }

        const finalisees = await finaliserUseCase.execute(school.id);
        for (const reco of finalisees) {
          await this.deps.personnelNotificationPort.notifierPersonnel(
            reco.studentId,
            school.id,
            'Orientation finalisée',
            `Le délai de réponse est passé — la piste ${reco.finalTrack} a été retenue.`,
          );
          for (const cId of conseillerIds) {
            await this.deps.personnelNotificationPort.notifierPersonnel(
              cId,
              school.id,
              'Orientation finalisée par défaut',
              `Un élève n'a pas répondu à temps — la piste ${reco.finalTrack} a été retenue par défaut.`,
            );
          }
        }
      } catch (err) {
        console.error(`[Orientation] école ${school.id}:`, messageErreur(err));
      }
    }

    return { checked: true };
  }
}
