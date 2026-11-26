import { describe, expect, it } from 'bun:test';
import {
  calculerFilieresCandidates,
  normaliserNiveauPourResolution,
  resoudreProgressionOfficielle,
  type ClasseContexteResolution,
  type OfficialProgressionCandidate,
} from '@domain/rules/officialProgressionResolution';

function makeCandidate(
  overrides: Partial<OfficialProgressionCandidate> & Pick<OfficialProgressionCandidate, 'level' | 'filiere' | 'subjectName'>,
): OfficialProgressionCandidate {
  return {
    id: `prog_${overrides.level}_${overrides.filiere}_${overrides.subjectName}`.replace(/\s+/g, '_'),
    templateCode: overrides.templateCode ?? '__ALL__',
    level: overrides.level,
    filiere: overrides.filiere,
    subjectName: overrides.subjectName,
    titre: overrides.titre ?? `Programme ${overrides.subjectName} ${overrides.level}`,
    importChecksum: overrides.importChecksum ?? 'sha256:test',
    nbLecons: overrides.nbLecons ?? 25,
  };
}

const CATALOGUE: OfficialProgressionCandidate[] = [
  makeCandidate({ level: '6e', filiere: 'FR_GENERAL', subjectName: 'Mathématiques' }),
  makeCandidate({ level: '6e', filiere: 'FR_GENERAL', subjectName: 'Sciences' }),
  makeCandidate({ level: '6e', filiere: 'FR_GENERAL', subjectName: 'Latin' }),
  makeCandidate({ level: '6e', filiere: 'FR_GENERAL', subjectName: 'Travail Manuel' }),
  makeCandidate({ level: '6e', filiere: 'FR_PEBS', subjectName: 'Intensive English' }),
  makeCandidate({ level: '6e', filiere: 'FR_PEBS', subjectName: 'Citizenship Education' }),
  makeCandidate({ templateCode: 'LYCEE_CUSTOM', level: '6e', filiere: 'FR_GENERAL', subjectName: 'Mathématiques', titre: 'Programme Maths Spécifique' }),
  makeCandidate({ level: '4e', filiere: 'FR_GENERAL', subjectName: 'Latin' }),
  makeCandidate({ level: '4e', filiere: 'FR_GENERAL', subjectName: 'Grec' }),
  makeCandidate({ level: '4e', filiere: 'FR_GENERAL', subjectName: 'Allemand' }),
  makeCandidate({ level: '4e', filiere: 'FR_GENERAL', subjectName: 'Espagnol' }),
  makeCandidate({ level: '4e', filiere: 'FR_GENERAL', subjectName: 'SVTEEHB' }),
  makeCandidate({ level: '2nde', filiere: 'A4', subjectName: 'Français' }),
  makeCandidate({ level: '2nde', filiere: 'C', subjectName: 'Physique' }),
  makeCandidate({ level: 'Form1', filiere: 'EN_GENERAL', subjectName: 'Mathematics' }),
  makeCandidate({ level: 'Form1', filiere: 'EN_PEBS', subjectName: 'Intensive French' }),
];

