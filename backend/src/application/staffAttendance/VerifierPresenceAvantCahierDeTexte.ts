/**
 * APPLICATION LAYER — Use Case : Vérifier la présence avant saisie du cahier de textes (V2.11)
 *
 * Gate non bloquante par défaut : elle ne bloque la saisie du cahier de textes que si un mode de
 * pointage fiable était disponible (QR configuré non scanné) et n'a pas été utilisé. Elle ne
 * bloque JAMAIS si le seul état possible est A_VERIFIER faute de mode fiable (pas de salle QR).
 *
 * Logique de la garde :
 * - Si l'enseignant a déjà une présence PRESENT pour le créneau courant → OK (gate passée).
 * - Sinon, si un créneau courant (EDT) existe avec une salle QR configurée → le pointage devait
 *   se faire par QR → gate BLOQUE (erreur).
 * - Sinon (pas de salle QR, ou pas de créneau courant) → aucun mode fiable disponible → on ne
 *   bloque pas (le GPS échoué produit un A_VERIFIER non bloquant).
 */
import type { StaffAttendanceRepository } from '@domain/ports/repositories/StaffAttendanceRepository';
import type { TimetableRepository } from '@domain/ports/repositories/TimetableRepository';

export class VerifierPresenceAvantCahierDeTexte {
  constructor(
    private readonly staffAttendanceRepository: StaffAttendanceRepository,
    private readonly timetableRepository: TimetableRepository,
  ) {}

  async execute(input: {
    teacherId: string;
    schoolId: string;
    now?: Date;
  }): Promise<void> {
    const now = input.now ?? new Date();
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);

    // 1. Créneau courant de l'enseignant (EDT)
    const slot = await this.findSlotEnseignantCourant(input.teacherId, input.schoolId, now);
    if (!slot) return; // pas de cours programmé → rien à gater

    // 2. Déjà pointé PRESENT sur ce créneau ?
    const presence = await this.staffAttendanceRepository.trouverPresencePourCreneau(
      input.teacherId,
      input.schoolId,
      date,
      slot.id,
    );
    if (presence && presence.statut === 'PRESENT') return;

    // 3. Un mode fiable était-il disponible ? (salle QR configurée sur le créneau courant)
    const roomId = await this.timetableRepository.findRoomIdDeSlot(slot.id);
    if (!roomId) return; // pas de salle attribuée → pas de QR possible
    const qrEnabled = await this.staffAttendanceRepository.salleQrEnabled(roomId, input.schoolId);
    if (!qrEnabled) return; // pas de salle QR → GPS seul → A_VERIFIER non bloquant

    // 4. QR configuré mais non scanné → gate bloquante
    throw new Error('Vous devez pointer votre présence (QR de la salle) avant de saisir le cahier de textes');
  }

  private async findSlotEnseignantCourant(teacherId: string, schoolId: string, now: Date) {
    const dayOfWeek = (now.getDay() + 6) % 7;
    const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const slots = await this.timetableRepository.findSlotsEnseignantJour(teacherId, dayOfWeek, schoolId);
    return slots.find(s => s.startTime <= nowHHMM && s.endTime > nowHHMM) ?? null;
  }
}