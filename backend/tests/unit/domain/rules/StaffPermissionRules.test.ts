import { describe, expect, test } from 'bun:test';
import {
  getPermissionsPourTitre,
  getStaffTitlesForTemplate,
  titreReconnu,
} from '../../../../src/domain/rules/StaffPermissionRules.ts';
import type { StaffPermissionType, TemplateMeta } from '../../../../src/domain/types/enums.ts';

const secretaryPermissions: StaffPermissionType[] = ['MANAGE_ENROLLMENT', 'GENERATE_REPORTS'];

const templates: Array<{ name: string; meta: TemplateMeta; expectedTitles: string[] }> = [
  {
    name: 'francophone secondaire',
    meta: { isAnglophone: false, isPrimaire: false, isTechnique: false, langMode: 'francophone' },
    expectedTitles: ['Secrétaire'],
  },
  {
    name: 'francophone technique',
    meta: { isAnglophone: false, isPrimaire: false, isTechnique: true, langMode: 'francophone' },
    expectedTitles: ['Secrétaire'],
  },
  {
    name: 'francophone primaire',
    meta: { isAnglophone: false, isPrimaire: true, isTechnique: false, langMode: 'francophone' },
    expectedTitles: ['Secrétaire'],
  },
  {
    name: 'anglophone secondaire',
    meta: { isAnglophone: true, isPrimaire: false, isTechnique: false, langMode: 'anglophone' },
    expectedTitles: ['School Secretary'],
  },
  {
    name: 'anglophone primaire',
    meta: { isAnglophone: true, isPrimaire: true, isTechnique: false, langMode: 'anglophone' },
    expectedTitles: ['School Secretary'],
  },
  {
    name: 'bilingue secondaire',
    meta: { isAnglophone: false, isPrimaire: false, isTechnique: false, langMode: 'bilingual' },
    expectedTitles: ['Secrétaire', 'School Secretary'],
  },
  {
    name: 'bilingue primaire',
    meta: { isAnglophone: false, isPrimaire: true, isTechnique: false, langMode: 'bilingual' },
    expectedTitles: ['Secrétaire', 'School Secretary'],
  },
];

describe('StaffPermissionRules - secrétaire', () => {
  test('reconnaît les deux variantes et leur attribue les permissions prévues', () => {
    for (const title of ['Secrétaire', 'School Secretary']) {
      expect(titreReconnu(title)).toBe(true);
      expect(getPermissionsPourTitre(title)).toEqual(secretaryPermissions);
    }
  });

  for (const template of templates) {
    test(`expose le titre pour ${template.name}`, () => {
      const titles = getStaffTitlesForTemplate(template.meta).map((title) => title.key);

      for (const expectedTitle of template.expectedTitles) {
        expect(titles).toContain(expectedTitle);
      }
    });
  }

  test('expose le titre francophone dans un complexe scolaire', () => {
    const titles = getStaffTitlesForTemplate(
      { isAnglophone: false, isPrimaire: false, isTechnique: false, langMode: 'francophone' },
      'COMPLEXE_SCOLAIRE'
    ).map((title) => title.key);

    expect(titles).toContain('Secrétaire');
  });
});