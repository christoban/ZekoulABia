export class ConflitHoraireError extends Error {
  constructor(
    enseignantNom: string,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    classeConflictNom: string
  ) {
    const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const jour = jours[dayOfWeek] ?? `Jour ${dayOfWeek}`;
    super(
      `Conflit d'horaire : "${enseignantNom}" est déjà occupé le ${jour} ` +
      `de ${startTime} à ${endTime} (classe "${classeConflictNom}")`
    );
    this.name = 'ConflitHoraireError';
  }
}
