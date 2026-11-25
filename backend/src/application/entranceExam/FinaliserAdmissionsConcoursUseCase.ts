import type { EntranceExamRepository } from '@domain/ports/repositories/EntranceExamRepository';
import type { CreerSqueletteOnboardingUseCase } from '../eleveOnboarding/CreerSqueletteOnboardingUseCase';

export interface FinaliserAdmissionsCommande {
  schoolId: string;
  sessionId: string;
  executantId: string;
  traiterForfaitsEtRepechage?: boolean;
}

export interface FinaliserAdmissionsResultat {
  totalAdmisTraites: number;
  dossiersCrees: number;
  forfaitsDetectes: number;
  repechesCount: number;
}

export class FinaliserAdmissionsConcoursUseCase {
  constructor(
    private readonly entranceRepository: EntranceExamRepository,
    private readonly creerSqueletteOnboarding: CreerSqueletteOnboardingUseCase
  ) {}

  async execute(cmd: FinaliserAdmissionsCommande): Promise<FinaliserAdmissionsResultat> {
    const session = await this.entranceRepository.trouverSession(cmd.sessionId);
    if (!session || session.schoolId !== cmd.schoolId) {
      throw new Error('Session de concours introuvable ou non autorisée');
    }

    const candidats = await this.entranceRepository.listerCandidats(cmd.sessionId);
    const now = new Date();

    let forfaitsDetectes = 0;
    let repechesCount = 0;

    // 1. Détection des forfaits et repêchage si activé
    if (cmd.traiterForfaitsEtRepechage) {
      const placesLiberees: string[] = [];

      for (const c of candidats) {
        if (
          (c.admissionStatus === 'ADMIS' || c.admissionStatus === 'ADMIS_PROVISOIRE') &&
          c.reservationExpiresAt &&
          now > new Date(c.reservationExpiresAt)
        ) {
          await this.entranceRepository.mettreAJourStatutAdmission(c.id, 'FORFAIT');
          placesLiberees.push(c.id);
          forfaitsDetectes++;
        }
      }

      // Repêchage sur liste d'attente
      if (placesLiberees.length > 0) {
        const listeAttente = candidats
          .filter(c => c.admissionStatus === 'LISTE_ATTENTE')
          .sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999));

        const nbARepecher = Math.min(placesLiberees.length, listeAttente.length);
        const days = session.seatReservationDays || 14;
        const newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + days);

        for (let i = 0; i < nbARepecher; i++) {
          const candRepeche = listeAttente[i];
          await this.entranceRepository.mettreAJourStatutAdmission(candRepeche.id, 'REPECHE');
          repechesCount++;
        }
      }
    }

    // 2. Création des dossiers d'onboarding pour les candidats ADMIS ou REPECHE
    const candsAInscrire = candidats.filter(
      c => (c.admissionStatus === 'ADMIS' || c.admissionStatus === 'REPECHE')
    );

    let targetClassId = session.targetClassId ?? undefined;
    if (!targetClassId) {
      const classe6e = await this.entranceRepository.trouverClasseNiveau(cmd.schoolId, '6');
      targetClassId = classe6e?.id;
    }

    let dossiersCrees = 0;
    for (const cand of candsAInscrire) {
      try {
        const candidateName = `${cand.firstName} ${cand.lastName}`;
        await this.creerSqueletteOnboarding.execute({
          schoolId: cmd.schoolId,
          createdById: cmd.executantId,
          nomProvisoire: candidateName,
          classId: targetClassId,
          contactTelephone: cand.parentPhone ?? null,
          recipientType: 'PARENT',
          sourceType: 'CONCOURS',
          examCandidateId: cand.id,
          aucunContactDisponible: !cand.parentPhone,
        });

        await this.entranceRepository.mettreAJourStatutAdmission(cand.id, 'INSCRIT');
        dossiersCrees++;
      } catch (err: unknown) {
        console.error(
          `[FinaliserAdmissionsConcoursUseCase] Échec onboarding pour candidat ${cand.id}:`,
          err instanceof Error ? err.message : String(err)
        );
      }
    }

    return {
      totalAdmisTraites: candsAInscrire.length,
      dossiersCrees,
      forfaitsDetectes,
      repechesCount,
    };
  }
}
