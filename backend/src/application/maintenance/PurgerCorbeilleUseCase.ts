import type { CorbeilleRepository } from '@domain/ports/repositories/CorbeilleRepository';

export class PurgerCorbeilleUseCase {
  constructor(private readonly corbeilleRepository: CorbeilleRepository) {}

  async execute(params?: { cutoff?: Date }): Promise<{ purged: true }> {
    const cutoff =
      params?.cutoff ??
      new Date(Date.now() - parseInt(process.env.PURGE_GRACE_PERIOD_DAYS || '30', 10) * 24 * 60 * 60 * 1000);
    await this.corbeilleRepository.purgerTout(cutoff);
    return { purged: true as const };
  }

  async purgerUtilisateurs(cutoff: Date) {
    return this.corbeilleRepository.purgerUtilisateurs(cutoff);
  }

  async purgerClasses(cutoff: Date) {
    return this.corbeilleRepository.purgerClasses(cutoff);
  }

  async purgerMatieres(cutoff: Date) {
    return this.corbeilleRepository.purgerMatieres(cutoff);
  }
}
