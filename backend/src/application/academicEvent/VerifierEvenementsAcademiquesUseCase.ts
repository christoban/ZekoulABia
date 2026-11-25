import type { AcademicEventRepository } from '@domain/ports/repositories/AcademicEventRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { Lv2ChoiceRepository } from '@domain/ports/repositories/Lv2ChoiceRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { SmsNotificationPort } from '@domain/ports/services/SmsNotificationPort';
import { activerRessourceLieeSiApplicable, synchroniserClotureRessourceLiee, cloturerRessourceLiee, type EvenementPourActivation } from './activerRessourceLiee';
import type { SchoolCalendarPort } from '@domain/ports/services/SchoolCalendarPort';
import type { AcademicEventNotificationPort } from '@domain/ports/services/AcademicEventNotificationPort';

export interface VerifierEvenementsAcademiquesDeps {
  academicEventRepository: AcademicEventRepository;
  schoolRepository: SchoolRepository;
  lv2ChoiceRepository: Lv2ChoiceRepository;
  anneeRepository: AnneeAcademiqueRepository;
  schoolCalendarPort: SchoolCalendarPort;
  notificationPort: AcademicEventNotificationPort;
  smsPort: SmsNotificationPort;
}

export class VerifierEvenementsAcademiquesUseCase {
  constructor(private readonly deps: VerifierEvenementsAcademiquesDeps) {}

  async execute(params?: { schoolId?: string }): Promise<{ checked: boolean }> {
    const maintenant = new Date();

    const schools: { id: string }[] = params?.schoolId
      ? [{ id: params.schoolId }]
      : (await this.deps.schoolRepository.findByStatus('ACTIVE')).map((s) => ({ id: s.id }));

    for (const school of schools) {
      const aOuvrir = await this.deps.academicEventRepository.trouverAOuvrir(school.id, maintenant);
      for (const ev of aOuvrir) {
        let linkedResourceId: string | null = null;
        try {
          linkedResourceId = await activerRessourceLieeSiApplicable(
            this.deps.lv2ChoiceRepository,
            this.deps.anneeRepository,
            ev as EvenementPourActivation,
            this.deps.smsPort,
          );
        } catch (err: unknown) {
          console.error(`[AcademicEvent] activation ressource liée (${ev.id}):`, err instanceof Error ? err.message : String(err));
          continue;
        }
        await this.deps.academicEventRepository.mettreAJourStatutEtRessource(ev.id, { status: 'ACTIVE', linkedResourceId });
        await this.deps.notificationPort
          .notifierEvenementAcademique(
            school.id,
            ev.targetRoles,
            ev.title,
            ev.description ?? `« ${ev.title} » est désormais ouvert.`,
          )
          .catch((err: unknown) => console.error('[AcademicEvent] notification ouverture:', err instanceof Error ? err.message : String(err)));
      }

      const actifsAvecCloture = await this.deps.academicEventRepository.trouverActifsAvecClotureSansRappel(school.id);
      for (const ev of actifsAvecCloture) {
        if (!ev.closeDate) continue;
        const seuilRappel = await this.deps.schoolCalendarPort.ajouterJoursOuvresScolaires(school.id, maintenant, 3);
        if (seuilRappel >= ev.closeDate) {
          await this.deps.notificationPort
            .notifierEvenementAcademique(
              school.id,
              ev.targetRoles,
              `Rappel — ${ev.title}`,
              `« ${ev.title} » se clôture le ${new Date(ev.closeDate).toLocaleDateString('fr-FR')}. Pensez à agir avant cette date.`,
            )
            .catch((err: unknown) => console.error('[AcademicEvent] notification rappel:', err instanceof Error ? err.message : String(err)));
          await this.deps.academicEventRepository.mettreAJourRappel(ev.id, maintenant);
        }
      }

      const fenetresGlissantes = await this.deps.academicEventRepository.trouverFenetresGlissantes(school.id, maintenant);
      for (const ev of fenetresGlissantes) {
        if (!ev.closeDate) continue;
        const nouvelleCloture = await this.deps.schoolCalendarPort.prolongerSiFermetureAujourdhui(school.id, ev.closeDate, maintenant);
        if (nouvelleCloture) {
          await this.deps.academicEventRepository.mettreAJourCloture(ev.id, nouvelleCloture);
          await synchroniserClotureRessourceLiee(this.deps.lv2ChoiceRepository, ev.type, ev.linkedResourceId, nouvelleCloture);
        }
      }

      const aCloturer = await this.deps.academicEventRepository.trouverACloturer(school.id, maintenant);
      for (const ev of aCloturer) {
        await cloturerRessourceLiee(this.deps.lv2ChoiceRepository, ev.type, ev.linkedResourceId);
      }
      await this.deps.academicEventRepository.cloturerParIds(aCloturer.map((e) => e.id));
    }

    return { checked: true };
  }
}
