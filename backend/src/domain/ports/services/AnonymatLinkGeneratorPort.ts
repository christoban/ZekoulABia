export interface AnonymatLinkGeneratorPort {
  /** Construit l’URL publique pour un raw token */
  buildListUrl(rawToken: string): string;
}