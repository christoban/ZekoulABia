/**
 * DOMAIN SERVICE — Génération et validation du Numéro Interne d'élève.
 *
 * Format standardisé pour les établissements camerounais :
 *   {CODE_ETABLISSEMENT}-{ANNEE}-{SEQUENCE}
 *
 * Exemples :
 *   - "LBA-2026-0001"
 *   - "COLSTJ-2026-0042"
 */

export interface NumeroInterneComposants {
  schoolCode: string;
  year: number;
  sequence: number;
}

export function cleanSchoolCode(rawCode: string | null | undefined): string {
  if (!rawCode) return 'SCH';
  const cleaned = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return cleaned.length > 0 ? cleaned.slice(0, 8) : 'SCH';
}

export function formatNumeroInterne(schoolCode: string, year: number, sequence: number): string {
  const cleanCode = cleanSchoolCode(schoolCode);
  const cleanYear = Math.max(2000, Math.min(2100, Math.floor(year)));
  const cleanSeq = Math.max(1, Math.floor(sequence));
  const seqStr = String(cleanSeq).padStart(4, '0');
  return `${cleanCode}-${cleanYear}-${seqStr}`;
}

export function parseNumeroInterne(numero: string): NumeroInterneComposants | null {
  if (!numero || typeof numero !== 'string') return null;
  const parts = numero.trim().split('-');
  if (parts.length !== 3) return null;

  const [schoolCode, yearStr, seqStr] = parts;
  const year = parseInt(yearStr, 10);
  const sequence = parseInt(seqStr, 10);

  if (isNaN(year) || isNaN(sequence) || !schoolCode) return null;
  return { schoolCode, year, sequence };
}
