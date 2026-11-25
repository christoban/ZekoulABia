/**
 * APPLICATION LAYER — Use Case : Générer un commentaire IA pour un bulletin
 * Charge le bulletin enrichi, calcule évolution/points forts-faibles, appelle IAService, persiste aiComment.
 */
import type { BulletinRepository } from '@domain/ports/repositories/BulletinRepository';
import type { IAService } from '@domain/ports/services/IAService';
import { resolveLanguage } from '@domain/policies/LanguagePolicy';

export interface GenererCommentaireIACommande {
  bulletinId: string;
  schoolId: string;
  demandeurId?: string;
  demandeurRole?: string;
}

export class GenererCommentaireIAUseCase {
  constructor(
    private readonly bulletinRepository: BulletinRepository,
    private readonly iaService: IAService,
  ) {}

  async execute(commande: GenererCommentaireIACommande): Promise<string> {
    const enriched = await this.bulletinRepository.findEnrichedById(commande.bulletinId, commande.schoolId);
    if (!enriched) {
      throw new Error('Bulletin introuvable');
    }

    // RBAC optionnel si demandeur fourni (même règle que ajouterCommentaire)
    if (commande.demandeurId && commande.demandeurRole) {
      const role = (commande.demandeurRole as string).toUpperCase();
      if (role !== 'ADMIN' && enriched.professorPrincipalId !== commande.demandeurId) {
        throw Object.assign(
          new Error('Seul le Professeur Principal de cette classe ou un Admin peut générer ce commentaire'),
          { status: 403 },
        );
      }
    }

    const previous = await this.bulletinRepository.findPreviousByStudent(
      enriched.bulletin.studentId,
      commande.schoolId,
      commande.bulletinId,
    );

    let evolution: 'HAUSSE' | 'BAISSE' | 'STABLE' = 'STABLE';
    if (previous?.generalAverage != null && enriched.bulletin.generalAverage != null) {
      const diff = enriched.bulletin.generalAverage - previous.generalAverage;
      evolution = diff > 0.5 ? 'HAUSSE' : diff < -0.5 ? 'BAISSE' : 'STABLE';
    }

    const subjectLines = enriched.bulletin.lignesMatiere ?? [];
    const pointsForts = subjectLines.filter((s) => (s.subjectAverage ?? 0) >= 14).map((s) => s.subjectName).slice(0, 3);
    const pointsFaibles = subjectLines.filter((s) => (s.subjectAverage ?? 0) < 10).map((s) => s.subjectName).slice(0, 3);

    const langue = resolveLanguage(enriched.schoolSubsystem, enriched.sectionCode);
    const nomEleve = `${enriched.studentFirstName ?? ''} ${enriched.studentLastName ?? ''}`.trim() || 'Élève';

    const comment = await this.iaService.genererCommentaireBulletin({
      nomEleve,
      moyenneGenerale: enriched.bulletin.generalAverage ?? 0,
      evolution,
      pointsForts,
      pointsFaibles,
      langue: langue.toUpperCase() as 'FR' | 'EN',
    });

    enriched.bulletin.ajouterCommentaireIA(comment);
    await this.bulletinRepository.update(enriched.bulletin);

    return comment;
  }
}
