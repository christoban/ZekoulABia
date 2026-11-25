import type {
  InvitationRepository,
  InvitationProps,
  CompleteOnboardingCommand,
} from '@domain/ports/repositories/InvitationRepository';

export class InMemoryInvitationRepository implements InvitationRepository {
  private store = new Map<string, InvitationProps>();

  ajouter(inv: InvitationProps): void { this.store.set(inv.token, inv); }
  vider(): void { this.store.clear(); }

  async findByToken(token: string) { return this.store.get(token) ?? null; }
  async findBySchoolId(schoolId: string) {
    return [...this.store.values()].filter(i => i.schoolId === schoolId);
  }
  async findPendingByEmail(email: string) {
    return [...this.store.values()].find(i => i.email === email && i.status === 'PENDING') ?? null;
  }
  async save(inv: InvitationProps) { this.store.set(inv.token, inv); }
  async update(inv: InvitationProps) { this.store.set(inv.token, inv); }
  async expireToutes(schoolId: string) {
    for (const [key, inv] of this.store) {
      if (inv.schoolId === schoolId && inv.status === 'PENDING') {
        this.store.set(key, { ...inv, status: 'EXPIRED' });
      }
    }
  }
  async marquerUtilisee(token: string) {
    const inv = this.store.get(token);
    if (inv) this.store.set(token, { ...inv, status: 'USED' });
  }
  async marquerExpiree(token: string) {
    const inv = this.store.get(token);
    if (inv) this.store.set(token, { ...inv, status: 'EXPIRED' });
  }
  async completeOnboarding(command: CompleteOnboardingCommand) {
    const inv = this.store.get(command.token);
    if (inv) {
      this.store.set(command.token, { ...inv, status: 'USED', schoolId: command.school.id });
    }
    return { schoolId: command.school.id };
  }
}
