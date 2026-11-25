/**
 * CandidateCodeGenerator — Générateur de codes anonymisés pour concours d'entrée
 * Format : {CODE_ECOLE}-C{NUM} (ex: EK-C001, LYC-C042)
 *
 * Règle de conception :
 * - Le code identifie uniquement la copie sans dévoiler le nom, le genre, l'école d'origine
 *   ni le rang d'inscription du candidat, garantissant l'anonymat absolu lors des corrections.
 */

export interface ParsedCandidateCode {
  schoolCode: string;
  sequenceNumber: number;
}

export class CandidateCodeGenerator {
  private static readonly CODE_REGEX = /^([A-Z0-9]{2,10})-C(\d{3,6})$/;

  /**
   * Nettoie et normalise le code établissement (2 à 6 lettres majuscules alphanumériques)
   */
  public static normaliserCodeEtablissement(codeOuNom: string): string {
    const nettoye = codeOuNom
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();

    if (nettoye.length < 2) {
      return 'EXAM';
    }
    return nettoye.slice(0, 6);
  }

  /**
   * Génère un code candidat formaté {CODE}-C{NUM}
   * @param schoolCode Code ou sous-domaine de l'école
   * @param sequenceNumber Numéro d'ordre (1, 2, 3...)
   * @param padLength Nombre minimum de chiffres (défaut: 3 -> 001, 002)
   */
  public static genererCode(schoolCode: string, sequenceNumber: number, padLength = 3): string {
    if (sequenceNumber <= 0 || !Number.isInteger(sequenceNumber)) {
      throw new Error(`Le numéro d'ordre doit être un entier positif (reçu: ${sequenceNumber})`);
    }

    const codeEco = this.normaliserCodeEtablissement(schoolCode);
    const numPad = sequenceNumber.toString().padStart(padLength, '0');
    return `${codeEco}-C${numPad}`;
  }

  /**
   * Valide si une chaîne respecte le format standard d'un code candidat
   */
  public static validerCode(code: string): boolean {
    if (!code || typeof code !== 'string') return false;
    return this.CODE_REGEX.test(code.trim());
  }

  /**
   * Extrait le code établissement et le numéro séquentiel depuis un code candidat
   */
  public static extraireCode(code: string): ParsedCandidateCode | null {
    if (!code) return null;
    const match = code.trim().match(this.CODE_REGEX);
    if (!match) return null;

    return {
      schoolCode: match[1],
      sequenceNumber: parseInt(match[2], 10),
    };
  }
}
