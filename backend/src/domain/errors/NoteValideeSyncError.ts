/**
 * DOMAIN LAYER — Logique métier pure
 * Loi 6 : Une note avec statut VALIDATED ne peut pas être modifiée
 * lors d'une synchronisation hors ligne. La modification est rejetée.
 */
export class NoteValideeSyncError extends Error {
  constructor(noteId: string, matiereNom: string) {
    super(
      `Synchronisation rejetée : la note "${noteId}" (${matiereNom}) ` +
      `est déjà LOCKED et ne peut plus être modifiée hors ligne.`
    );
    this.name = 'NoteValideeSyncError';
  }
}
