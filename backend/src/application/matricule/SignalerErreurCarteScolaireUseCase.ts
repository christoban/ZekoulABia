/**
 * APPLICATION — Use case : Signaler une erreur probable sur cartescolaire.cm
 *
 * L'admin juge que le nom/prénom du fichier cartescolaire.cm ne correspond PAS à
 * l'élève rapproché — ce n'est pas une simple variante de saisie mais une possible
 * erreur sur le nom officiel associé au matricule national. EduNexus n'a aucune
 * autorité pour corriger cartescolaire.cm : ce use case se contente de retirer le
 * candidat du traitement automatique et de tracer le signalement.
 */
import type { MatriculeImportRepository } from '@domain/ports/repositories/MatriculeImportRepository';
import type { SignalerErreurCommande, FuzzyMatchCandidate } from './types';

export interface SignalerErreurResultat {
  message: string;
}

export class SignalerErreurCarteScolaireUseCase {
  constructor(private readonly matriculeRepository: MatriculeImportRepository) {}

  async execute(cmd: SignalerErreurCommande): Promise<SignalerErreurResultat> {
    const job = await this.matriculeRepository.trouverJob(cmd.jobId);
    if (!job) throw new Error('Import introuvable');
    if (job.schoolId !== cmd.schoolId) throw new Error('Accès refusé');

    const details = (job.resultDetails ?? { unmatched: [], fuzzyMatches: [] }) as unknown as { unmatched: unknown[]; fuzzyMatches: FuzzyMatchCandidate[] };
    const fuzzyMatches = details.fuzzyMatches ?? [];
    const entry = fuzzyMatches.find(f => f.ligne === cmd.ligne);
    if (!entry) throw new Error('Correspondance approximative introuvable pour cette ligne');
    if (entry.status !== 'PENDING') throw new Error(`Cette correspondance a déjà été traitée (statut : ${entry.status})`);

    entry.status = 'FLAGGED';
    await this.matriculeRepository.mettreAJourJob(job.id, {
      resultDetails: details,
      flaggedForCorrection: job.flaggedForCorrection + 1,
    });

    return {
      message: "Signalé. Aucun matricule n'a été associé. La correction du nom officiel doit être demandée directement auprès de cartescolaire.cm par l'établissement — EduNexus ne peut pas modifier ces données à la source.",
    };
  }
}
