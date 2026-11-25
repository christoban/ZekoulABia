/**
 * APPLICATION — Use Case : Appliquer la ré-application du template sur TOUTES les écoles
 * actives utilisant ce template (V0.4 Phase 3). Une transaction par école (via le use case
 * école existant) — une école en échec ne bloque pas les autres ; le rapport liste les échecs.
 * Idempotent : une seconde exécution retourne NO_CHANGE partout.
 */
import type { TemplateReapplicationQueryPort } from '@domain/ports/repositories/TemplateReapplicationQueryPort';
import type { SchoolTemplateVersionRepository } from '@domain/ports/repositories/SchoolTemplateVersionRepository';
import type { AppliquerReapplicationTemplateUseCase } from './AppliquerReapplicationTemplateUseCase';

export interface AppliquerReapplicationToutesCommande {
  templateCode: string;
  demandeurId: string;
}

export interface ResultatReapplicationEcole {
  schoolId: string;
  schoolName: string;
  status: 'APPLIED' | 'NO_CHANGE' | 'ERROR';
  erreur?: string;
}

export interface AppliquerReapplicationToutesResultat {
  templateCode: string;
  version: number;
  ecolesTotal: number;
  ecolesAppliquees: number;
  ecolesSansChangement: number;
  ecolesEnEchec: number;
  resultats: ResultatReapplicationEcole[];
}

export class AppliquerReapplicationToutesEcolesUseCase {
  constructor(
    private readonly queryPort: TemplateReapplicationQueryPort,
    private readonly templateVersionRepo: SchoolTemplateVersionRepository,
    private readonly appliquerEcole: AppliquerReapplicationTemplateUseCase,
  ) {}

  async execute(cmd: AppliquerReapplicationToutesCommande): Promise<AppliquerReapplicationToutesResultat> {
    const version = await this.templateVersionRepo.trouverVersionActive(cmd.templateCode);
    if (!version) {
      throw new Error(`Aucune version active pour le template "${cmd.templateCode}".`);
    }

    const ecoles = await this.queryPort.listerEcolesParTemplate(cmd.templateCode);

    const resultats: ResultatReapplicationEcole[] = [];
    for (const ecole of ecoles) {
      try {
        const r = await this.appliquerEcole.execute({
          schoolId: ecole.id,
          templateCode: cmd.templateCode,
          demandeurId: cmd.demandeurId,
        });
        resultats.push({ schoolId: ecole.id, schoolName: ecole.name, status: r.status });
      } catch (error) {
        resultats.push({
          schoolId: ecole.id,
          schoolName: ecole.name,
          status: 'ERROR',
          erreur: error instanceof Error ? error.message : 'Erreur inconnue',
        });
      }
    }

    const ecolesAppliquees = resultats.filter((r) => r.status === 'APPLIED').length;
    const ecolesEnEchec = resultats.filter((r) => r.status === 'ERROR').length;

    return {
      templateCode: cmd.templateCode,
      version: version.version,
      ecolesTotal: resultats.length,
      ecolesAppliquees,
      ecolesSansChangement: resultats.length - ecolesAppliquees - ecolesEnEchec,
      ecolesEnEchec,
      resultats,
    };
  }
}
