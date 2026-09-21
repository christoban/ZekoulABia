import { describe, it, expect } from 'bun:test';
import {
  SuggererClassesDossierUseCase,
  type SuggestionClasseItem,
} from '@application/eleveOnboarding/SuggererClassesDossierUseCase';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import { Classe } from '@domain/entities/Classe';
import {
  formatNumeroInterne,
  parseNumeroInterne,
  cleanSchoolCode,
} from '@domain/services/NumeroInterneGenerator';

describe('Étape 2.4 — Capacité de classe & Numéro interne', () => {
  const schoolId = 'school-123';

  describe('NumeroInterneGenerator', () => {
    it('formate correctement le code établissement, année et séquence', () => {
      expect(formatNumeroInterne('LYC-BIA', 2026, 1)).toBe('LYCBIA-2026-0001');
      expect(formatNumeroInterne('collège st jean', 2026, 42)).toBe('COLLGEST-2026-0042');
      expect(formatNumeroInterne('', 2026, 999)).toBe('SCH-2026-0999');
      expect(formatNumeroInterne(null as any, 2026, 12345)).toBe('SCH-2026-12345');
    });

    it('parse un numéro interne valide et rejette les formats invalides', () => {
      const parsed = parseNumeroInterne('LYCBIA-2026-0042');
      expect(parsed).toEqual({
        schoolCode: 'LYCBIA',
        year: 2026,
        sequence: 42,
      });

      expect(parseNumeroInterne('INVALIDE')).toBeNull();
      expect(parseNumeroInterne('A-B-C-D')).toBeNull();
      expect(parseNumeroInterne('')).toBeNull();
    });

    it('nettoie le code école avec robustesse', () => {
      expect(cleanSchoolCode('  ecole-123! ')).toBe('ECOLE123');
      expect(cleanSchoolCode(undefined)).toBe('SCH');
      expect(cleanSchoolCode('!!!')).toBe('SCH');
    });
  });

  describe('SuggererClassesDossierUseCase', () => {
    const mockClasse6A = Classe.reconstituer({
      id: 'class-6a',
      schoolId,
      name: '6ème A',
      level: '6EME',
      capacity: 50,
      status: 'ACTIVE',
      academicYearId: 'year-1',
      createdAt: new Date(),
    });

    const mockClasse6B = Classe.reconstituer({
      id: 'class-6b',
      schoolId,
      name: '6ème B',
      level: '6EME',
      capacity: 50,
      status: 'ACTIVE',
      academicYearId: 'year-1',
      createdAt: new Date(),
    });

    const mockClasse6CPleine = Classe.reconstituer({
      id: 'class-6c',
      schoolId,
      name: '6ème C',
      level: '6EME',
      capacity: 40,
      status: 'ACTIVE',
      academicYearId: 'year-1',
      createdAt: new Date(),
    });

    const mockClasse5A = Classe.reconstituer({
      id: 'class-5a',
      schoolId,
      name: '5ème A',
      level: '5EME',
      capacity: 45,
      status: 'ACTIVE',
      academicYearId: 'year-1',
      createdAt: new Date(),
    });

    it('trie les classes par places restantes décroissantes et isole les classes pleines', async () => {
      const mockRepo: Partial<ClasseRepository> = {
        findBySchool: async () => [mockClasse6A, mockClasse6B, mockClasse6CPleine, mockClasse5A],
        countEleves: async (id: string) => {
          if (id === 'class-6a') return 45; // 50 - 45 = 5 places restantes
          if (id === 'class-6b') return 30; // 50 - 30 = 20 places restantes
          if (id === 'class-6c') return 40; // 40 - 40 = 0 place -> PLEINE
          if (id === 'class-5a') return 10;
          return 0;
        },
      };

      const useCase = new SuggererClassesDossierUseCase(mockRepo as ClasseRepository);

      // Filtrage sur 6ème (avec normalisation)
      const suggestions = await useCase.execute({
        schoolId,
        level: '6e', // Devrait matcher 6EME grâce à normalizeLevel
      });

      expect(suggestions.length).toBe(3);

      // Première suggestion : 6ème B (20 places restantes, taux 60%)
      expect(suggestions[0].id).toBe('class-6b');
      expect(suggestions[0].placesRestantes).toBe(20);
      expect(suggestions[0].estPleine).toBe(false);
      expect(suggestions[0].tauxRemplissage).toBe(60);

      // Deuxième suggestion : 6ème A (5 places restantes, taux 90%)
      expect(suggestions[1].id).toBe('class-6a');
      expect(suggestions[1].placesRestantes).toBe(5);
      expect(suggestions[1].estPleine).toBe(false);
      expect(suggestions[1].tauxRemplissage).toBe(90);

      // Troisième suggestion : 6ème C (0 place restante, pleine)
      expect(suggestions[2].id).toBe('class-6c');
      expect(suggestions[2].placesRestantes).toBe(0);
      expect(suggestions[2].estPleine).toBe(true);
      expect(suggestions[2].tauxRemplissage).toBe(100);
    });

    it('échoue si schoolId n’est pas fourni', async () => {
      const mockRepo: Partial<ClasseRepository> = {
        findBySchool: async () => [],
      };
      const useCase = new SuggererClassesDossierUseCase(mockRepo as ClasseRepository);
      expect(useCase.execute({ schoolId: '' })).rejects.toThrow('L\'identifiant de l\'établissement est requis');
    });
  });
});
