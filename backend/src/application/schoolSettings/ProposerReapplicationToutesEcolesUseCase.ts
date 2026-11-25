/**
 * APPLICATION — Use Case : Proposer la ré-application du template sur TOUTES les écoles
 * actives utilisant ce template (V0.4 Phase 3). Lecture seule : ne persiste RIEN.
 * Action master-admin manuelle (décision D3 : jamais automatique).
 */
import type { TemplateReapplicationQueryPort } from '@domain/ports/repositories/TemplateReapplicationQueryPort';
import type { SchoolSettingsRepository } from '@domain/ports/repositories/SchoolSettingsRepository';
import type { SchoolTemplateVersionRepository } from '@domain/ports/repositories/SchoolTemplateVersionRepository';
import { calculerDiffReapplication } from './calculerDiffReapplication';

export interface ProposerReapplicationToutesCommande {
  templateCode: string;
}

export interface DetailReapplicationEcole {
  schoolId: string;
  schoolName: string;
  champsReappliques: string[];
  champsPreserves: string[];
  aChangement: boolean;
}

export interface ProposerReapplicationToutesResultat {
  templateCode: string;
  version: number;
  ecolesTotal: number;
  ecolesImpacts: number;
  ecolesSansChangement: number;
  details: DetailReapplicationEcole[];
}

export class ProposerReapplicationToutesEcolesUseCase {
  constructor(
    private readonly queryPort: TemplateReapplicationQueryPort,
    private readonly settingsRepo: SchoolSettingsRepository,
    private readonly templateVersionRepo: SchoolTemplateVersionRepository,
  ) {}

  async execute(cmd: ProposerReapplicationToutesCommande): Promise<ProposerReapplicationToutesResultat> {
    const version = await this.templateVersionRepo.trouverVersionActive(cmd.templateCode);
    if (!version) {
      throw new Error(`Aucune version active pour le template "${cmd.templateCode}".`);
    }

    const ecoles = await this.queryPort.listerEcolesParTemplate(cmd.templateCode);

    const details: DetailReapplicationEcole[] = [];
    for (const ecole of ecoles) {
      const configCourante = await this.settingsRepo.getParametresEffectifs(ecole.id);
      const overrides = await this.settingsRepo.getChampsPersonnalises(ecole.id);
      const diff = calculerDiffReapplication(
        version.config,
        configCourante as unknown as Record<string, unknown>,
        overrides,
      );
      details.push({
        schoolId: ecole.id,
        schoolName: ecole.name,
        champsReappliques: diff.champsReappliques,
        champsPreserves: diff.champsPreserves,
        aChangement: diff.aChangement,
      });
    }

    const ecolesImpacts = details.filter((d) => d.aChangement).length;

    return {
      templateCode: cmd.templateCode,
      version: version.version,
      ecolesTotal: details.length,
      ecolesImpacts,
      ecolesSansChangement: details.length - ecolesImpacts,
      details,
    };
  }
}
