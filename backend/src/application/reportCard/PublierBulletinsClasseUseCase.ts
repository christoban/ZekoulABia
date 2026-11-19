/**
 * APPLICATION LAYER — Use Case : Publier les bulletins d'une classe
 * L'admin ou un staff avec VALIDATE_GRADES publie la session et envoie les emails.
 */
import type { BulletinRepository } from '@domain/ports/repositories/BulletinRepository';
import type { BulletinValidationRepository } from '@domain/ports/repositories/BulletinValidationRepository';
import type { SchoolConfigRepository } from '@domain/ports/repositories/SchoolConfigRepository';
import type { BulletinRendererPort } from '@domain/ports/services/BulletinRendererPort';
import type { BulletinPdfStoragePort } from '@domain/ports/services/BulletinPdfStoragePort';
import type { EnvoyerBulletinsUseCase } from './EnvoyerBulletinsUseCase';
import { sealAndStoreBulletinsForClass } from './bulletinPdfLifecycle';

export interface PublierBulletinsCommande {
  schoolId: string;
  sessionId: string;
  demandeurId: string;
  demandeurRole: string;
  demandeurPermissions?: string[];
  nomEtablissement: string;
  nomPeriode: string;
  langue?: 'fr' | 'en';
}

export class PublierBulletinsClasseUseCase {
  constructor(
    private readonly bulletinValidationRepository: BulletinValidationRepository,
    private readonly bulletinRepository: BulletinRepository,
    private readonly envoyerBulletins: EnvoyerBulletinsUseCase,
    private readonly bulletinRenderer?: BulletinRendererPort,
    private readonly bulletinPdfStorage?: BulletinPdfStoragePort,
    private readonly schoolConfigRepository?: SchoolConfigRepository,
  ) {}

  async execute(commande: PublierBulletinsCommande) {
    const { schoolId, sessionId, demandeurId, demandeurRole, demandeurPermissions, nomEtablissement, nomPeriode, langue } = commande;

    // 1. Autorisation : ADMIN ou VALIDATE_GRADES
    const role = demandeurRole.toUpperCase();
    const hasPermission = (demandeurPermissions ?? []).includes('VALIDATE_GRADES');
    if (role !== 'ADMIN' && !hasPermission) {
      throw new Error('Permission VALIDATE_GRADES requise pour publier les bulletins');
    }

    // 2. Charger la session
    const session = await this.bulletinValidationRepository.obtenirSession(sessionId, schoolId);
    if (!session) {
      throw new Error('Session de validation introuvable');
    }

    // 3. Garde : statut VALIDATED
    if (session.status !== 'VALIDATED') {
      throw new Error(
        `Impossible de publier : statut actuel "${session.status}". La session doit être en VALIDATED.`
      );
    }

    // 4. Publier la session (PUBLISHED)
    const publishedSession = await this.bulletinValidationRepository.publierSession(sessionId);

    // 5. Mettre à jour le workflow des bulletins et sceller le PDF stocké
    await this.bulletinRepository.majStatutWorkflowParClasse(
      session.classId,
      session.academicPeriodId,
      schoolId,
      'PUBLISHED',
    );

    await sealAndStoreBulletinsForClass({
      classId: session.classId,
      academicPeriodId: session.academicPeriodId,
      schoolId,
      bulletinRepository: this.bulletinRepository,
      bulletinRenderer: this.bulletinRenderer,
      bulletinPdfStorage: this.bulletinPdfStorage,
      schoolConfigRepository: this.schoolConfigRepository,
    });

    // 6. Envoyer les emails aux parents
    const envoiResultat = await this.envoyerBulletins.execute({
      schoolId,
      classId: session.classId,
      academicPeriodId: session.academicPeriodId,
      nomEtablissement,
      nomPeriode,
      langue,
    });

    return { session: publishedSession, envoiResultat };
  }
}