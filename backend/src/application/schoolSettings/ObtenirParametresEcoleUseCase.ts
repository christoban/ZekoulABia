/**
 * APPLICATION LAYER — Use Case : Obtenir les paramètres effectifs de l'école
 *
 * Corrige le bug de getEffectiveSchoolSettings :
 * TOUS les champs sont lus depuis la DB (plus rien de hardcodé).
 */
import type { SchoolSettingsRepository, SchoolSettingsComplets } from '@domain/ports/repositories/SchoolSettingsRepository';

export class ObtenirParametresEcoleUseCase {
  constructor(
    private readonly settingsRepository: SchoolSettingsRepository
  ) {}

  async execute(schoolId: string): Promise<SchoolSettingsComplets> {
    const settings = await this.settingsRepository.getParametresEffectifs(schoolId);
    if (!settings) {
      throw new Error(`Paramètres introuvables pour l'établissement : ${schoolId}`);
    }
    return settings;
  }
}
