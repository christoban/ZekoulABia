/**
 * DOMAIN — Convention unique de numérotation des jours pour TimetableSlot.dayOfWeek.
 *
 * 0 = Lundi … 5 = Samedi. C'est la seule convention valide : `CreneauHoraire.create()` rejette
 * tout jour hors 0-5, et `ConflitHoraireError`/`ConflitSalleError` nomment les jours par cet
 * index.
 *
 * Historique — jusqu'au chantier de rebranchement, trois chemins écrivaient en 1-6 (LUNDI=1) en
 * passant directement par Prisma sans l'entité (generate-skeleton, TimetableAutoController
 * autoGenerate/adjust). Les deux conventions cohabitaient dans la même table, ce qui rendait la
 * détection de conflit aveugle entre elles : un lundi stocké en 1 et un lundi stocké en 0 ne se
 * voyaient jamais, donc un enseignant pouvait être double-booké sans qu'aucune vérification ne
 * s'en aperçoive. Ce module existe pour qu'il n'y ait plus qu'UN endroit qui définisse ce mapping.
 */
export const JOUR_VERS_INDEX: Record<string, number> = {
  LUNDI: 0, MARDI: 1, MERCREDI: 2, JEUDI: 3, VENDREDI: 4, SAMEDI: 5,
};

/** Libellés indexés par dayOfWeek (0=Lundi) — pour les messages d'erreur et l'affichage. */
export const NOMS_JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'] as const;

/** Convertit les `joursActifs` de TimetableGridConfig (['LUNDI', …]) en index 0-5, dans l'ordre. */
export function joursActifsVersIndex(joursActifs: string[]): number[] {
  return joursActifs
    .map(j => JOUR_VERS_INDEX[j])
    .filter((j): j is number => j !== undefined);
}
