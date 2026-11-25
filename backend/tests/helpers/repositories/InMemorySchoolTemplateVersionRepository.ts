import type { SchoolTemplateVersion, SchoolTemplateVersionRepository } from '@domain/ports/repositories/SchoolTemplateVersionRepository';

export class InMemorySchoolTemplateVersionRepository implements SchoolTemplateVersionRepository {
  private versions: SchoolTemplateVersion[] = [];

  constructor(versions: SchoolTemplateVersion[] = []) {
    this.versions = versions;
  }

  async trouverVersionActive(templateCode: string): Promise<SchoolTemplateVersion | null> {
    return this.versions.find((v) => v.templateCode === templateCode && v.active) ?? null;
  }

  async trouverParCodeEtVersion(templateCode: string, version: number): Promise<SchoolTemplateVersion | null> {
    return this.versions.find((v) => v.templateCode === templateCode && v.version === version) ?? null;
  }

  async publierNouvelleVersion(templateCode: string, config: Record<string, unknown>): Promise<SchoolTemplateVersion> {
    // Désactiver les versions actives existantes
    for (const v of this.versions) {
      if (v.templateCode === templateCode && v.active) {
        v.active = false;
      }
    }
    const derniereVersion = this.versions
      .filter((v) => v.templateCode === templateCode)
      .reduce((max, v) => Math.max(max, v.version), 0);
    const nouvelleVersion: SchoolTemplateVersion = {
      id: crypto.randomUUID(),
      templateCode,
      version: derniereVersion + 1,
      config,
      publishedAt: new Date(),
      active: true,
      createdAt: new Date(),
    };
    this.versions.push(nouvelleVersion);
    return nouvelleVersion;
  }

  async listerVersions(templateCode: string): Promise<SchoolTemplateVersion[]> {
    return this.versions
      .filter((v) => v.templateCode === templateCode)
      .sort((a, b) => b.version - a.version);
  }
}
