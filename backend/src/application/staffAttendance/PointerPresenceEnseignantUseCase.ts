/**
 * APPLICATION LAYER — Use Case : Pointer la présence d'un enseignant (V2.11)
 *
 * Trois modes, scope strictement TEACHER :
 * - QR : token signé horodaté de salle → vérif signature + expiration + croisement TimetableSlot
 *        courant (salle + enseignant + plage horaire). Ne marche que si room.qrEnabled.
 * - GPS : si aucune salle QR configurée, pointage GPS contre le rayon calibré de l'école. Si le
 *        GPS échoue ou est refusé → enregistrement A_VERIFIER (jamais bloquant).
 * - MANUEL : saisie RH (legacy), mode explicite.
 */
import type { StaffAttendanceRepository, StaffAttendanceData } from '@domain/ports/repositories/StaffAttendanceRepository';
import type { TimetableRepository } from '@domain/ports/repositories/TimetableRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { QrTokenService } from '@domain/ports/services/QrTokenService';

export interface PointerPresenceEnseignantCommande {
  teacherId: string;
  schoolId: string;
  /** null si l'enseignant n'a pas encore scanné — l'école génère le QR à afficher. */
  qrToken?: string | null;
  mode: 'QR' | 'GPS' | 'MANUEL';
  latitude?: number | null;
  longitude?: number | null;
  now?: Date;
}

export interface PointerPresenceEnseignantResultat {
  attendance: StaffAttendanceData;
  slot: { id: string; subjectName: string | null; className: string | null } | null;
  /** vrai si le pointage est passé en A_VERIFIER (GPS échoué/refusé) — non bloquant. */
  aVerifier: boolean;
}

export class PointerPresenceEnseignantUseCase {
  constructor(
    private readonly staffAttendanceRepository: StaffAttendanceRepository,
    private readonly timetableRepository: TimetableRepository,
    private readonly userRepository: UserRepository,
    private readonly qrTokenService: QrTokenService,
  ) {}

  async execute(cmd: PointerPresenceEnseignantCommande): Promise<PointerPresenceEnseignantResultat> {
    const now = cmd.now ?? new Date();

    // 1. Scope : enseignant uniquement
    const user = await this.userRepository.findById(cmd.teacherId);
    if (!user || user.role !== 'TEACHER') {
      throw new Error('Seul un enseignant peut pointer sa présence');
    }
    if (user.schoolId !== cmd.schoolId) {
      throw new Error('Enseignant introuvable dans cet établissement');
    }

    const date = new Date(now);
    date.setHours(0, 0, 0, 0);

    // 2. QR — ne marche que si une salle QR est configurée
    if (cmd.mode === 'QR') {
      if (!cmd.qrToken) {
        throw new Error('Token QR manquant');
      }
      const verification = this.qrTokenService.verifierToken(cmd.qrToken);
      if (!verification.ok) {
        const raison = 'raison' in verification ? verification.raison : 'SIGNATURE_INVALIDE';
        throw new Error(raison === 'EXPIRED' ? 'QR expiré — régénérez le code' : 'QR invalide');
      }
      const payload = verification.payload;
      if (payload.schoolId !== cmd.schoolId) {
        throw new Error('QR d\'un autre établissement');
      }

      const qrEnabled = await this.staffAttendanceRepository.salleQrEnabled(payload.roomId, cmd.schoolId);
      if (!qrEnabled) {
        throw new Error('QR non configuré pour cette salle');
      }

      // Croisement avec le créneau courant
      const slot = await this.timetableRepository.findSlotActuelParSalleEtEnseignant(
        payload.roomId,
        cmd.teacherId,
        cmd.schoolId,
        now,
      );
      if (!slot) {
        throw new Error('Aucun cours programmé pour cette salle en ce moment');
      }

      const attendance = await this.staffAttendanceRepository.pointer({
        userId: cmd.teacherId,
        schoolId: cmd.schoolId,
        date,
        statut: 'PRESENT',
        mode: 'QR',
        roomId: payload.roomId,
        timetableSlotId: slot.id,
        qrToken: cmd.qrToken,
      });
      return {
        attendance,
        slot: { id: slot.id, subjectName: slot.subjectName, className: slot.className },
        aVerifier: false,
      };
    }

    // 3. GPS — pointage contre le rayon calibré de l'école
    if (cmd.mode === 'GPS') {
      const settings = await this.staffAttendanceRepository.getSettings(cmd.schoolId);
      const aVerifier = typeof cmd.latitude !== 'number' || typeof cmd.longitude !== 'number'
        || !estDansRayon(cmd.latitude, cmd.longitude, settings);

      const attendance = await this.staffAttendanceRepository.pointer({
        userId: cmd.teacherId,
        schoolId: cmd.schoolId,
        date,
        statut: aVerifier ? 'A_VERIFIER' : 'PRESENT',
        mode: 'GPS',
        latitude: cmd.latitude ?? null,
        longitude: cmd.longitude ?? null,
      });
      return { attendance, slot: null, aVerifier };
    }

    // 4. MANUEL — saisie RH legacy
    const attendance = await this.staffAttendanceRepository.pointer({
      userId: cmd.teacherId,
      schoolId: cmd.schoolId,
      date,
      statut: 'PRESENT',
      mode: 'MANUEL',
    });
    return { attendance, slot: null, aVerifier: false };
  }

  /** Génère le token QR à afficher pour une salle (enseignant authentifié). */
  async genererTokenSalle(roomId: string, schoolId: string): Promise<string> {
    const settings = await this.staffAttendanceRepository.getSettings(schoolId);
    const qrEnabled = await this.staffAttendanceRepository.salleQrEnabled(roomId, schoolId);
    if (!qrEnabled) throw new Error('QR non configuré pour cette salle');
    return this.qrTokenService.genererTokenSalle(roomId, schoolId, settings.qrTokenTtlSeconds);
  }
}

function estDansRayon(lat: number, lng: number, settings: { schoolLatitude: number | null; schoolLongitude: number | null; gpsRadiusMeters: number }): boolean {
  // Sans référence GPS de l'école (calibration non faite), aucune coordonnée ne peut être validée
  // → A_VERIFIER (le pointage est enregistré, non bloquant). C'est le comportement voulu tant que
  // le RH n'a pas calibré le centre de l'école (dérive hardware — voir note du chantier).
  if (settings.schoolLatitude == null || settings.schoolLongitude == null) return false;
  const dLat = (lat - settings.schoolLatitude) * 111320;
  const dLng = (lng - settings.schoolLongitude) * 111320 * Math.cos((settings.schoolLatitude * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng) <= settings.gpsRadiusMeters;
}