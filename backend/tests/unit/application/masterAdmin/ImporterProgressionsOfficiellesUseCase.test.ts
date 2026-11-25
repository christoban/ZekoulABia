import { describe, it, expect, beforeEach } from 'bun:test';
import {
  ImporterProgressionsOfficiellesUseCase,
  ImportProgressionsConflictError,
  ImportProgressionsValidationError,
  calculerChecksumProgression,
} from '@application/masterAdmin/progressions';
import {
  applyProgressionsImportSchema,
  proposeProgressionsImportSchema,
} from '@infrastructure/http/validation/officialProgressionImport.schema';
import { InMemoryOfficialProgressionImportRepository } from './helpers/InMemoryOfficialProgressionImportRepository';

describe('ImporterProgressionsOfficiellesUseCase & Validation Zod (Phase 2A)', () => {
  let repo: InMemoryOfficialProgressionImportRepository;
  let useCase: ImporterProgressionsOfficiellesUseCase;

  beforeEach(() => {
    repo = new InMemoryOfficialProgressionImportRepository();
    // Scope 6e FR_GENERAL aligné sur premier-cycle.ts (CycleCoefficient)
    repo.seedSubjects(
      { templateCode: 'LYCEE_FR', level: '6e', filiere: 'FR_GENERAL' },
      [
        'Mathématiques',
        'Français',
        'Anglais',
        'Histoire',
        'Géographie',
        'Sciences',
        'Éducation à la Citoyenneté et à la Morale',
        'Lettres classiques (Latin/Grec)',
        'Travail Manuel',
      ],
    );
    // Scope 6e FR_PEBS aligné sur premier-cycle.ts (Travail Manuel remplacé par Manual Labour)
    repo.seedSubjects(
      { templateCode: 'LYCEE_FR', level: '6e', filiere: 'FR_PEBS' },
      [
        'Mathématiques',
        'Français',
        'Intensive English',
        'Lettres classiques (Latin/Grec)',
        'Manual Labour',
      ],
    );
    // Scope 6e sans filière
    repo.seedSubjects(
      { templateCode: '__ALL__', level: '6e', filiere: '' },
      ['Mathématiques', 'Français', 'Anglais'],
    );
    useCase = new ImporterProgressionsOfficiellesUseCase(repo);
  });

  it('valide le schéma Zod complet (6e MINESEC) et reste rétrocompatible avec les chapitres plats existants', async () => {
    const rawPayload = {
      source: 'minesec-distance-learning',
      level: '6e',
      items: [
        {
          templateCode: '__ALL__',
          level: '6e',
          filiere: 'FR_GENERAL',
          subjectName: 'Mathématiques',
          subjectNameSource: 'Maths 6ème',
          titre: 'Programme Officiel Mathématiques 6e',
          chapitres: [
            {
              titre: 'Les nombres entiers naturels',
              moduleOrdre: 1,
              moduleTitre: 'Module 1 : Nombres et calculs',
              leconNumero: 1,
              numeroAffiche: 'Leçon 1',
              positionDansModule: 1,
              positionSource: 1,
              sourceUrl: 'https://minesec-distancelearning.cm/cours/6e/maths/l1',
            },
            {
              titre: 'Travaux dirigés : exercices de synthèse',
              moduleOrdre: 1,
              moduleTitre: 'Module 1 : Nombres et calculs',
              leconNumero: null,
              numeroAffiche: 'TD',
              positionDansModule: 2,
              positionSource: 2,
              sourceUrl: null,
            },
            {
              titre: 'Note de bas de page parasite',
              moduleOrdre: 1,
              moduleTitre: 'Module 1 : Nombres et calculs',
              titreModuleParasite: true,
              leconNumero: null,
              numeroAffiche: 'N.B.',
              positionDansModule: 3,
              positionSource: 3,
              exclure: true,
            },
          ],
        },
      ],
    };

    const parsed = proposeProgressionsImportSchema.safeParse(rawPayload);
    expect(parsed.success).toBe(true);

    // Point 6(d) : chapitres plats existants (sans module ni leconNumero ni positionDansModule)
    const legacyFlatPayload = {
      source: 'manuel',
      level: '6e',
      items: [
        {
          templateCode: '__ALL__',
          level: '6e',
          filiere: null,
          subjectName: 'Français',
          titre: 'Programme Français 6e (format plat)',
          chapitres: [
            { ordre: 1, titre: 'Chapitre 1 : Grammaire', volumeHeuresPrevu: 6, sequenceCibleFin: 1 },
            { ordre: 2, titre: 'Chapitre 2 : Conjugaison', volumeHeuresPrevu: 4, sequenceCibleFin: 2 },
          ],
        },
      ],
    };
    const parsedLegacy = applyProgressionsImportSchema.safeParse(legacyFlatPayload);
    expect(parsedLegacy.success).toBe(true);
    if (parsedLegacy.success) {
      expect(parsedLegacy.data.items[0]!.filiere).toBe('');
      const dry = await useCase.proposer({
        source: 'manuel',
        level: '6e',
        items: [
          {
            templateCode: '__ALL__',
            level: '6e',
            filiere: '',
            subjectName: 'Français',
            titre: 'Programme Français 6e (format plat)',
            chapitres: [
              { ordre: 1, titre: 'Chapitre 1 : Grammaire', volumeHeuresPrevu: 6, sequenceCibleFin: 1 },
              { ordre: 2, titre: 'Chapitre 2 : Conjugaison', volumeHeuresPrevu: 4, sequenceCibleFin: 2 },
            ],
          },
        ],
      });
      expect(dry.rejets).toEqual([]);
      expect(dry.actions[0]!.chapitres).toHaveLength(2);
      expect(dry.actions[0]!.chapitres[0]!.volumeHeuresPrevu).toBe(6);
      expect(dry.actions[0]!.chapitres[0]!.sequenceCibleFin).toBe(1);
      expect(dry.actions[0]!.chapitres[0]!.moduleOrdre).toBeUndefined();

      const applied = await useCase.appliquer({
        source: 'manuel',
        level: '6e',
        items: [
          {
            templateCode: '__ALL__',
            level: '6e',
            filiere: '',
            subjectName: 'Français',
            titre: 'Programme Français 6e (format plat)',
            chapitres: [
              { ordre: 1, titre: 'Chapitre 1 : Grammaire', volumeHeuresPrevu: 6, sequenceCibleFin: 1 },
              { ordre: 2, titre: 'Chapitre 2 : Conjugaison', volumeHeuresPrevu: 4, sequenceCibleFin: 2 },
            ],
          },
        ],
      });
      expect(applied.createdCount).toBe(1);
    }
  });

  it('calcule ordre global par ordre d\'apparition (moduleOrdre puis positionDansModule), JAMAIS par leconNumero, et supporte moduleOrdre = 0', async () => {
    const res = await useCase.proposer({
      source: 'minesec-distance-learning',
      level: '6e',
      items: [
        {
          templateCode: '__ALL__',
          level: '6e',
          filiere: 'FR_GENERAL',
          subjectName: 'Français',
          titre: 'Programme Français 6e',
          chapitres: [
            {
              titre: 'Leçon n°1 du module 2',
              moduleOrdre: 2,
              moduleTitre: 'Module 2',
              positionDansModule: 1,
              positionSource: 5,
              leconNumero: 1,
              numeroAffiche: 'Leçon 1',
            },
            {
              titre: 'Introduction générale (module 0)',
              moduleOrdre: 0,
              moduleTitre: 'Module 0 : Préambule',
              positionDansModule: 1,
              positionSource: 1,
              leconNumero: null,
              numeroAffiche: 'Intro',
            },
            {
              titre: 'Leçon numérotée 10 en 1ère position du module 1',
              moduleOrdre: 1,
              moduleTitre: 'Module 1',
              positionDansModule: 1,
              positionSource: 2,
              leconNumero: 10,
              numeroAffiche: 'Leçon 10',
            },
            {
              titre: 'Leçon numérotée 2 en 2ème position du module 1',
              moduleOrdre: 1,
              moduleTitre: 'Module 1',
              positionDansModule: 2,
              positionSource: 3,
              leconNumero: 2,
              numeroAffiche: 'Leçon 2',
            },
          ],
        },
      ],
    });

    expect(res.rejets).toEqual([]);
    const chaps = res.actions[0]!.chapitres;
    expect(chaps.map((c) => c.ordre)).toEqual([1, 2, 3, 4]);
    expect(chaps[0]!.moduleOrdre).toBe(0);
    expect(chaps[1]!.leconNumero).toBe(10);
    expect(chaps[2]!.leconNumero).toBe(2);
    expect(chaps[3]!.moduleOrdre).toBe(2);
  });

  it('liste séparément dans le dry-run les 4 diagnostics SANS rien rejeter', async () => {
    const res = await useCase.proposer({
      source: 'minesec-distance-learning',
      level: '6e',
      items: [
        {
          templateCode: '__ALL__',
          level: '6e',
          filiere: 'FR_GENERAL',
          subjectName: 'Mathématiques',
          titre: 'Programme Mathématiques 6e',
          chapitres: [
            {
              titre: 'Activité A',
              moduleOrdre: 1,
              moduleTitre: 'MODULE 1 (texte parasite)',
              titreModuleParasite: true,
              positionDansModule: 1,
              positionSource: 1,
              leconNumero: 1,
              numeroAffiche: 'Leçon 1',
            },
            {
              titre: 'Activité B (même numéro dans même module)',
              moduleOrdre: 1,
              moduleTitre: 'MODULE 1 (texte parasite)',
              titreModuleParasite: true,
              positionDansModule: 2,
              positionSource: 2,
              leconNumero: 1,
              numeroAffiche: 'Leçon 1 bis',
            },
            {
              titre: 'Travaux Dirigés 1',
              moduleOrdre: 1,
              moduleTitre: 'MODULE 1 (texte parasite)',
              titreModuleParasite: true,
              positionDansModule: 3,
              positionSource: 3,
              leconNumero: null,
              numeroAffiche: 'TD 1',
            },
            {
              titre: 'N.B. : consignes administratives',
              moduleOrdre: 1,
              moduleTitre: 'MODULE 1 (texte parasite)',
              positionDansModule: 4,
              positionSource: 4,
              leconNumero: null,
              numeroAffiche: 'N.B.',
              exclure: true,
            },
            {
              titre: 'Fractions partie 1',
              moduleOrdre: 1,
              moduleTitre: 'MODULE 1 (texte parasite)',
              positionDansModule: 5,
              positionSource: 5,
              leconNumero: 2,
              numeroAffiche: 'Leçon 2',
            },
            {
              titre: 'Géométrie leçon 2 (doublon inter-modules)',
              moduleOrdre: 2,
              moduleTitre: 'Module 2 : Géométrie',
              positionDansModule: 1,
              positionSource: 6,
              leconNumero: 2,
              numeroAffiche: 'Leçon 2',
            },
          ],
        },
      ],
    });

    expect(res.rejets).toEqual([]);
    expect(res.peutAppliquer).toBe(true);
    expect(res.diagnostics.leconsSansNumero).toHaveLength(1);
    expect(res.diagnostics.numerosDupliques).toHaveLength(2);
    expect(res.diagnostics.numerosDupliques.find((d) => d.leconNumero === '1')?.portee).toBe('MEME_MODULE');
    expect(res.diagnostics.numerosDupliques.find((d) => d.leconNumero === '2')?.portee).toBe('INTER_MODULES');
    expect(res.diagnostics.modulesParasites).toHaveLength(1);
    expect(res.diagnostics.elementsExclus).toHaveLength(1);
    expect(res.actions[0]!.chapitres).toHaveLength(5);
    expect(repo.rows.size).toBe(0);
  });

  it('Point 2 : normalise casse/accents/espaces, rejette strictement en SUBJECT_NOT_FOUND et retourne matieresConnues pour ce scope', async () => {
    const res = await useCase.proposer({
      source: 'autre-source-ignoree',
      level: '6e',
      items: [
        // Présent dans BacCoefficient (2nde-Tle A1/A2) mais absent en 6e FR_GENERAL
        {
          templateCode: '__ALL__',
          level: '6e',
          filiere: 'FR_GENERAL',
          subjectName: 'Latin',
          subjectNameSource: 'Latin 6e',
          titre: 'Programme Latin 6e',
          chapitres: [{ titre: 'Déclinaisons', moduleOrdre: 1, positionDansModule: 1 }],
        },
        // Présent dans SchoolTemplate.config.defaultSubjects mais absent de CycleCoefficient 6e
        {
          templateCode: '__ALL__',
          level: '6e',
          filiere: 'FR_GENERAL',
          subjectName: 'Histoire-Géographie',
          subjectNameSource: 'Hist-Géo 6e',
          titre: 'Programme Histoire-Géographie 6e',
          chapitres: [{ titre: 'La préhistoire', moduleOrdre: 1, positionDansModule: 1 }],
        },
        // Présent en 6e FR_GENERAL mais absent en 6e FR_PEBS
        {
          templateCode: '__ALL__',
          level: '6e',
          filiere: 'FR_PEBS',
          subjectName: 'Travail Manuel',
          subjectNameSource: 'Travail Manuel 6e PEBS',
          titre: 'Programme Travail Manuel 6e PEBS',
          chapitres: [{ titre: 'Atelier 1', moduleOrdre: 1, positionDansModule: 1 }],
        },
        // Correspondance valide par normalisation casse + accents + espaces multiples
        {
          templateCode: '__ALL__',
          level: '6e',
          filiere: 'FR_GENERAL',
          subjectName: '  education   a la citoyennete  et a la morale ',
          subjectNameSource: 'ECM 6e',
          titre: 'Programme ECM 6e',
          chapitres: [{ titre: 'La citoyenneté', moduleOrdre: 1, positionDansModule: 1 }],
        },
        // Correspondance valide sans accents ni majuscule
        {
          templateCode: '__ALL__',
          level: '6e',
          filiere: 'FR_GENERAL',
          subjectName: 'mathematiques',
          subjectNameSource: 'Maths 6e',
          titre: 'Programme Mathématiques 6e',
          chapitres: [{ titre: 'Les nombres entiers', moduleOrdre: 1, positionDansModule: 1 }],
        },
      ],
    });

    expect(res.peutAppliquer).toBe(false);
    // Point 3 : source toujours fixée à 'minesec-distance-learning'
    expect(res.source).toBe('minesec-distance-learning');
    expect(res.resume.valides).toBe(2);
    expect(res.resume.rejetes).toBe(3);

    // Résolution vers les noms canoniques officiels
    expect(res.actions.map((a) => a.subjectName)).toEqual([
      'Éducation à la Citoyenneté et à la Morale',
      'Mathématiques',
    ]);
    expect(res.actions.every((a) => a.source === 'minesec-distance-learning')).toBe(true);

    // Rejets stricts accompagnés de matieresConnues pour construire la table de correspondance
    expect(res.rejets.map((r) => ({ subject: r.subjectName, code: r.code }))).toEqual([
      { subject: 'Latin', code: 'SUBJECT_NOT_FOUND' },
      { subject: 'Histoire-Géographie', code: 'SUBJECT_NOT_FOUND' },
      { subject: 'Travail Manuel', code: 'SUBJECT_NOT_FOUND' },
    ]);
    expect(res.rejets[0]!.matieresConnues).toContain('Lettres classiques (Latin/Grec)');
    expect(res.rejets[0]!.matieresConnues).toContain('Mathématiques');
    expect(res.rejets[2]!.matieresConnues).toContain('Manual Labour');
    expect(res.rejets[2]!.matieresConnues).not.toContain('Travail Manuel');
  });

  it('Point 3 : écrit toujours source = minesec-distance-learning lors de l\'import', async () => {
    const res = await useCase.appliquer({
      source: 'source-arbitraire-client',
      level: '6e',
      items: [
        {
          templateCode: '__ALL__',
          level: '6e',
          filiere: 'FR_GENERAL',
          subjectName: 'geographie',
          source: 'manuel',
          titre: 'Programme Géographie 6e',
          chapitres: [{ titre: 'La Terre', moduleOrdre: 1, positionDansModule: 1 }],
        },
      ],
    });

    expect(res.source).toBe('minesec-distance-learning');
    const saved = repo.rows.get('__ALL__::6e::FR_GENERAL::Géographie');
    expect(saved?.source).toBe('minesec-distance-learning');
    expect(saved?.manuallyEdited).toBe(false);
  });

  it('Point 6(b) : rejette deux items identiques dans un même lot (DUPLICATE_PROGRESSION_IN_BATCH) et refuse apply', async () => {
    const duplicateBatch = {
      source: 'minesec-distance-learning',
      level: '6e',
      items: [
        {
          templateCode: '__ALL__',
          level: '6e',
          filiere: 'FR_GENERAL',
          subjectName: 'Mathématiques',
          titre: 'Programme Maths 6e (1)',
          chapitres: [{ titre: 'Leçon A', moduleOrdre: 1, positionDansModule: 1 }],
        },
        {
          templateCode: '__ALL__',
          level: '6e',
          filiere: 'FR_GENERAL',
          subjectName: 'Mathématiques',
          titre: 'Programme Maths 6e (2)',
          chapitres: [{ titre: 'Leçon A', moduleOrdre: 1, positionDansModule: 1 }],
        },
      ],
    };

    const prop = await useCase.proposer(duplicateBatch);
    expect(prop.peutAppliquer).toBe(false);
    expect(prop.resume.valides).toBe(1);
    expect(prop.resume.rejetes).toBe(1);
    expect(prop.rejets[0]!.code).toBe('DUPLICATE_PROGRESSION_IN_BATCH');

    await expect(useCase.appliquer(duplicateBatch)).rejects.toBeInstanceOf(
      ImportProgressionsValidationError,
    );
    expect(repo.applyCallCount).toBe(0);
  });

  it('Point 3 : calcule importChecksum par ligne (titre+active+chapitres) et détecte une édition manuelle même si importChecksum était resté identique', async () => {
    const chapitres = [{ ordre: 1, titre: 'Leçon 1', moduleOrdre: 1, positionDansModule: 1, positionSource: 1 }];
    const checksumLigne = calculerChecksumProgression({
      titre: 'Programme Sciences 6e',
      active: true,
      chapitres,
    });

    // Cas critique : la ligne porte ENCORE l'ancien importChecksum MAIS manuallyEdited = true
    repo.seedRow({
      id: 'prog_edited_same_hash',
      templateCode: '__ALL__',
      level: '6e',
      filiere: 'FR_GENERAL',
      subjectName: 'Sciences',
      titre: 'Programme Sciences 6e',
      chapitres,
      source: 'minesec-distance-learning',
      manuallyEdited: true,
      importChecksum: checksumLigne,
      active: true,
    });

    const batch = {
      source: 'minesec-distance-learning',
      level: '6e',
      items: [
        {
          templateCode: '__ALL__',
          level: '6e',
          filiere: 'FR_GENERAL',
          subjectName: 'Sciences',
          titre: 'Programme Sciences 6e',
          chapitres: [{ titre: 'Leçon 1', moduleOrdre: 1, positionDansModule: 1, positionSource: 1 }],
        },
      ],
    };

    // Ne doit JAMAIS être masqué en UNCHANGED !
    const prop = await useCase.proposer(batch);
    expect(prop.actions[0]!.action).toBe('CONFLICT_MANUAL');
    expect(prop.resume.inchanges).toBe(0);
    expect(prop.resume.conflitsManuels).toBe(1);

    try {
      await useCase.appliquer(batch);
      expect.unreachable('Aurait dû lever MANUAL_EDIT_CONFLICT');
    } catch (err) {
      expect(err).toBeInstanceOf(ImportProgressionsConflictError);
      expect((err as ImportProgressionsConflictError).code).toBe('MANUAL_EDIT_CONFLICT');
    }
  });

  it('Point 6(c) : couvre explicitement les 3 comportements sur conflit manuallyEdited (ni l\'un ni l\'autre → 409, skipManuallyEdited, confirmOverwriteManualIds)', async () => {
    const manualRow = repo.seedRow({
      id: 'prog_manual_1',
      templateCode: '__ALL__',
      level: '6e',
      filiere: 'FR_GENERAL',
      subjectName: 'Mathématiques',
      titre: 'Ancien programme édité à la main',
      chapitres: [{ ordre: 1, titre: 'Chapitre manuel', volumeHeuresPrevu: 4 }],
      source: 'manuel',
      manuallyEdited: true,
      importChecksum: null,
      active: true,
    });

    const batch = {
      source: 'minesec-distance-learning',
      level: '6e',
      items: [
        {
          templateCode: '__ALL__',
          level: '6e',
          filiere: 'FR_GENERAL',
          subjectName: 'Mathématiques',
          titre: 'Programme Officiel Maths 6e (import)',
          chapitres: [{ titre: 'Nombres entiers', moduleOrdre: 1, positionDansModule: 1, leconNumero: 1 }],
        },
        {
          templateCode: '__ALL__',
          level: '6e',
          filiere: 'FR_GENERAL',
          subjectName: 'Histoire',
          titre: 'Programme Officiel Histoire 6e',
          chapitres: [{ titre: 'La préhistoire', moduleOrdre: 1, positionDansModule: 1, leconNumero: 1 }],
        },
      ],
    };

    // Comportement 1 : ni skipManuallyEdited ni confirmOverwriteManualIds → 409 MANUAL_EDIT_CONFLICT, 0 écriture
    try {
      await useCase.appliquer(batch);
      expect.unreachable('Aurait dû lever MANUAL_EDIT_CONFLICT');
    } catch (err) {
      expect(err).toBeInstanceOf(ImportProgressionsConflictError);
      expect((err as ImportProgressionsConflictError).code).toBe('MANUAL_EDIT_CONFLICT');
    }
    expect(repo.applyCallCount).toBe(0);
    expect(repo.rows.size).toBe(1);

    // Comportement 2 : skipManuallyEdited = true → crée Histoire, laisse Maths manuelle intacte
    const resSkip = await useCase.appliquer({ ...batch, skipManuallyEdited: true });
    expect(resSkip.createdCount).toBe(1);
    expect(resSkip.skippedManualCount).toBe(1);
    expect(resSkip.overwrittenManualCount).toBe(0);
    expect(repo.rows.get('__ALL__::6e::FR_GENERAL::Mathématiques')?.manuallyEdited).toBe(true);
    expect(repo.rows.get('__ALL__::6e::FR_GENERAL::Histoire')?.manuallyEdited).toBe(false);

    // Comportement 3 : confirmOverwriteManualIds = [manualRow.id] → écrase Maths, Histoire inchangée
    const resConfirm = await useCase.appliquer({
      ...batch,
      confirmOverwriteManualIds: [manualRow.id],
    });
    expect(resConfirm.overwrittenManualCount).toBe(1);
    expect(resConfirm.unchangedCount).toBe(1);
    const updatedMaths = repo.rows.get('__ALL__::6e::FR_GENERAL::Mathématiques');
    expect(updatedMaths?.manuallyEdited).toBe(false);
    expect(updatedMaths?.source).toBe('minesec-distance-learning');
    expect(updatedMaths?.importChecksum).toBeTruthy();
  });

  it('Point 1 : idempotence — réimporter un lot identique répond 200 avec createdCount=0, updatedCount=0, unchangedCount=N (sans 409 ni transaction)', async () => {
    const batch = {
      source: 'minesec-distance-learning',
      level: '6e',
      items: [
        {
          templateCode: '__ALL__',
          level: '6e',
          filiere: 'FR_GENERAL',
          subjectName: 'Sciences',
          titre: 'Programme Sciences 6e',
          chapitres: [
            { titre: 'Le vivant', moduleOrdre: 1, positionDansModule: 1, positionSource: 1, leconNumero: 1 },
          ],
        },
        {
          templateCode: '__ALL__',
          level: '6e',
          filiere: 'FR_GENERAL',
          subjectName: 'Histoire',
          titre: 'Programme Histoire 6e',
          chapitres: [
            { titre: 'La préhistoire', moduleOrdre: 1, positionDansModule: 1, positionSource: 1, leconNumero: 1 },
          ],
        },
      ],
    };

    const first = await useCase.appliquer(batch);
    expect(first.createdCount).toBe(2);
    expect(first.totalAffected).toBe(2);

    // 2ème exécution identique → 200 idempotent (0 création, 0 MAJ, 2 inchangés, 0 transaction)
    const callsBefore = repo.applyCallCount;
    const second = await useCase.appliquer(batch);
    expect(second.applied).toBe(true);
    expect(second.createdCount).toBe(0);
    expect(second.updatedCount).toBe(0);
    expect(second.overwrittenManualCount).toBe(0);
    expect(second.unchangedCount).toBe(2);
    expect(second.totalAffected).toBe(0);
    expect(second.items).toEqual([]);
    expect(repo.applyCallCount).toBe(callsBefore);
  });

  it('annule tout le lot si la transaction échoue en cours d\'écriture (atomicité)', async () => {
    const ancienChapitres = [{ ordre: 1, titre: 'Ancienne leçon', moduleOrdre: 1, positionDansModule: 1, positionSource: 1 }];
    const ancienChecksum = calculerChecksumProgression({
      titre: 'Programme Anglais 6e',
      active: true,
      chapitres: ancienChapitres,
    });

    repo.seedRow({
      id: 'prog_auto_1',
      templateCode: '__ALL__',
      level: '6e',
      filiere: 'FR_GENERAL',
      subjectName: 'Anglais',
      titre: 'Programme Anglais 6e',
      chapitres: ancienChapitres,
      source: 'minesec-distance-learning',
      manuallyEdited: false,
      importChecksum: ancienChecksum,
      active: true,
    });

    const batch = {
      source: 'minesec-distance-learning',
      level: '6e',
      items: [
        {
          templateCode: '__ALL__',
          level: '6e',
          filiere: 'FR_GENERAL',
          subjectName: 'Anglais',
          titre: 'Programme Anglais 6e (v2)',
          chapitres: [{ titre: 'Nouvelle leçon', moduleOrdre: 1, positionDansModule: 1, leconNumero: 1 }],
        },
        {
          templateCode: '__ALL__',
          level: '6e',
          filiere: 'FR_GENERAL',
          subjectName: 'Histoire',
          titre: 'Programme Histoire 6e',
          chapitres: [{ titre: 'Histoire 1', moduleOrdre: 1, positionDansModule: 1, leconNumero: 1 }],
        },
      ],
    };

    repo.failOnMutationIndex = 1;
    await expect(useCase.appliquer(batch)).rejects.toThrow('Erreur simulée en milieu de transaction');
    expect(repo.rows.size).toBe(1);
    expect(repo.rows.get('__ALL__::6e::FR_GENERAL::Anglais')?.titre).toBe('Programme Anglais 6e');

    repo.failOnMutationIndex = null;
    const ok = await useCase.appliquer(batch);
    expect(ok.updatedCount).toBe(1);
    expect(ok.createdCount).toBe(1);
    expect(repo.rows.size).toBe(2);
  });
});
