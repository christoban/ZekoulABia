/**
 * APPLICATION — Use Case : Appliquer la ré-application du template sur une école.
 * Transaction atomique : recalcul du diff + écriture + audit trail.
 * Idempotent : si rien ne change, retourne un résultat "aucune modification".
 */
import type { SchoolSettingsRepository, SchoolSettingsComplets } from '@domain/ports/repositories/SchoolSettingsRepository';
import type { SchoolTemplateVersionRepository } from '@domain/ports/repositories/SchoolTemplateVersionRepository';
import type { ActivityLogPort } from '@domain/ports/services/ActivityLogPort';
import { calculerDiffReapplication } from './calculerDiffReapplication';

export interface AppliquerReapplicationCommande {
  schoolId: string;
  templateCode: string;
  demandeurId?: string;
}

export interface AppliquerReapplicationResultat {
  status: 'APPLIED' | 'NO_CHANGE';
  avant: Record<string, unknown>;
  apres: Record<string, unknown>;
  champsReappliques: string[];
  champsPreserves: string[];
}

export class AppliquerReapplicationTemplateUseCase {
  constructor(
    private readonly settingsRepo: SchoolSettingsRepository,
    private readonly templateVersionRepo: SchoolTemplateVersionRepository,
    private readonly activityLog: ActivityLogPort,
  ) {}

  async execute(cmd: AppliquerReapplicationCommande): Promise<AppliquerReapplicationResultat> {
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

    const { aChangement, champsReappliques, champsPreserves, apres: configResultante } = diff;

    if (!aChangement) {
      return {
        status: 'NO_CHANGE',
        avant: configCourante as unknown as Record<string, unknown>,
        apres: configResultante,
        champsReappliques: [],
        champsPreserves,
      };
    }

    // Écriture atomique — pattern MettreAJourParametresEcoleUseCase
    const avant = configCourante as unknown as Record<string, unknown>;
    const updates = Object.fromEntries(
      champsReappliques.map((c) => [c, configResultante[c]]),
    ) as unknown as Partial<SchoolSettingsComplets>;
    await this.settingsRepo.sauvegarder(cmd.schoolId, updates);

    if (cmd.demandeurId) {
      void this.activityLog.log({
        userId: cmd.demandeurId,
        schoolId: cmd.schoolId,
        action: 'Ré-application du template',
        details: JSON.stringify({ avant, apres: configResultante, templateCode: cmd.templateCode, version: version.version }),
      });
    }

    return {
      status: 'APPLIED',
      avant,
      apres: configResultante,
      champsReappliques,
      champsPreserves,
    };
  }
}
