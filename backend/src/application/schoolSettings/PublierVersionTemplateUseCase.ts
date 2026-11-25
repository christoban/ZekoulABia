/**
 * APPLICATION — Use Case : Publier une nouvelle version de template (V0.4 Phase 2).
 * Exécuté par un master-admin (protectMaster + requireMasterSensitiveAuth).
 * Valide que les champs sont dans la liste blanche, crée la version N+1.
 */
import type { SchoolTemplateVersionRepository } from '@domain/ports/repositories/SchoolTemplateVersionRepository';
import type { ActivityLogPort } from '@domain/ports/services/ActivityLogPort';
import { CHAMPS_CONFIG_LOCALE } from '@domain/rules/configLocaleTemplate';

const CHAMPS_SET = new Set<string>(CHAMPS_CONFIG_LOCALE);

export interface PublierVersionCommande {
  templateCode: string;
  config: Record<string, unknown>;
  demandeurId: string;
}

export class PublierVersionTemplateUseCase {
  constructor(
    private readonly templateVersionRepo: SchoolTemplateVersionRepository,
    private readonly activityLog?: ActivityLogPort,
  ) {}

  async execute(cmd: PublierVersionCommande) {
    const cles = Object.keys(cmd.config);
    if (cles.length === 0) {
      throw new Error('La config ne peut pas être vide');
    }
    for (const cle of cles) {
      if (!CHAMPS_SET.has(cle)) {
        throw new Error(`Champ hors liste blanche : "${cle}"`);
      }
    }

    const version = await this.templateVersionRepo.publierNouvelleVersion(
      cmd.templateCode,
      cmd.config,
    );

    if (this.activityLog) {
      void this.activityLog.log({
        userId: cmd.demandeurId,
        schoolId: cmd.templateCode,
        action: 'Publication version template',
        details: JSON.stringify({
          templateCode: cmd.templateCode,
          version: version.version,
          config: cmd.config,
        }),
      });
    }

    return version;
  }
}
