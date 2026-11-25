/**
 * APPLICATION — Use case : Confirmer une correspondance approximative (Niveau 2)
 *
 * L'admin a visuellement vérifié qu'un candidat "fuzzy" (nom similaire, date de
 * naissance identique) est bien le même élève. Applique le matricule et trace la
 * confiance de la correspondance via `matriculeMatchType = 'FUZZY_CONFIRMED'`
 * (distinct des correspondances exactes automatiques).
 */
import type { MatriculeImportRepository } from '@domain/ports/repositories/MatriculeImportRepository';
import type { ConfirmerFuzzyCommande, FuzzyMatchCandidate } from './types';

export interface ConfirmerFuzzyResultat {
  studentProfileId: string;
  matricule: string;
}

export class ConfirmerCorrespondanceFuzzyUseCase {
  constructor(private readonly matriculeRepository: MatriculeImportRepository) {}

  async execute(cmd: ConfirmerFuzzyCommande): Promise<ConfirmerFuzzyResultat> {
    const job = await this.matriculeRepository.trouverJob(cmd.jobId);
    if (!job) throw new Error('Import introuvable');
    if (job.schoolId !== cmd.schoolId) throw new Error('Accès refusé');

    const details = (job.resultDetails ?? { unmatched: [], fuzzyMatches: [] }) as unknown as { unmatched: unknown[]; fuzzyMatches: FuzzyMatchCandidate[] };
    const fuzzyMatches = details.fuzzyMatches ?? [];
    const entry = fuzzyMatches.find(f => f.ligne === cmd.ligne);
    if (!entry) throw new Error('Correspondance approximative introuvable pour cette ligne');
    if (entry.status !== 'PENDING') throw new Error(`Cette correspondance a déjà été traitée (statut : ${entry.status})`);

    const profile = await this.matriculeRepository.trouverProfilParId(entry.studentProfileId, cmd.schoolId);
    if (!profile) throw new Error('Élève introuvable');
    if (profile.matricule && profile.matricule !== entry.matriculeNouveau) {
      throw new Error(`Cet élève a déjà un matricule différent ("${profile.matricule}") — à traiter manuellement`);
    }

    await this.matriculeRepository.mettreAJourMatricule(profile.id, {
      matricule: entry.matriculeNouveau,
      matriculeSource: 'EXCEL_IMPORT',
      matriculeMatchType: 'FUZZY_CONFIRMED',
    });

    entry.status = 'CONFIRMED';
    await this.matriculeRepository.mettreAJourJob(job.id, {
      resultDetails: details,
      matchedRows: job.matchedRows + 1,
      matchedRowsFuzzyConfirmed: job.matchedRowsFuzzyConfirmed + 1,
    });

    return { studentProfileId: profile.id, matricule: entry.matriculeNouveau };
  }
}
