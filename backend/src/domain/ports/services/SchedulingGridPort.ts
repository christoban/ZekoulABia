export interface PeriodeGrille {
  ordre: number;
  debut: string;
  fin: string;
  type: 'COURS' | 'PETITE_PAUSE' | 'GRANDE_PAUSE';
  duree: number;
}

export interface SchedulingGridPort {
  calculerSqelette(cfg: {
    heureDebut: string;
    dureePeriode: number;
    periodesAvantP1: number;
    dureePetitePause: number;
    periodesAvantP2: number;
    dureeGrandePause: number;
    periodesApresP2: number;
    periodesCoursParJour?: Record<string, number>;
  }, jour?: string): PeriodeGrille[];
}
