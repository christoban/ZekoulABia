/**
 * DOMAIN LAYER — Port de rendu des bulletins scolaires
 *
 * Contrat pur : prend un snapshot mathématiquement scellé, une spec déclarative JSON
 * et le contexte d'identité de l'école, et retourne le Buffer PDF final.
 * Ne réalise aucun calcul de moyenne ou de rang.
 */
import type { StudentBulletinSnapshot } from '@domain/types/bulletinSnapshot';
import type { BulletinTemplateSpec } from '@domain/types/bulletinTemplateSpec';

export interface SchoolIdentityRenderContext {
  schoolName: string;
  schoolMotto?: string | null;
  regionalDelegation?: string | null;
  departmentalDelegation?: string | null;
  city?: string | null;
  phone?: string | null;
  bp?: string | null;
  logoUrl?: string | null;
  coatOfArmsEnabled?: boolean;
  logoBuffer?: Buffer | null;
  coatOfArmsBuffer?: Buffer | null;
  stampBuffer?: Buffer | null;
  principalSignatureBuffer?: Buffer | null;
  accentColor?: string | null;
}

export interface BulletinGradingPolicy {
  mode: string;
  evalCount?: number;
  classTestWeight?: number;
  terminalExamWeight?: number;
  ds1Weight?: number;
  ds2Weight?: number;
  compositionWeight?: number;
}

export interface BulletinRenderOptions {
  className: string;
  periodName: string;
  yearName: string;
  mention: string;
  classMasterComment?: string | null;
  isOfficial?: boolean;
  isAnnual?: boolean;
  verifyUrl?: string;
  verifyToken?: string;
  shortVerifyCode?: string;
  isDuplicate?: boolean;
  reprintCount?: number;
  seq1Label?: string;
  seq2Label?: string;
  language: 'fr' | 'en';
  school: SchoolIdentityRenderContext;
  gradingPolicy?: BulletinGradingPolicy;
  studentPhotoBuffer?: Buffer | null;
  issuedAt?: Date;
}

export interface BulletinRendererPort {
  readonly engineName: string;

  render(
    snapshot: StudentBulletinSnapshot,
    templateSpec: BulletinTemplateSpec,
    options: BulletinRenderOptions,
  ): Promise<Buffer>;

  renderBatch?(
    items: Array<{ snapshot: StudentBulletinSnapshot; options: BulletinRenderOptions }>,
    templateSpec: BulletinTemplateSpec,
  ): Promise<Buffer[]>;
}

