import type { Request, Response, NextFunction } from 'express';
import { peutVoirEcoleMaster, verifierAccesGestionEcoleMaster, type MasterOperatorContext } from '@application/masterAdmin/masterSchoolAccess';
import { renderAtelierPreviewPdf } from '@application/reportCard/bulletinAtelierPreview';
import { SchoolAssetValidationError } from '@domain/errors/SchoolAssetValidationError';
import { KNOWN_CLASS_LEVELS, assertValidClassLevel } from '@domain/policies/BulletinTemplatePolicy';
import type { BulletinTemplateAssignmentRepository } from '@domain/ports/repositories/BulletinTemplateAssignmentRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { MasterAdminQueryRepository } from '@domain/ports/repositories/MasterAdminQueryRepository';
import type { SchoolConfigRepository } from '@domain/ports/repositories/SchoolConfigRepository';
import type { SchoolIdentityKitRecord, SchoolIdentityKitRepository } from '@domain/ports/repositories/SchoolIdentityKitRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { BulletinRendererPort } from '@domain/ports/services/BulletinRendererPort';
import type { SchoolAssetKind, SchoolAssetStoragePort } from '@domain/ports/services/SchoolAssetStoragePort';
import {
  GENERAL_GROUPED_V1,
  createNewTemplateSpecVersion,
  getPublishedTemplateSpec,
  getTemplateSpecAnyStatus,
  listAllTemplateSpecs,
  registerTemplateSpecVersion,
} from '@domain/templates/bulletinCatalog';
import {
  deepFreezeSpec,
  type BulletinTemplateBlock,
  type BulletinTemplateSpec,
  type CouncilDecisionSpecItem,
  type PeriodLabelMode,
  type SubjectTableBlockSpec,
} from '@domain/types/bulletinTemplateSpec';
import type { BulletinGroupingScheme, BulletinPeriodKind, BulletinTemplate } from '@domain/types/enums';

const ASSET_FIELD_BY_KIND: Record<SchoolAssetKind, keyof Pick<SchoolIdentityKitRecord, 'logoAssetKey' | 'coatOfArmsAssetKey' | 'stampAssetKey' | 'principalSignatureAssetKey' | 'censorSignatureAssetKey'>> = {
  logo: 'logoAssetKey',
  coatOfArms: 'coatOfArmsAssetKey',
  stamp: 'stampAssetKey',
  principalSignature: 'principalSignatureAssetKey',
  censorSignature: 'censorSignatureAssetKey',
};

function toMasterContext(req: Request): MasterOperatorContext | null {
  const m = req.masterUser;
  if (!m) return null;
  return { id: m.id, role: m.role, isOwner: m.isOwner, assignedSchoolIds: m.assignedSchoolIds };
}

