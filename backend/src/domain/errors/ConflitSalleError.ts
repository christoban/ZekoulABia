export class ConflitSalleError extends Error {
  constructor(
    salleNom: string,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    classeConflictNom: string
  ) {
    const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const jour = jours[dayOfWeek] ?? `Jour ${dayOfWeek}`;
    super(
      `Conflit de salle : "${salleNom}" est déjà occupée le ${jour} ` +
      `de ${startTime} à ${endTime} (classe "${classeConflictNom}")`
    );
    this.name = 'ConflitSalleError';
  }
}
