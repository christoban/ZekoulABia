/**
 * DOMAIN SERVICE — CycleResolver
 * Service de domaine canonique pour la déduction et la normalisation des cycles éducatifs
 * et sous-systèmes camerounais (MINESEC / MINEDUB).
 *
 * Source unique de vérité pour :
 * - Premier cycle vs Second cycle
 * - Primaire vs Maternelle
 * - Sous-système francophone vs anglophone
 */

export type EducationalCycle =
  | 'PREMIER_CYCLE'
  | 'SECOND_CYCLE'
  | 'PRIMAIRE'
  | 'MATERNELLE'
  | 'INCONNU';

export type SecondarySubsystem = 'FRANCOPHONE' | 'ANGLOPHONE' | 'INCONNU';

export class CycleResolver {
  /**
   * Nettoie et normalise le libellé brut d'un niveau ou d'une classe.
   * Ex: "6ème A" -> "6e", "Form 1 B" -> "Form1", "Lower Sixth Arts" -> "LowerSixth"
   */
  static normalizeLevel(raw: string | null | undefined): string {
    if (!raw) return '';
    const clean = raw.trim().replace(/\s+/g, ' ');

    // Francophone secondaire - 1er cycle
    if (/^6\s*(e|ème|eme)?(\b|[^a-z0-9]|$)/i.test(clean)) return '6e';
    if (/^5\s*(e|ème|eme)?(\b|[^a-z0-9]|$)/i.test(clean)) return '5e';
    if (/^4\s*(e|ème|eme)?(\b|[^a-z0-9]|$)/i.test(clean)) return '4e';
    if (/^3\s*(e|ème|eme)?(\b|[^a-z0-9]|$)/i.test(clean)) return '3e';

    // Francophone secondaire - 2nd cycle
    if (/^(2nde|seconde|2nd)(\b|[^a-z0-9]|$)/i.test(clean)) return '2nde';
    if (/^(1(è|e)?re|premi[èe]re)(\b|[^a-z0-9]|$)/i.test(clean)) return '1ere';
    if (/^(tle|terminale)(\b|[^a-z0-9]|$)/i.test(clean)) return 'Tle';

    // Anglophone secondaire - Forms
    const formMatch = clean.match(/^form\s*([1-5])(\b|[^a-z0-9]|$)/i);
    if (formMatch) return `Form${formMatch[1]}`;

    // Anglophone secondaire - Sixth Forms
    if (/^(lower\s*sixth|lower\s*6th|l6)(\b|[^a-z0-9]|$)/i.test(clean)) return 'LowerSixth';
    if (/^(upper\s*sixth|upper\s*6th|u6)(\b|[^a-z0-9]|$)/i.test(clean)) return 'UpperSixth';

    // Enseignement technique
    const capMatch = clean.match(/^cap\s*([1-4])(\b|[^a-z0-9]|$)/i);
    if (capMatch) return `CAP${capMatch[1]}`;
    const btMatch = clean.match(/^bt\s*([1-3])(\b|[^a-z0-9]|$)/i);
    if (btMatch) return `BT${btMatch[1]}`;

    // Primaire
    if (/^sil(\b|[^a-z0-9]|$)/i.test(clean)) return 'SIL';
    if (/^cp(\b|[^a-z0-9]|$)/i.test(clean)) return 'CP';
    if (/^ce1(\b|[^a-z0-9]|$)/i.test(clean)) return 'CE1';
    if (/^ce2(\b|[^a-z0-9]|$)/i.test(clean)) return 'CE2';
    if (/^cm1(\b|[^a-z0-9]|$)/i.test(clean)) return 'CM1';
    if (/^cm2(\b|[^a-z0-9]|$)/i.test(clean)) return 'CM2';

    const classMatch = clean.match(/^class\s*([1-6])(\b|[^a-z0-9]|$)/i);
    if (classMatch) return `Class${classMatch[1]}`;

    // Maternelle
    if (/^(ps|petite\s*section)(\b|[^a-z0-9]|$)/i.test(clean)) return 'Petite section';
    if (/^(ms|moyenne\s*section)(\b|[^a-z0-9]|$)/i.test(clean)) return 'Moyenne section';
    if (/^(gs|grande\s*section)(\b|[^a-z0-9]|$)/i.test(clean)) return 'Grande section';
    if (/^prenursery(\b|[^a-z0-9]|$)/i.test(clean)) return 'PreNursery';
    if (/^nursery\s*1(\b|[^a-z0-9]|$)/i.test(clean)) return 'Nursery1';
    if (/^nursery\s*2(\b|[^a-z0-9]|$)/i.test(clean)) return 'Nursery2';

    return clean;
  }

