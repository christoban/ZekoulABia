import type { AnonymatLinkGeneratorPort } from '@domain/ports/services/AnonymatLinkGeneratorPort';
import type { AppConfigPort } from '@domain/ports/services/AppConfigPort';

export class AnonymatLinkGenerator implements AnonymatLinkGeneratorPort {
  constructor(private readonly config: AppConfigPort) {}

  buildListUrl(rawToken: string): string {
    return `${this.config.frontendBaseUrl()}/anonymat/${rawToken}`;
  }
} 