/** Normalisation unique des matricules nationaux avant comparaison ou stockage. */
export function normalizeNationalId(value: string): string {
  return value.replace(/\s+/g, '').trim().toUpperCase();
}

export function validateNationalId(value: string): string {
  const normalized = normalizeNationalId(value);
  if (!normalized || !/^[A-Z0-9]+$/.test(normalized)) {
    throw new Error('Le matricule national doit être alphanumérique et non vide.');
  }
  return normalized;
}