function cleanStr(val: unknown): string | null | undefined {
  if (val === undefined) return undefined;
  if (val === null) return null;
  if (typeof val !== 'string') return undefined;
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function applySpecOverrides(
  base: Readonly<BulletinTemplateSpec>,
  overrides?: Record<string, unknown>,
): Readonly<BulletinTemplateSpec> {
  if (!overrides) return base;
  const clone = structuredClone(base) as BulletinTemplateSpec;
  if (overrides.language === 'fr' || overrides.language === 'en' || overrides.language === 'bilingual') {
    clone.language = overrides.language;
  }
  if (typeof overrides.defaultGroupingScheme === 'string') {
    clone.defaultGroupingScheme = overrides.defaultGroupingScheme as BulletinGroupingScheme;
  }
  if (typeof overrides.showGroupRankInSubtotal === 'boolean') {
    clone.showGroupRankInSubtotal = overrides.showGroupRankInSubtotal;
  }
  const blocks: BulletinTemplateBlock[] = clone.blocks.map((block) => {
    if (block.type === 'officialHeader' && typeof overrides.periodLabelMode === 'string') {
      return { ...block, periodLabelMode: overrides.periodLabelMode as PeriodLabelMode };
    }
    if (block.type === 'subjectTable' && typeof overrides.appreciationScale === 'string') {
      return { ...block, appreciationScale: overrides.appreciationScale as SubjectTableBlockSpec['appreciationScale'] };
    }
    if (block.type === 'councilDecision' && Array.isArray(overrides.councilItems)) {
      return { ...block, items: overrides.councilItems as CouncilDecisionSpecItem[] };
    }
    return block;
  });
  clone.blocks = blocks;
  return deepFreezeSpec(clone);
}

export class MasterBulletinAtelierController {
  constructor(
    private readonly masterAdminQueryRepo: MasterAdminQueryRepository,
    private readonly schoolRepository: SchoolRepository,
    private readonly schoolConfigRepository: SchoolConfigRepository,
    private readonly schoolIdentityKitRepository: SchoolIdentityKitRepository,
    private readonly assignmentRepository: BulletinTemplateAssignmentRepository,
    private readonly classeRepository: ClasseRepository,
    private readonly bulletinRenderer: BulletinRendererPort,
    private readonly schoolAssetStorage: SchoolAssetStoragePort,
  ) {}

  private async ensureViewAccess(req: Request, res: Response, schoolId: string): Promise<boolean> {
    const basic = await this.masterAdminQueryRepo.findSchoolBasic(schoolId);
    if (!basic) {
      res.status(404).json({ success: false, message: 'Établissement introuvable.' });
      return false;
    }
    if (!peutVoirEcoleMaster(toMasterContext(req), basic.id, basic.createdByMasterId)) {
      res.status(403).json({ success: false, message: 'Accès refusé pour cet établissement.' });
      return false;
    }
    return true;
  }

  private async ensureManageAccess(req: Request, res: Response, schoolId: string): Promise<boolean> {
    const access = await verifierAccesGestionEcoleMaster(this.masterAdminQueryRepo, toMasterContext(req), schoolId);
    if (access.introuvable) {
      res.status(404).json({ success: false, message: 'Établissement introuvable.' });
      return false;
    }
    if (!access.autorise) {
      res.status(403).json({ success: false, message: 'Seul le périmètre autorisé (super_admin, platform_admin ou school_manager assigné) peut modifier ce modèle.' });
      return false;
    }
    return true;
  }

  // GET /api/v2/master/bulletin-atelier/schools/:schoolId
  getAtelierState = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.params.schoolId as string;
      if (!(await this.ensureViewAccess(req, res, schoolId))) return;

      const [school, schoolConfig, identityKit, assignments, classes] = await Promise.all([
        this.schoolRepository.findById(schoolId),
        this.schoolConfigRepository.findBySchoolId(schoolId),
        this.schoolIdentityKitRepository.findBySchoolId(schoolId),
        this.assignmentRepository.findBySchool(schoolId),
        this.classeRepository.findBySchool(schoolId),
      ]);
      if (!school) {
        res.status(404).json({ success: false, message: 'Établissement introuvable.' });
        return;
      }
      const sObj = school.toObject();
      res.json({
        success: true,
        data: {
          school: {
            id: sObj.id,
            name: sObj.name,
            subdomain: sObj.subdomain,
            subsystem: sObj.subsystem,
            educationType: sObj.educationType,
            city: sObj.city,
            phone: sObj.phone,
            logoUrl: sObj.logoUrl,
          },
          schoolConfig: schoolConfig ?? {
            bulletinTemplate: 'FR_SECONDARY',
            bulletinGroupingScheme: 'FLAT',
            useMeasuredBulletinRenderer: false,
          },
          identityKit,
          assignments,
          catalogSpecs: listAllTemplateSpecs({ includeDrafts: true }),
          classes: classes.map((c) => {
            const co = c.toObject();
            return { id: co.id, name: co.name, level: co.level ?? null };
          }),
          knownClassLevels: KNOWN_CLASS_LEVELS,
          canEdit: peutVoirEcoleMaster(toMasterContext(req), schoolId) &&
            (await verifierAccesGestionEcoleMaster(this.masterAdminQueryRepo, toMasterContext(req), schoolId)).autorise,
        },
      });
    } catch (error) { next(error); }
  };

  // PUT /api/v2/master/bulletin-atelier/schools/:schoolId/identity-kit
  saveIdentityKitAndConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.params.schoolId as string;
      if (!(await this.ensureManageAccess(req, res, schoolId))) return;

      const b = (req.body ?? {}) as Record<string, unknown>;
      const kit = await this.schoolIdentityKitRepository.upsert({
        schoolId,
        regionalDelegationFr: cleanStr(b.regionalDelegationFr),
        regionalDelegationEn: cleanStr(b.regionalDelegationEn),
        departmentalDelegationFr: cleanStr(b.departmentalDelegationFr),
        departmentalDelegationEn: cleanStr(b.departmentalDelegationEn),
        mottoFr: cleanStr(b.mottoFr),
        mottoEn: cleanStr(b.mottoEn),
        poBox: cleanStr(b.poBox),
        city: cleanStr(b.city),
        phone: cleanStr(b.phone),
        foundingYear: typeof b.foundingYear === 'number' ? b.foundingYear : b.foundingYear === null ? null : undefined,
        authorizationNumber: cleanStr(b.authorizationNumber),
        accentColor: cleanStr(b.accentColor),
        useCoatOfArms: typeof b.useCoatOfArms === 'boolean' ? b.useCoatOfArms : undefined,
        updatedById: req.masterUser?.id ?? null,
      });

      const hasCfgChange =
        b.bulletinTemplate !== undefined ||
        b.bulletinGroupingScheme !== undefined ||
        b.useMeasuredBulletinRenderer !== undefined;
      const schoolConfig =
        hasCfgChange && this.schoolConfigRepository.upsertBulletinConfig
          ? await this.schoolConfigRepository.upsertBulletinConfig(schoolId, {
              bulletinTemplate: b.bulletinTemplate as BulletinTemplate | undefined,
              bulletinGroupingScheme: b.bulletinGroupingScheme as BulletinGroupingScheme | undefined,
              useMeasuredBulletinRenderer:
                typeof b.useMeasuredBulletinRenderer === 'boolean' ? b.useMeasuredBulletinRenderer : undefined,
            })
          : await this.schoolConfigRepository.findBySchoolId(schoolId);

      res.json({ success: true, data: { identityKit: kit, schoolConfig } });
    } catch (error) { next(error); }
  };

  // POST /api/v2/master/bulletin-atelier/schools/:schoolId/identity-kit/assets/:assetType
  uploadIdentityAsset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.params.schoolId as string;
      const assetType = req.params.assetType as SchoolAssetKind;
      if (!(assetType in ASSET_FIELD_BY_KIND)) {
        res.status(400).json({ success: false, message: `Type de média invalide : ${assetType}` });
        return;
      }
      if (!(await this.ensureManageAccess(req, res, schoolId))) return;

      const dataUri = typeof req.body?.dataUri === 'string' ? req.body.dataUri : '';
      if (!dataUri) {
        res.status(400).json({ success: false, message: 'Champ dataUri base64 PNG/JPEG requis.' });
        return;
      }

      const stored = await this.schoolAssetStorage.validateAndStoreAsset({
        schoolId,
        kind: assetType,
        data: dataUri,
      });
      const fieldName = ASSET_FIELD_BY_KIND[assetType];
      const identityKit = await this.schoolIdentityKitRepository.upsert({
        schoolId,
        [fieldName]: stored.assetKey,
        updatedById: req.masterUser?.id ?? null,
      });

      res.json({ success: true, data: { asset: stored, identityKit } });
    } catch (error) {
      if (error instanceof SchoolAssetValidationError) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };

  // POST /api/v2/master/bulletin-atelier/schools/:schoolId/specs/version
  createSpecVersion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.params.schoolId as string;
      if (!(await this.ensureManageAccess(req, res, schoolId))) return;

      const b = (req.body ?? {}) as Record<string, unknown>;
      const baseSpecId = typeof b.baseSpecId === 'string' ? b.baseSpecId : GENERAL_GROUPED_V1.id;
      const baseVersion = typeof b.baseVersion === 'number' ? b.baseVersion : undefined;
      const baseSpec = getTemplateSpecAnyStatus(baseSpecId, baseVersion);
      if (!baseSpec) {
        res.status(404).json({ success: false, message: `Spec de base introuvable : ${baseSpecId}` });
        return;
      }

      const overridden = applySpecOverrides(baseSpec, b);
      const nextSpec = createNewTemplateSpecVersion(overridden, {
        name: typeof b.name === 'string' && b.name.trim() ? b.name.trim() : baseSpec.name,
        language: overridden.language,
        defaultGroupingScheme: overridden.defaultGroupingScheme,
        showGroupRankInSubtotal: overridden.showGroupRankInSubtotal,
        blocks: structuredClone(overridden.blocks),
        publish: b.publish !== false,
      });
      registerTemplateSpecVersion(nextSpec);

      res.status(201).json({ success: true, data: { spec: nextSpec, catalogSpecs: listAllTemplateSpecs({ includeDrafts: true }) } });
    } catch (error) { next(error); }
  };

  // POST /api/v2/master/bulletin-atelier/schools/:schoolId/assignments
  saveAssignment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.params.schoolId as string;
      if (!(await this.ensureManageAccess(req, res, schoolId))) return;

      const b = (req.body ?? {}) as Record<string, unknown>;
      const periodKind = (b.periodKind as BulletinPeriodKind) || 'TRIMESTER';
      const templateSpecId = typeof b.templateSpecId === 'string' ? b.templateSpecId : GENERAL_GROUPED_V1.id;
      const spec = getPublishedTemplateSpec(templateSpecId, typeof b.templateVersion === 'number' ? b.templateVersion : undefined);
      if (!spec) {
        res.status(400).json({ success: false, message: `La spec "${templateSpecId}" doit être publiée avant affectation.` });
        return;
      }

      const classes = await this.classeRepository.findBySchool(schoolId);
      const classLevel = assertValidClassLevel(cleanStr(b.classLevel) ?? null, classes.map((c) => c.toObject().level ?? null));
      const classId = cleanStr(b.classId) ?? null;

      const assignment = await this.assignmentRepository.save({
        schoolId,
        classLevel,
        classId,
        periodKind,
        template: (b.template as BulletinTemplate) || spec.targetTemplate || 'FR_SECONDARY',
        templateSpecId: spec.id,
        templateVersion: spec.version,
        groupingScheme: (b.groupingScheme as BulletinGroupingScheme | undefined) ?? spec.defaultGroupingScheme ?? null,
        isActive: true,
      });
      res.status(201).json({ success: true, data: { assignment } });
    } catch (error) {
      if (error instanceof Error && (error.message.includes('Niveau de classe invalide') || error.message.includes('Unique constraint'))) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };

  // DELETE /api/v2/master/bulletin-atelier/schools/:schoolId/assignments/:assignmentId
  deleteAssignment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.params.schoolId as string;
      const assignmentId = req.params.assignmentId as string;
      if (!(await this.ensureManageAccess(req, res, schoolId))) return;

      await this.assignmentRepository.delete(assignmentId, schoolId);
      res.json({ success: true });
    } catch (error) { next(error); }
  };

  // POST /api/v2/master/bulletin-atelier/schools/:schoolId/preview-pdf
  previewPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.params.schoolId as string;
      if (!(await this.ensureViewAccess(req, res, schoolId))) return;

      const [school, storedKit] = await Promise.all([
        this.schoolRepository.findById(schoolId),
        this.schoolIdentityKitRepository.findBySchoolId(schoolId),
      ]);
      if (!school) {
        res.status(404).json({ success: false, message: 'Établissement introuvable.' });
        return;
      }
      const b = (req.body ?? {}) as Record<string, unknown>;
      const specId = typeof b.templateSpecId === 'string' ? b.templateSpecId : GENERAL_GROUPED_V1.id;
      const specVer = typeof b.templateVersion === 'number' ? b.templateVersion : undefined;
      const baseSpec = getTemplateSpecAnyStatus(specId, specVer) ?? GENERAL_GROUPED_V1;
      const effectiveSpec = applySpecOverrides(
        baseSpec,
        (b.draftOverrides && typeof b.draftOverrides === 'object' ? b.draftOverrides : undefined) as Record<string, unknown> | undefined,
      );

      const kitKo = (b.kitOverrides && typeof b.kitOverrides === 'object' ? b.kitOverrides : null) as Record<string, unknown> | null;
      const mergedKit: SchoolIdentityKitRecord | null = kitKo
        ? {
            id: storedKit?.id ?? 'preview-kit',
            schoolId,
            regionalDelegationFr: cleanStr(kitKo.regionalDelegationFr) ?? storedKit?.regionalDelegationFr ?? null,
            regionalDelegationEn: cleanStr(kitKo.regionalDelegationEn) ?? storedKit?.regionalDelegationEn ?? null,
            departmentalDelegationFr: cleanStr(kitKo.departmentalDelegationFr) ?? storedKit?.departmentalDelegationFr ?? null,
            departmentalDelegationEn: cleanStr(kitKo.departmentalDelegationEn) ?? storedKit?.departmentalDelegationEn ?? null,
            mottoFr: cleanStr(kitKo.mottoFr) ?? storedKit?.mottoFr ?? null,
            mottoEn: cleanStr(kitKo.mottoEn) ?? storedKit?.mottoEn ?? null,
            poBox: cleanStr(kitKo.poBox) ?? storedKit?.poBox ?? null,
            city: cleanStr(kitKo.city) ?? storedKit?.city ?? null,
            phone: cleanStr(kitKo.phone) ?? storedKit?.phone ?? null,
            foundingYear: typeof kitKo.foundingYear === 'number' ? kitKo.foundingYear : storedKit?.foundingYear ?? null,
            authorizationNumber: cleanStr(kitKo.authorizationNumber) ?? storedKit?.authorizationNumber ?? null,
            accentColor: cleanStr(kitKo.accentColor) ?? storedKit?.accentColor ?? null,
            useCoatOfArms: typeof kitKo.useCoatOfArms === 'boolean' ? kitKo.useCoatOfArms : storedKit?.useCoatOfArms ?? false,
            logoAssetKey: storedKit?.logoAssetKey ?? null,
            coatOfArmsAssetKey: storedKit?.coatOfArmsAssetKey ?? null,
            stampAssetKey: storedKit?.stampAssetKey ?? null,
            principalSignatureAssetKey: storedKit?.principalSignatureAssetKey ?? null,
            censorSignatureAssetKey: storedKit?.censorSignatureAssetKey ?? null,
            updatedById: storedKit?.updatedById ?? null,
            createdAt: storedKit?.createdAt ?? new Date(),
            updatedAt: new Date(),
          }
        : storedKit;

      const sObj = school.toObject();
      const pdfBuffer = await renderAtelierPreviewPdf({
        schoolName: sObj.name,
        fallbackCity: sObj.city,
        fallbackPhone: sObj.phone,
        fallbackLogoUrl: sObj.logoUrl,
        kit: mergedKit,
        spec: effectiveSpec,
        renderer: this.bulletinRenderer,
        schoolAssetStorage: this.schoolAssetStorage,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="aperçu-atelier-${effectiveSpec.id}-v${effectiveSpec.version}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.end(pdfBuffer);
    } catch (error) { next(error); }
  };
}
