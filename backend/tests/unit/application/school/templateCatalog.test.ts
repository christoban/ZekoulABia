import { describe, it, expect } from 'bun:test';
import { listTemplateCatalog, findTemplateInCatalog } from '../../../../src/application/school/templateCatalog.ts';
import { getTemplateMeta } from '../../../../src/application/school/schoolTemplateConfig.ts';

describe('templateCatalog', () => {
  it('listTemplateCatalog length === nombre de clés TEMPLATE_CONFIG', () => {
    const catalog = listTemplateCatalog();
    expect(catalog.length).toBe(19);
  });

  it('chaque entrée est retrouvable via findTemplateInCatalog', () => {
    const catalog = listTemplateCatalog();
    for (const entry of catalog) {
      expect(findTemplateInCatalog(entry.code)).toBeDefined();
      expect(findTemplateInCatalog(entry.code)!.code).toBe(entry.code);
    }
  });

  it('getTemplateMeta cohérent avec catalogue (isPrimaire/isTechnique/langMode)', () => {
    const catalog = listTemplateCatalog();
    for (const entry of catalog) {
      const meta = getTemplateMeta(entry.code);
      expect(meta.isPrimaire).toBe(entry.isPrimaire);
      expect(meta.isTechnique).toBe(entry.isTechnique);
      expect(meta.langMode).toBe(entry.langMode);
    }
  });

  it('SAR_SM et CFM → PROFESSIONAL', () => {
    expect(findTemplateInCatalog('SAR_SM')!.educationType).toBe('PROFESSIONAL');
    expect(findTemplateInCatalog('CFM')!.educationType).toBe('PROFESSIONAL');
  });

  it('BILINGUAL et MIXED correctement typés', () => {
    const lyceeBilingue = findTemplateInCatalog('LYCEE_BILINGUE')!;
    const primaryBilingual = findTemplateInCatalog('PRIMARY_BILINGUAL')!;
    const complexe = findTemplateInCatalog('COMPLEXE_SCOLAIRE')!;

    expect(lyceeBilingue.subsystem).toBe('BILINGUAL');
    expect(lyceeBilingue.nameFr).toBeDefined();
    expect(lyceeBilingue.nameEn).toBeDefined();
    expect(primaryBilingual.nameFr).toBeDefined();
    expect(primaryBilingual.nameEn).toBeDefined();
    expect(complexe.nameFr).toBeDefined();
    expect(complexe.nameEn).toBeDefined();
    expect(complexe.educationType).toBe('MIXED');
    expect(complexe.level).toBe('COMPLEX');
    expect(complexe.isComplexe).toBe(true);
  });

  it('les templates mono-langue ne portent pas de double nom', () => {
    const lyceeFr = findTemplateInCatalog('LYCEE_FR')!;
    expect(lyceeFr.nameFr).toBeUndefined();
    expect(lyceeFr.nameEn).toBeUndefined();
  });

  it('PRIVE_FR/PRIVE_EN ont ownershipHint privé', () => {
    expect(findTemplateInCatalog('PRIVE_FR')!.ownershipHint).toEqual(['PRIVATE_SECULAR', 'PRIVATE_FAITH']);
    expect(findTemplateInCatalog('PRIVE_EN')!.ownershipHint).toEqual(['PRIVATE_SECULAR', 'PRIVATE_FAITH']);
  });

  it('code inconnu → undefined', () => {
    expect(findTemplateInCatalog('NOT_A_TEMPLATE')).toBeUndefined();
  });
});
