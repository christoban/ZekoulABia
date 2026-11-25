import { TeacherUnavailability } from '@domain/entities/TeacherUnavailability';
import type { TeacherUnavailabilityRepository } from '@domain/ports/repositories/TeacherUnavailabilityRepository';

export interface ModifierIndisponibiliteEnseignantCommande {
  id: string;
  schoolId: string;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  reason?: string | null;
  /** Transition d'état explicite ACTIVE/INACTIVE — passe par activer()/desactiver() de l'entité. */
  active?: boolean;
}

export class ModifierIndisponibiliteEnseignantUseCase {
  constructor(private readonly repository: TeacherUnavailabilityRepository) {}

  async execute(commande: ModifierIndisponibiliteEnseignantCommande): Promise<void> {
    const existante = await this.repository.findById(commande.id);
    if (!existante || existante.schoolId !== commande.schoolId) {
      throw new Error(`Indisponibilité introuvable : ${commande.id}`);
    }

    const props = { ...existante.toObject() };
    if (commande.dayOfWeek !== undefined) props.dayOfWeek = commande.dayOfWeek;
    if (commande.startTime !== undefined) props.startTime = commande.startTime;
    if (commande.endTime !== undefined) props.endTime = commande.endTime;
    if (commande.reason !== undefined) props.reason = commande.reason;

    if (commande.dayOfWeek !== undefined || commande.startTime !== undefined || commande.endTime !== undefined) {
      TeacherUnavailability.validerPlage(props.dayOfWeek, props.startTime, props.endTime);

      const autres = await this.repository.findByTeacher(existante.teacherId, commande.schoolId, true);
      const enConflit = autres.some(autre =>
        autre.id !== commande.id
        && autre.chevauche({ dayOfWeek: props.dayOfWeek, startTime: props.startTime, endTime: props.endTime })
      );
      if (enConflit) {
        throw new Error(
          `Plage horaire en chevauchement avec une indisponibilité existante de cet enseignant le même jour (${props.dayOfWeek})`,
        );
      }
    }

    const entite = TeacherUnavailability.reconstituer(props);
    if (commande.active !== undefined) {
      if (commande.active) entite.activer();
      else entite.desactiver();
    }

    await this.repository.update(entite);
  }
}