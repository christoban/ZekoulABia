import type { SchoolActivationRepository, SchoolActivationData } from '@domain/ports/repositories/SchoolActivationRepository';

export class InMemorySchoolActivationRepository implements SchoolActivationRepository {
  schools = new Map<string, SchoolActivationData>();
  activationCalls: string[] = [];

  async findSchoolForActivation(schoolId: string): Promise<SchoolActivationData | null> {
    return this.schools.get(schoolId) ?? null;
  }

  async mettreAJourOnboardingConfig(_schoolId: string, _data: { onboardingConfig: unknown; templateCode?: string }): Promise<void> {
    const school = this.schools.get(_schoolId);
    if (school) this.schools.set(_schoolId, { ...school, ..._data });
  }

  async activerEtablissement<T>(schoolId: string, operation: (tx: any) => Promise<T>): Promise<T> {
    this.activationCalls.push(schoolId);
    // Retourne le résultat de la callback mais avec un tx minimaliste
    return operation({} as any);
  }
}
