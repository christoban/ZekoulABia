import type { EntranceExamRepository } from '@domain/ports/repositories/EntranceExamRepository';

export interface RepartirCandidatsSallesCommande {
  schoolId: string;
  sessionId: string;
  mode?: 'ALPHABETIQUE' | 'ALEATOIRE';
}

export interface SalleRepartitionBilan {
  salleId: string;
  nom: string;
  capacite: number;
  candidatsAssignes: number;
}

export interface RepartirCandidatsSallesResultat {
  totalCandidats: number;
  salles: SalleRepartitionBilan[];
}

export class RepartirCandidatsSallesUseCase {
  constructor(private readonly entranceRepository: EntranceExamRepository) {}

  async execute(cmd: RepartirCandidatsSallesCommande): Promise<RepartirCandidatsSallesResultat> {
    const session = await this.entranceRepository.trouverSession(cmd.sessionId);
    if (!session || session.schoolId !== cmd.schoolId) {
      throw new Error('Session de concours introuvable ou non autorisée');
    }

    const salles = this.entranceRepository.listerSalles
      ? await this.entranceRepository.listerSalles(cmd.sessionId)
      : [];
    if (salles.length === 0) {
      throw new Error('Aucune salle d examen n a été configurée pour cette session');
    }

    const candidats = await this.entranceRepository.listerCandidats(cmd.sessionId);
    if (candidats.length === 0) {
      throw new Error('Aucun candidat n est inscrit dans cette session');
    }

    const capaciteTotale = salles.reduce((acc, s) => acc + s.capacity, 0);
    if (candidats.length > capaciteTotale) {
      throw new Error(
        `Capacité insuffisante : ${capaciteTotale} places en salle pour ${candidats.length} candidats inscrits`
      );
    }

    // Tri des candidats
    const candidatsTries = [...candidats];
    if (cmd.mode === 'ALEATOIRE') {
      candidatsTries.sort(() => Math.random() - 0.5);
    } else {
      candidatsTries.sort((a, b) => {
        const compNom = a.lastName.localeCompare(b.lastName);
        if (compNom !== 0) return compNom;
        return a.firstName.localeCompare(b.firstName);
      });
    }

    // Répartition séquentielle
    const bilanSalles: SalleRepartitionBilan[] = [];
    let candIndex = 0;

    for (const salle of salles) {
      let deskNumber = 1;
      let countAssigned = 0;

      while (countAssigned < salle.capacity && candIndex < candidatsTries.length) {
        const candidat = candidatsTries[candIndex];
        if (this.entranceRepository.assignerSallePlace) {
          await this.entranceRepository.assignerSallePlace(candidat.id, salle.id, deskNumber);
        }
        deskNumber++;
        countAssigned++;
        candIndex++;
      }

      bilanSalles.push({
        salleId: salle.id,
        nom: salle.name,
        capacite: salle.capacity,
        candidatsAssignes: countAssigned,
      });
    }

    // Si la session était en DRAFT ou REGISTRATION_OPEN, on bascule vers SEATS_ASSIGNED
    if (session.status === 'DRAFT' || session.status === 'REGISTRATION_OPEN') {
      await this.entranceRepository.mettreAJourStatutSession(cmd.sessionId, 'SEATS_ASSIGNED');
    }

    return {
      totalCandidats: candidats.length,
      salles: bilanSalles,
    };
  }
}
