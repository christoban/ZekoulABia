/**
 * APPLICATION — Use case : Suggérer les classes pour un dossier d'inscription.
 *
 * Responsabilités :
 * - Lister les classes d'un établissement pour un niveau donné (ou toutes si niveau non précisé)
 * - Calculer l'effectif actuel et les places restantes
 * - Détecter la saturation de capacité (alerte bloquante avec motif de dérogation)
 * - Trier en priorité les divisions ayant le plus de places vacantes pour équilibrer les effectifs
 */
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import { CycleResolver } from '@domain/services/CycleResolver';

export interface SuggestionClasseItem {
  id: string;
  name: string;
  level: string | null;
  capacity: number;
  effectifActuel: number;
  placesRestantes: number;
  estPleine: boolean;
  tauxRemplissage: number; // 0..100
}

export interface SuggererClassesCommande {
  schoolId: string;
  level?: string;
  academicYearId?: string;
}

export class SuggererClassesDossierUseCase {
  constructor(private readonly classeRepository: ClasseRepository) {}

  async execute(cmd: SuggererClassesCommande): Promise<SuggestionClasseItem[]> {
    if (!cmd.schoolId?.trim()) {
      throw new Error('L\'identifiant de l\'établissement est requis');
    }

    let classes = cmd.academicYearId
      ? await this.classeRepository.findBySchoolAndYear(cmd.schoolId, cmd.academicYearId)
      : await this.classeRepository.findBySchool(cmd.schoolId);

    // Filtrer par niveau si fourni
    if (cmd.level && cmd.level.trim().length > 0) {
      const normalizedTarget = CycleResolver.normalizeLevel(cmd.level);
      classes = classes.filter(c => {
        if (!c.level) return false;
        return c.level === cmd.level || CycleResolver.normalizeLevel(c.level) === normalizedTarget;
      });
    }

    const suggestions: SuggestionClasseItem[] = [];

    for (const c of classes) {
      const effectifActuel = await this.classeRepository.countEleves(c.id);
      const capacity = c.capacity;
      const placesRestantes = capacity > 0 ? Math.max(0, capacity - effectifActuel) : 999;
      const estPleine = capacity > 0 && effectifActuel >= capacity;
      const tauxRemplissage = capacity > 0 ? Math.min(100, Math.round((effectifActuel / capacity) * 100)) : 0;

      suggestions.push({
        id: c.id,
        name: c.name,
        level: c.level ?? null,
        capacity,
        effectifActuel,
        placesRestantes,
        estPleine,
        tauxRemplissage,
      });
    }

    // Tri : non pleines en premier avec le plus de places disponibles en tête, puis pleines
    suggestions.sort((a, b) => {
      if (a.estPleine !== b.estPleine) {
        return a.estPleine ? 1 : -1;
      }
      return b.placesRestantes - a.placesRestantes;
    });

    return suggestions;
  }
}
