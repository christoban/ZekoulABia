import type { TeacherUnavailabilityRepository } from '@domain/ports/repositories/TeacherUnavailabilityRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';

export interface IndisponibiliteVue {
  id: string;
  teacherId: string;
  teacherName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  reason: string | null;
  active: boolean;
}

export interface ListerIndisponibilitesCommande {
  schoolId: string;
  teacherId?: string;
  includeInactive?: boolean;
}

export class ListerIndisponibilitesEnseignantUseCase {
  constructor(
    private readonly repository: TeacherUnavailabilityRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(commande: ListerIndisponibilitesCommande): Promise<IndisponibiliteVue[]> {
    if (commande.teacherId) {
      const enseignant = await this.userRepository.findById(commande.teacherId);
      if (!enseignant) throw new Error('Enseignant introuvable');
      if (enseignant.schoolId !== commande.schoolId) {
        throw new Error("Cet enseignant n'appartient pas à votre établissement");
      }
    }

    const items = commande.teacherId
      ? await this.repository.findByTeacher(commande.teacherId, commande.schoolId, !commande.includeInactive)
      : await this.repository.findBySchool(commande.schoolId, commande.includeInactive);

    const ids = [...new Set(items.map(i => i.teacherId))];
    const enseignants = await this.userRepository.findBySchool(commande.schoolId);
    const noms = new Map(enseignants.map(u => [u.id, u.nomComplet]));

    return items.map(i => ({
      id: i.id,
      teacherId: i.teacherId,
      teacherName: noms.get(i.teacherId) ?? 'Inconnu',
      dayOfWeek: i.dayOfWeek,
      startTime: i.startTime,
      endTime: i.endTime,
      reason: i.reason,
      active: i.active,
    }));
  }
}