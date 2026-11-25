import { TeacherUnavailability } from '@domain/entities/TeacherUnavailability';
import type { TeacherUnavailabilityRepository } from '@domain/ports/repositories/TeacherUnavailabilityRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';

export interface CreerIndisponibiliteEnseignantCommande {
  schoolId: string;
  teacherId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  reason?: string | null;
}

export interface CreerIndisponibiliteEnseignantResultat {
  id: string;
}

export class CreerIndisponibiliteEnseignantUseCase {
  constructor(
    private readonly repository: TeacherUnavailabilityRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(commande: CreerIndisponibiliteEnseignantCommande): Promise<CreerIndisponibiliteEnseignantResultat> {
    const enseignant = await this.userRepository.findById(commande.teacherId);
    if (!enseignant) throw new Error('Enseignant introuvable');
    if (!enseignant.estEnseignant()) {
      throw new Error(`"${enseignant.nomComplet}" n'est pas un enseignant`);
    }
    if (enseignant.schoolId !== commande.schoolId) {
      throw new Error("Cet enseignant n'appartient pas à votre établissement");
    }

    const indisponibilite = TeacherUnavailability.create({
      schoolId: commande.schoolId,
      teacherId: commande.teacherId,
      dayOfWeek: commande.dayOfWeek,
      startTime: commande.startTime,
      endTime: commande.endTime,
      reason: commande.reason,
    });

    // Validation de chevauchement : rejeter si la plage recouvre une indisponibilité ACTIVE
    // du même enseignant le même jour — jamais d'état contradictoire (plages qui se recouvrent
    // partiellement avec des `active` différents).
    const existantes = await this.repository.findByTeacher(commande.teacherId, commande.schoolId, true);
    const enConflit = existantes.some(autre => autre.chevauche({
      dayOfWeek: commande.dayOfWeek,
      startTime: commande.startTime,
      endTime: commande.endTime,
    }));
    if (enConflit) {
      throw new Error(
        `Plage horaire en chevauchement avec une indisponibilité existante de cet enseignant le même jour (${commande.dayOfWeek})`,
      );
    }

    await this.repository.save(indisponibilite);
    return { id: indisponibilite.id };
  }
}