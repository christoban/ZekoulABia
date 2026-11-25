import type { SchedulingGridPort, PeriodeGrille } from '@domain/ports/services/SchedulingGridPort';
import { calculerSqelette } from '../http/controllers/TimetableGridConfigController';

export class SchedulingGridAdapter implements SchedulingGridPort {
  calculerSqelette(cfg: {
    heureDebut: string;
    dureePeriode: number;
    periodesAvantP1: number;
    dureePetitePause: number;
    periodesAvantP2: number;
    dureeGrandePause: number;
    periodesApresP2: number;
    periodesCoursParJour?: Record<string, number>;
  }, jour?: string): PeriodeGrille[] {
    return calculerSqelette(cfg, jour);
  }
}