describe('officialProgressionResolution — règles métier pures', () => {
  it('normalise les niveaux francophones et anglophones', () => {
    expect(normaliserNiveauPourResolution('6ème')).toBe('6e');
    expect(normaliserNiveauPourResolution('4ème')).toBe('4e');
    expect(normaliserNiveauPourResolution('1ère')).toBe('1ere');
    expect(normaliserNiveauPourResolution('Form 1')).toBe('Form1');
    expect(normaliserNiveauPourResolution('Lower Sixth')).toBe('LowerSixth');
  });

  it('privilégie le template spécifique de l école puis retombe sur __ALL__', () => {
    const ctxCustom: ClasseContexteResolution = {
      schoolTemplateCode: 'LYCEE_CUSTOM',
      level: '6e',
      filiere: 'FR_GENERAL',
      serie: null,
      pebsMixte: false,
    };
    const resMaths = resoudreProgressionOfficielle(ctxCustom, 'Mathématiques', CATALOGUE);
    expect(resMaths.statut).toBe('RESOLU');
    if (resMaths.statut === 'RESOLU') {
      expect(resMaths.progression.templateCode).toBe('LYCEE_CUSTOM');
    }

    const resSciences = resoudreProgressionOfficielle(ctxCustom, 'Sciences', CATALOGUE);
    expect(resSciences.statut).toBe('RESOLU');
    if (resSciences.statut === 'RESOLU') {
      expect(resSciences.progression.templateCode).toBe('__ALL__');
    }
  });

  it('résout Lettres classiques (Latin/Grec) automatiquement en Latin en 6e/5e', () => {
    const ctx6e: ClasseContexteResolution = {
      schoolTemplateCode: 'LYCEE_GENERAL_FR',
      level: '6ème',
      filiere: 'FR_GENERAL',
      serie: null,
      pebsMixte: false,
    };
    const res = resoudreProgressionOfficielle(ctx6e, 'Lettres classiques (Latin/Grec)', CATALOGUE);
    expect(res.statut).toBe('RESOLU');
    if (res.statut === 'RESOLU') {
      expect(res.subjectNameResolu).toBe('Latin');
    }
  });

  it('demande un choix explicite Latin/Grec en 4e/3e puis résout selon l option choisie', () => {
    const ctx4e: ClasseContexteResolution = {
      schoolTemplateCode: 'LYCEE_GENERAL_FR',
      level: '4e',
      filiere: 'FR_GENERAL',
      serie: null,
      pebsMixte: false,
    };
    const sansOption = resoudreProgressionOfficielle(ctx4e, 'Lettres classiques (Latin/Grec)', CATALOGUE);
    expect(sansOption.statut).toBe('CHOIX_REQUIS');
    if (sansOption.statut === 'CHOIX_REQUIS') {
      expect(sansOption.options).toEqual(['Latin', 'Grec']);
    }

    const avecGrec = resoudreProgressionOfficielle(ctx4e, 'Lettres classiques (Latin/Grec)', CATALOGUE, 'Grec');
    expect(avecGrec.statut).toBe('RESOLU');
    if (avecGrec.statut === 'RESOLU') {
      expect(avecGrec.subjectNameResolu).toBe('Grec');
    }
  });

  it('résout les LV2 concrètes et refuse le poste abstrait générique LV2', () => {
    const ctx4e: ClasseContexteResolution = {
      schoolTemplateCode: 'LYCEE_GENERAL_FR',
      level: '4e',
      filiere: 'FR_GENERAL',
      serie: null,
      pebsMixte: false,
    };
    const allemand = resoudreProgressionOfficielle(ctx4e, 'Allemand', CATALOGUE);
    expect(allemand.statut).toBe('RESOLU');

    const lv2Generique = resoudreProgressionOfficielle(ctx4e, 'LV2', CATALOGUE);
    expect(lv2Generique.statut).toBe('IMPOSSIBLE');
    if (lv2Generique.statut === 'IMPOSSIBLE') {
      expect(lv2Generique.raison).toContain('Allemand');
    }
  });

  it('gère Intensive English en FR_PEBS ainsi que le repli pebsMixte sur FR_GENERAL', () => {
    const ctxPebsMixte: ClasseContexteResolution = {
      schoolTemplateCode: 'LYCEE_BILINGUE',
      level: '6e',
      filiere: 'FR_GENERAL',
      serie: null,
      pebsMixte: true,
    };
    expect(calculerFilieresCandidates(ctxPebsMixte)).toContain('FR_PEBS');

    const res = resoudreProgressionOfficielle(ctxPebsMixte, 'Intensive English', CATALOGUE);
    expect(res.statut).toBe('RESOLU');
    if (res.statut === 'RESOLU') {
      expect(res.filiereResolue).toBe('FR_PEBS');
      expect(res.subjectNameResolu).toBe('Intensive English');
    }
  });

  it('résout les séries du second cycle (ex. A4-Allemand → A4, C → C)', () => {
    const ctxA4: ClasseContexteResolution = {
      schoolTemplateCode: 'LYCEE_GENERAL_FR',
      level: '2nde',
      filiere: null,
      serie: 'A4-Allemand',
      pebsMixte: false,
    };
    const resA4 = resoudreProgressionOfficielle(ctxA4, 'Français', CATALOGUE);
    expect(resA4.statut).toBe('RESOLU');
    if (resA4.statut === 'RESOLU') {
      expect(resA4.filiereResolue).toBe('A4');
    }

    const ctxC: ClasseContexteResolution = {
      schoolTemplateCode: 'LYCEE_GENERAL_FR',
      level: '2nde',
      filiere: null,
      serie: 'C',
      pebsMixte: false,
    };
    const resC = resoudreProgressionOfficielle(ctxC, 'Physique', CATALOGUE);
    expect(resC.statut).toBe('RESOLU');
  });

  it('résout le sous-système anglophone (Form1 EN_GENERAL et EN_PEBS)', () => {
    const ctxEn: ClasseContexteResolution = {
      schoolTemplateCode: 'LYCEE_BILINGUE',
      level: 'Form 1',
      filiere: 'EN_GENERAL',
      serie: null,
      pebsMixte: false,
    };
    const res = resoudreProgressionOfficielle(ctxEn, 'Mathematics', CATALOGUE);
    expect(res.statut).toBe('RESOLU');
  });

  it('retourne IMPOSSIBLE proprement pour une matière sans progression nationale', () => {
    const ctx6e: ClasseContexteResolution = {
      schoolTemplateCode: 'LYCEE_GENERAL_FR',
      level: '6e',
      filiere: 'FR_GENERAL',
      serie: null,
      pebsMixte: false,
    };
    const res = resoudreProgressionOfficielle(ctx6e, 'Orientation Conseil', CATALOGUE);
    expect(res.statut).toBe('IMPOSSIBLE');
  });
});
