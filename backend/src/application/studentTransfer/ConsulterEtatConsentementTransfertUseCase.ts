import type { ConsentChallengeState, GuardianConsentPort } from '@domain/ports/services/GuardianConsentPort';

export class ConsulterEtatConsentementTransfertUseCase {
  constructor(private readonly consent: GuardianConsentPort) {}

  /** État du challenge de consentement, vu par le tuteur (jeton = secret NEVER consommé). */
  execute(input: { token: string; requestId: string }): Promise<ConsentChallengeState | null> {
    if (!input.token) return Promise.resolve(null);
    return this.consent.describeIfHolder(input);
  }
}
