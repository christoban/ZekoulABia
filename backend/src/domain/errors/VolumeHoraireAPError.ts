/**
 * DOMAIN LAYER — Logique métier pure
 * Loi 7 — Circulaire 32/09/MINESEC/IGE :
 * Un Animateur Pédagogique (AP) / Head of Department (HOD)
 * ne peut pas dépasser 14h d'enseignement par semaine.
 */
export class VolumeHoraireAPError extends Error {
  constructor(enseignantNom: string, heuresActuelles: number) {
    super(
      `Volume horaire AP dépassé (Circulaire 32/09/MINESEC/IGE). ` +
      `${enseignantNom} a déjà ${heuresActuelles}h/semaine. ` +
      `Maximum autorisé : 14h.`
    );
    this.name = 'VolumeHoraireAPError';
  }
}