  /**
   * Détermine le cycle éducatif à partir du niveau ou nom de classe.
   */
  static resolveCycle(rawLevel: string | null | undefined): EducationalCycle {
    const normalized = this.normalizeLevel(rawLevel);
    if (!normalized) return 'INCONNU';

    // Premier cycle (secondaire)
    if (['6e', '5e', '4e', '3e', 'Form1', 'Form2', 'Form3', 'Form4', 'Form5', 'CAP1', 'CAP2', 'CAP3', 'CAP4'].includes(normalized)) {
      return 'PREMIER_CYCLE';
    }

    // Second cycle (secondaire)
    if (['2nde', '1ere', 'Tle', 'LowerSixth', 'UpperSixth', 'BT1', 'BT2', 'BT3'].includes(normalized)) {
      return 'SECOND_CYCLE';
    }

    // Primaire
    if (['SIL', 'CP', 'CE1', 'CE2', 'CM1', 'CM2', 'Class1', 'Class2', 'Class3', 'Class4', 'Class5', 'Class6'].includes(normalized)) {
      return 'PRIMAIRE';
    }

    // Maternelle
    if (['Petite section', 'Moyenne section', 'Grande section', 'PreNursery', 'Nursery1', 'Nursery2'].includes(normalized)) {
      return 'MATERNELLE';
    }

    return 'INCONNU';
  }

  static isPremierCycle(rawLevel: string | null | undefined): boolean {
    return this.resolveCycle(rawLevel) === 'PREMIER_CYCLE';
  }

  static isSecondCycle(rawLevel: string | null | undefined): boolean {
    return this.resolveCycle(rawLevel) === 'SECOND_CYCLE';
  }

  static isPrimaire(rawLevel: string | null | undefined): boolean {
    return this.resolveCycle(rawLevel) === 'PRIMAIRE';
  }

  static isMaternelle(rawLevel: string | null | undefined): boolean {
    return this.resolveCycle(rawLevel) === 'MATERNELLE';
  }

  static isPrimaireOuMaternelle(rawLevel: string | null | undefined): boolean {
    const cycle = this.resolveCycle(rawLevel);
    return cycle === 'PRIMAIRE' || cycle === 'MATERNELLE';
  }

  /**
   * Déduit le sous-système (francophone ou anglophone) d'après le niveau.
   */
  static resolveSubsystem(rawLevel: string | null | undefined): SecondarySubsystem {
    const normalized = this.normalizeLevel(rawLevel);
    if (!normalized) return 'INCONNU';

    if (['6e', '5e', '4e', '3e', '2nde', '1ere', 'Tle', 'SIL', 'CP', 'CE1', 'CE2', 'CM1', 'CM2', 'Petite section', 'Moyenne section', 'Grande section', 'CAP1', 'CAP2', 'CAP3', 'CAP4', 'BT1', 'BT2', 'BT3'].includes(normalized)) {
      return 'FRANCOPHONE';
    }

    if (['Form1', 'Form2', 'Form3', 'Form4', 'Form5', 'LowerSixth', 'UpperSixth', 'Class1', 'Class2', 'Class3', 'Class4', 'Class5', 'Class6', 'PreNursery', 'Nursery1', 'Nursery2'].includes(normalized)) {
      return 'ANGLOPHONE';
    }

    return 'INCONNU';
  }
}
