/**
 * APPLICATION — Use case : Soumettre le formulaire d'onboarding (élève ou parent)
 *
 * Public, protégé par un token à usage unique. Déclenche le matching contre les élèves
 * déjà connus de l'école — réutilise directement compareNames() de stringSimilarity.ts
 * (ImporterMatriculesUseCase), ne duplique pas la logique. Même principe conservateur que
 * l'import matricule : date de naissance en verrou dur (aucun candidat évalué sans
 * coïncidence exacte), puis score Jaro-Winkler tokenisé sur nom/prénom, seuil 0.85.
 * Ne crée JAMAIS de compte ici, même en cas de score parfait — la validation humaine
 * (PENDING_VALIDATION → VALIDATED) reste une étape obligatoire (règle métier n°1).
 */
import type { EleveOnboardingRepository } from '@domain/ports/repositories/EleveOnboardingRepository';
import { compareNames } from '../matricule/stringSimilarity';
import { parseDateFR } from '../../shared/date/parseDateFR';
import { peutSoumettreFormulaire } from './rules';
import type { SoumettreFormulaireOnboardingCommande, SoumettreFormulaireOnboardingResultat } from './types';

const FUZZY_SIMILARITY_THRESHOLD = 0.85; // aligné sur ImporterMatriculesUseCase — même seuil dans tout le projet

export class SoumettreFormulaireOnboardingUseCase {
  constructor(private readonly eleveOnboardingRepository: EleveOnboardingRepository) {}

  async execute(cmd: SoumettreFormulaireOnboardingCommande): Promise<SoumettreFormulaireOnboardingResultat> {
    const onboarding = await this.eleveOnboardingRepository.findOnboardingByToken(cmd.token);
    if (!onboarding) throw new Error('Lien invalide');
    if (onboarding.tokenUsedAt) throw new Error('Ce lien a déjà été utilisé');

    if (onboarding.tokenExpiresAt.getTime() < Date.now()) {
      if (onboarding.status !== 'EXPIRED') {
        await this.eleveOnboardingRepository.marquerOnboardingExpire(onboarding.id);
      }
      throw new Error('Ce lien a expiré — demandez à votre établissement de le renvoyer');
    }

    if (!peutSoumettreFormulaire(onboarding.status)) {
      throw new Error(`Ce dossier n'est plus en attente de saisie (statut actuel : ${onboarding.status})`);
    }

    // ── Matching : verrou dur sur la date de naissance, puis score sur nom/prénom ──
    let matchScore: number | null = null;
    let matchedStudentId: string | null = null;

    const dateNaissance = cmd.dateNaissance ? parseDateFR(cmd.dateNaissance) : null;
    if (dateNaissance) {
      const profiles = await this.eleveOnboardingRepository.findProfilesParDateNaissance(onboarding.schoolId, dateNaissance);

      let best: { profileId: string; score: number } | null = null;
      for (const p of profiles) {
        const score = compareNames(cmd.nom, cmd.prenom, p.lastName, p.firstName);
        if (!best || score > best.score) best = { profileId: p.id, score };
      }

      if (best && best.score >= FUZZY_SIMILARITY_THRESHOLD) {
        matchScore = Math.round(best.score * 100);
        matchedStudentId = best.profileId;
      }
    }

    const submittedData = {
      nom: cmd.nom,
      prenom: cmd.prenom,
      dateNaissance: cmd.dateNaissance ?? null,
      ...(cmd.donneesComplementaires ?? {}),
    };

    await this.eleveOnboardingRepository.soumettreFormulaire(onboarding.id, {
      submittedData,
      submittedAt: new Date(),
      tokenUsedAt: new Date(),
      matchScore,
      matchedStudentId,
      ...(cmd.eleveADispositif !== undefined && { eleveADispositif: cmd.eleveADispositif }),
      ...(cmd.parentADispositif !== undefined && { parentADispositif: cmd.parentADispositif }),
    });

    return { id: onboarding.id, status: 'SUBMITTED', matchScore, matchedStudentId };
  }
}
