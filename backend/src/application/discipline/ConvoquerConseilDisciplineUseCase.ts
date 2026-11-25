/**
 * APPLICATION — Use case : convoquer un Conseil de Discipline (Art. 30, Loi 9 de la carte).
 * Bloque toute convocation dont la date prévue ne respecte pas le délai légal de 72h à
 * compter de la notification aux parents (fixée à l'instant de la convocation), et exige la
 * composition légale complète du conseil.
 */
import type { DisciplineRepository } from '@domain/ports/repositories/DisciplineRepository';

const DELAI_LEGAL_HEURES = 72;

export interface CompositionConseil {
  chefEtablissement: string;
  censeur: string;
  sg: string;
  pp: string;
  representantParents: string;
  representantEleves: string;
}

export interface ConvoquerConseilDisciplineCommande {
  schoolId: string;
  studentId: string;
  presidedById: string;
  motif: string;
  composition: CompositionConseil;
  scheduledAt: Date;
}

const ROLES_OBLIGATOIRES: (keyof CompositionConseil)[] = [
  'chefEtablissement', 'censeur', 'sg', 'pp', 'representantParents', 'representantEleves',
];

export class ConvoquerConseilDisciplineUseCase {
  constructor(private readonly disciplineRepository: DisciplineRepository) {}

  async execute(cmd: ConvoquerConseilDisciplineCommande) {
    if (!cmd.motif.trim()) {
      throw new Error('Le motif de convocation est requis.');
    }

    for (const role of ROLES_OBLIGATOIRES) {
      if (!cmd.composition[role]?.trim()) {
        throw new Error(`Composition du conseil incomplète : le membre "${role}" est requis (Art. 30).`);
      }
    }

    const parentNotifiedAt = new Date();
    const delaiMs = DELAI_LEGAL_HEURES * 60 * 60 * 1000;
    if (cmd.scheduledAt.getTime() - parentNotifiedAt.getTime() < delaiMs) {
      throw new Error(
        `La date du conseil doit être au moins ${DELAI_LEGAL_HEURES}h après la convocation des parents (règle absolue, Art. 30). ` +
        `Date minimale : ${new Date(parentNotifiedAt.getTime() + delaiMs).toLocaleString('fr-FR')}.`
      );
    }

    const studentExists = await this.disciplineRepository.verifierEleve(cmd.studentId, cmd.schoolId);
    if (!studentExists) throw new Error('Élève introuvable.');

    return this.disciplineRepository.creerSession({
      schoolId: cmd.schoolId,
      studentId: cmd.studentId,
      presidedById: cmd.presidedById,
      motif: cmd.motif.trim(),
      composition: cmd.composition,
      parentNotifiedAt,
      scheduledAt: cmd.scheduledAt,
    });
  }
}
