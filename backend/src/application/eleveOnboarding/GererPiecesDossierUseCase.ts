/**
 * APPLICATION — Use case : Gérer les pièces justificatives d'un dossier d'inscription.
 *
 * Responsabilités :
 * - Initialiser les documents d'un dossier à partir des exigences de l'établissement
 * - Marquer une pièce comme reçue ou manquante
 * - Recalculer le score de complétude (0-100%)
 * - Déterminer si le dossier est « validable sous réserve »
 *
 * Le score de complétude est calculé comme :
 *   (pièces obligatoires reçues / total pièces obligatoires) * 100
 *
 * Un dossier est « validable sous réserve » si :
 *   - Toutes les pièces obligatoires sont reçues → validableSousReserve = false (rien ne manque)
 *   - Des pièces obligatoires manquent mais le score est ≥ 70% → validableSousReserve = true
 *   - Sinon → validableSousReserve = false (trop incomplet)
 */
import type {
  EleveOnboardingRepository,
  DocumentRequirementRecord,
  DocumentRecord,
} from '@domain/ports/repositories/EleveOnboardingRepository';

// ── DTOs ────────────────────────────────────────────────────────────────────

export interface InitialiserPiecesCommande {
  schoolId: string;
  onboardingId: string;
  sourceType?: string; // 'NOUVEAU' | 'TRANSFERT' | 'REDOUBLANT' — filtre applicable
}

export interface MarquerPieceCommande {
  schoolId: string;
  onboardingId: string;
  code: string;
  received: boolean;
  receivedById: string;
  note?: string | null;
  fileKey?: string | null;
}

export interface CompletenessResult {
  score: number;           // 0..100
  validableSousReserve: boolean;
  totalObligatoires: number;
  recuesObligatoires: number;
  totalFacultatives: number;
  recuesFacultatives: number;
  documents: DocumentRecord[];
}

// ── Seuil ─────────────────────────────────────────────────────────────────

const SEUIL_VALIDABLE_SOUS_RESERVE = 70;

// ── Use Case ──────────────────────────────────────────────────────────────

export class GererPiecesDossierUseCase {
  constructor(
    private readonly repo: EleveOnboardingRepository,
  ) {}

  /**
   * Initialise les documents d'un dossier à partir des exigences de l'établissement.
   * Ne crée que les documents manquants (idempotent).
   */
  async initialiserPieces(cmd: InitialiserPiecesCommande): Promise<CompletenessResult> {
    const onboarding = await this.repo.findOnboardingById(cmd.onboardingId, cmd.schoolId);
    if (!onboarding) throw new Error('Dossier introuvable');

    const allRequirements = await this.repo.listDocumentRequirements(cmd.schoolId);

    // Filtrer par cas applicable (TOUS ou le cas spécifique)
    const requirements = allRequirements.filter(r =>
      r.applicableCase === 'TOUS' || r.applicableCase === (cmd.sourceType ?? 'TOUS'),
    );

    // Récupérer documents existants pour ne pas recréer
    const existingDocs = await this.repo.listDocuments(cmd.onboardingId);
    const existingCodes = new Set(existingDocs.map(d => d.code));

    const missingRequirements = requirements.filter(r => !existingCodes.has(r.code));

    let documents: DocumentRecord[];
    if (missingRequirements.length > 0) {
      const newDocs = await this.repo.initialiserDocuments(cmd.onboardingId, missingRequirements);
      documents = [...existingDocs, ...newDocs];
    } else {
      documents = existingDocs;
    }

    return this.recalculerCompletude(cmd.onboardingId, documents, requirements);
  }

  /**
   * Marque une pièce comme reçue ou manquante, puis recalcule la complétude.
   */
  async marquerPiece(cmd: MarquerPieceCommande): Promise<CompletenessResult> {
    const onboarding = await this.repo.findOnboardingById(cmd.onboardingId, cmd.schoolId);
    if (!onboarding) throw new Error('Dossier introuvable');

    await this.repo.marquerDocumentRecu(cmd.onboardingId, cmd.code, {
      received: cmd.received,
      receivedById: cmd.receivedById,
      note: cmd.note,
      fileKey: cmd.fileKey,
    });

    const documents = await this.repo.listDocuments(cmd.onboardingId);
    const requirements = await this.repo.listDocumentRequirements(cmd.schoolId);
    return this.recalculerCompletude(cmd.onboardingId, documents, requirements);
  }

  /**
   * Lit les documents et recalcule la complétude sans modification.
   */
  async consulterCompletude(schoolId: string, onboardingId: string): Promise<CompletenessResult> {
    const onboarding = await this.repo.findOnboardingById(onboardingId, schoolId);
    if (!onboarding) throw new Error('Dossier introuvable');

    const documents = await this.repo.listDocuments(onboardingId);
    const requirements = await this.repo.listDocumentRequirements(schoolId);
    return this.calculerScore(documents, requirements);
  }

  // ── Logique pure de calcul ─────────────────────────────────────────────

  private async recalculerCompletude(
    onboardingId: string,
    documents: DocumentRecord[],
    requirements: DocumentRequirementRecord[],
  ): Promise<CompletenessResult> {
    const result = this.calculerScore(documents, requirements);

    // Persister le score
    await this.repo.updateCompletenessScore(onboardingId, result.score, result.validableSousReserve);

    return result;
  }

  private calculerScore(
    documents: DocumentRecord[],
    requirements: DocumentRequirementRecord[],
  ): CompletenessResult {
    // Construire un set des codes obligatoires
    const obligatoireCodes = new Set(
      requirements.filter(r => r.obligatoire).map(r => r.code),
    );

    let totalObligatoires = 0;
    let recuesObligatoires = 0;
    let totalFacultatives = 0;
    let recuesFacultatives = 0;

    for (const doc of documents) {
      if (obligatoireCodes.has(doc.code)) {
        totalObligatoires++;
        if (doc.received) recuesObligatoires++;
      } else {
        totalFacultatives++;
        if (doc.received) recuesFacultatives++;
      }
    }

    const score = totalObligatoires > 0
      ? Math.round((recuesObligatoires / totalObligatoires) * 100)
      : 100; // pas d'exigence obligatoire = dossier complet

    const toutesRecues = recuesObligatoires === totalObligatoires;
    const validableSousReserve = !toutesRecues && score >= SEUIL_VALIDABLE_SOUS_RESERVE;

    return {
      score,
      validableSousReserve,
      totalObligatoires,
      recuesObligatoires,
      totalFacultatives,
      recuesFacultatives,
      documents,
    };
  }
}
