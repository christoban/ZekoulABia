/**
 * DOMAIN LAYER — Port Repository pour la persistance des versions de specs de bulletins.
 *
 * Une spec publiée (status === 'PUBLISHED') est immuable : toute évolution crée
 * une nouvelle version (`version + 1`).
 */
import type { BulletinTemplateSpec } from '@domain/types/bulletinTemplateSpec';

export interface BulletinTemplateSpecRepository {
  findAll(): Promise<BulletinTemplateSpec[]>;
  findBySpecAndVersion(specId: string, version: number): Promise<BulletinTemplateSpec | null>;
  saveVersion(spec: BulletinTemplateSpec, createdById?: string | null): Promise<BulletinTemplateSpec>;
}
