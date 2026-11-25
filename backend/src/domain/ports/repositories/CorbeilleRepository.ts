export interface CorbeilleRepository {
  purgerUtilisateurs(cutoff: Date): Promise<{ count: number }>;
  purgerClasses(cutoff: Date): Promise<{ count: number }>;
  purgerMatieres(cutoff: Date): Promise<{ count: number }>;
  /** Orchestre les trois purges. */
  purgerTout(cutoff: Date): Promise<void>;
}
