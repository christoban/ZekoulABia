/**
 * APPLICATION — Use Case : Proposer la ré-application du template sur une école.
 * Lecture seule : ne persiste RIEN. Retourne le diff entre config courante et defaults.
 */
import type { SchoolSettingsRepository } from '@domain/ports/repositories/SchoolSettingsRepository';
import type { SchoolTemplateVersionRepository } from '@domain/ports/repositories/SchoolTemplateVersionRepository';
import { calculerDiffReapplication } from './calculerDiffReapplication';

export interface ProposerReapplicationCommande {
  schoolId: string;
  templateCode: string;
}

export interface ProposerReapplicationResultat {
  avant: Record<string, unknown>;
  apres: Record<string, unknown>;
  champsReappliques: string[];
  champsPreserves: string[];
}

export class ProposerReapplicationTemplateUseCase {
  constructor(
    private readonly settingsRepo: SchoolSettingsRepository,
    private readonly templateVersionRepo: SchoolTemplateVersionRepository,
  ) {}

  async execute(cmd: ProposerReapplicationCommande): Promise<ProposerReapplicationResultat> {
    const version = await this.templateVersionRepo.trouverVersionActive(cmd.templateCode);
    if (!version) {
      throw new Error(`Aucune version active pour le template "${cmd.templateCode}".`);
    }

    const configCourante = await this.settingsRepo.getParametresEffectifs(cmd.schoolId);
    const overrides = await this.settingsRepo.getChampsPersonnalises(cmd.schoolId);

    const diff = calculerDiffReapplication(
      version.config,
      configCourante as unknown as Record<string, unknown>,
      overrides,
    );

    return {
      avant: diff.avant,
      apres: diff.apres,
      champsReappliques: diff.champsReappliques,
      champsPreserves: diff.champsPreserves,
    };
  }
}
