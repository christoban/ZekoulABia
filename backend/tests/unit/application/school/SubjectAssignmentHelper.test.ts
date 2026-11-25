import { describe, it, expect, beforeEach } from 'bun:test';
import { assignerMatieresPourClasse, parseSerie } from '../../../../src/application/school/SubjectAssignmentHelper.ts';
import type { SubjectAssignmentRepository } from '@domain/ports/repositories/SubjectAssignmentRepository';

function mockRepo() {
  const calls: { method: string; args: any[] }[] = [];
  let hasCoeffs = false;
  let subjCounter = 0;
  const repo: SubjectAssignmentRepository = {
    createSubject: async (_schoolId, data) => {
      calls.push({ method: 'createSubject', args: [_schoolId, data] });
      subjCounter++;
      return { id: `subj-${subjCounter}` };
    },
    upsertSubjectCoefficient: async (...args: any[]) => {
      calls.push({ method: 'upsertSubjectCoefficient', args });
    },
    findSubjectCoefficient: async (...args) => {
      calls.push({ method: 'findSubjectCoefficient', args });
      return null;
    },
    findSubjects: async (schoolId) => {
      calls.push({ method: 'findSubjects', args: [schoolId] });
      return [];
    },
    findAnySubjectCoefficient: async (schoolId, classLevel) => {
      calls.push({ method: 'findAnySubjectCoefficient', args: [schoolId, classLevel] });
      return hasCoeffs ? { id: 'existing-coeff' } : null;
    },
    findAnglophoneSubjectLoads: async (templateCode, classLevel, filiere) => {
      calls.push({ method: 'findAnglophoneSubjectLoads', args: [templateCode, classLevel, filiere] });
      return [];
    },
    findAnglophoneSubjectLoadExists: async (templateCode, classLevel) => {
      calls.push({ method: 'findAnglophoneSubjectLoadExists', args: [templateCode, classLevel] });
      return false;
    },
    findCycleCoefficients: async (templateCode, classLevel, filiere) => {
      calls.push({ method: 'findCycleCoefficients', args: [templateCode, classLevel, filiere] });
      return [];
    },
    findBacCoefficients: async (serie, niveau, templateCode) => {
      calls.push({ method: 'findBacCoefficients', args: [serie, niveau, templateCode] });
      return [];
    },
  };
  return {
    calls,
    repo,
    setHasCoeffs: (v: boolean) => { hasCoeffs = v; },
  };
}

const SCHOOL_ID = 'school-test-1';
const EMPTY_CONFIG = {};
const EMPTY_SUBJECT_MAP = new Map<string, string>();
const SUBJECT_COUNT_REF = { value: 0 };

function beforeEachTest(mock: ReturnType<typeof mockRepo>) {
  mock.calls.length = 0;
  mock.setHasCoeffs(false);
  SUBJECT_COUNT_REF.value = 0;
  EMPTY_SUBJECT_MAP.clear();
}

describe('SubjectAssignmentHelper — PEBS filiere filtering', () => {
  describe('assignerMatieresPourClasse — 1er cycle FR', () => {
    describe('cycleCoefficient query', () => {
      it('filtre par filiere=FR_PEBS quand la classe a filiere=FR_PEBS', async () => {
        const mock = mockRepo();
        beforeEachTest(mock);

        await assignerMatieresPourClasse(
          mock.repo,
          { name: '6e A', level: '6e', filiere: 'FR_PEBS' },
          SCHOOL_ID,
          { niveaux1erCycle: ['6e'] },
          false,
          EMPTY_SUBJECT_MAP,
          SUBJECT_COUNT_REF,
          'LYCEE_FR',
        );

        const cycleCall = mock.calls.find(c => c.method === 'findCycleCoefficients');
        expect(cycleCall).toBeDefined();
        expect(cycleCall!.args).toEqual(['LYCEE_FR', '6e', 'FR_PEBS']);
      });

      it('filtre par filiere=FR_GENERAL quand la classe a filiere=FR_GENERAL', async () => {
        const mock = mockRepo();
        beforeEachTest(mock);

        await assignerMatieresPourClasse(
          mock.repo,
          { name: '6e B', level: '6e', filiere: 'FR_GENERAL' },
          SCHOOL_ID,
          { niveaux1erCycle: ['6e'] },
          false,
          EMPTY_SUBJECT_MAP,
          SUBJECT_COUNT_REF,
          'CES_FR',
        );

        const cycleCall = mock.calls.find(c => c.method === 'findCycleCoefficients');
        expect(cycleCall).toBeDefined();
        expect(cycleCall!.args).toEqual(['CES_FR', '6e', 'FR_GENERAL']);
      });

      it('utilise FR_GENERAL par défaut quand filiere est null', async () => {
        const mock = mockRepo();
        beforeEachTest(mock);

        await assignerMatieresPourClasse(
          mock.repo,
          { name: '5e A', level: '5e' },
          SCHOOL_ID,
          { niveaux1erCycle: ['5e'] },
          false,
          EMPTY_SUBJECT_MAP,
          SUBJECT_COUNT_REF,
          'PRIVE_FR',
        );

        const cycleCall = mock.calls.find(c => c.method === 'findCycleCoefficients');
        expect(cycleCall).toBeDefined();
        expect(cycleCall!.args).toEqual(['PRIVE_FR', '5e', 'FR_GENERAL']);
      });
    });

    describe('weeklyPeriods — câblage du volume horaire', () => {
      it('copie weeklyPeriods depuis CycleCoefficient pour le 1er cycle', async () => {
        const mock = mockRepo();
        beforeEachTest(mock);
        mock.repo.findCycleCoefficients = async () => [
          { subjectName: 'Mathématiques', coefficient: 4, weeklyPeriods: 5 },
        ];

        await assignerMatieresPourClasse(
          mock.repo,
          { name: '6e A', level: '6e' },
          SCHOOL_ID,
          { niveaux1erCycle: ['6e'] },
          false,
          EMPTY_SUBJECT_MAP,
          SUBJECT_COUNT_REF,
          'LYCEE_FR',
        );

        const upsertCall = mock.calls.find(c => c.method === 'upsertSubjectCoefficient');
        expect(upsertCall).toBeDefined();
        expect(upsertCall!.args[5]).toBe(5);
      });

      it('laisse weeklyPeriods à null pour BacCoefficient (2nd cycle FR)', async () => {
        const mock = mockRepo();
        beforeEachTest(mock);
        mock.repo.findBacCoefficients = async () => [
          { subjectName: 'Mathématiques', coefficient: 4 },
        ];

        await assignerMatieresPourClasse(
          mock.repo,
          { name: 'Tle C A', level: 'Tle' },
          SCHOOL_ID,
          EMPTY_CONFIG,
          false,
          EMPTY_SUBJECT_MAP,
          SUBJECT_COUNT_REF,
          'LYCEE_FR',
        );

        const upsertCall = mock.calls.find(c => c.method === 'upsertSubjectCoefficient');
        expect(upsertCall).toBeDefined();
        expect(upsertCall!.args[5]).toBeNull();
      });
    });
  });

  describe('assignerMatieresPourClasse — Anglophone', () => {
    describe('anglophoneSubjectLoad query', () => {
      it('filtre par filiere=EN_PEBS quand la classe a filiere=EN_PEBS', async () => {
        const mock = mockRepo();
        beforeEachTest(mock);
        mock.repo.findAnglophoneSubjectLoads = async (templateCode, classLevel, filiere) => {
          mock.calls.push({ method: 'findAnglophoneSubjectLoads', args: [templateCode, classLevel, filiere] });
          return [{ subjectName: 'English Language', coefficient: 4, weeklyPeriods: 4 }];
        };

        await assignerMatieresPourClasse(
          mock.repo,
          { name: 'Form1 EN', level: 'Form1', filiere: 'EN_PEBS' },
          SCHOOL_ID,
          EMPTY_CONFIG,
          true,
          EMPTY_SUBJECT_MAP,
          SUBJECT_COUNT_REF,
          'GHS_EN',
        );

        const aslCall = mock.calls.find(c => c.method === 'findAnglophoneSubjectLoads');
        expect(aslCall).toBeDefined();
        expect(aslCall!.args).toEqual(['GHS_EN', 'Form1', 'EN_PEBS']);

        const upsertCall = mock.calls.find(c => c.method === 'upsertSubjectCoefficient');
        expect(upsertCall).toBeDefined();
        expect(upsertCall!.args[5]).toBe(4);
      });

      it('filtre par filiere=EN_GENERAL quand la classe a filiere=EN_GENERAL', async () => {
        const mock = mockRepo();
        beforeEachTest(mock);
        mock.repo.findAnglophoneSubjectLoads = async (templateCode, classLevel, filiere) => {
          mock.calls.push({ method: 'findAnglophoneSubjectLoads', args: [templateCode, classLevel, filiere] });
          return [{ subjectName: 'English Language', coefficient: 3, weeklyPeriods: 5 }];
        };

        await assignerMatieresPourClasse(
          mock.repo,
          { name: 'Form2 A', level: 'Form2', filiere: 'EN_GENERAL' },
          SCHOOL_ID,
          EMPTY_CONFIG,
          true,
          EMPTY_SUBJECT_MAP,
          SUBJECT_COUNT_REF,
          'GSS_EN',
        );

        const aslCall = mock.calls.find(c => c.method === 'findAnglophoneSubjectLoads');
        expect(aslCall).toBeDefined();
        expect(aslCall!.args).toEqual(['GSS_EN', 'Form2', 'EN_GENERAL']);
      });

      it('utilise EN_GENERAL par défaut quand filiere est null (classe anglophone)', async () => {
        const mock = mockRepo();
        beforeEachTest(mock);
        mock.repo.findAnglophoneSubjectLoads = async (templateCode, classLevel, filiere) => {
          mock.calls.push({ method: 'findAnglophoneSubjectLoads', args: [templateCode, classLevel, filiere] });
          return [{ subjectName: 'French', coefficient: 3, weeklyPeriods: 5 }];
        };

        await assignerMatieresPourClasse(
          mock.repo,
          { name: 'Form3 A', level: 'Form3' },
          SCHOOL_ID,
          EMPTY_CONFIG,
          true,
          EMPTY_SUBJECT_MAP,
          SUBJECT_COUNT_REF,
          'PRIVE_EN',
        );

        const aslCall = mock.calls.find(c => c.method === 'findAnglophoneSubjectLoads');
        expect(aslCall).toBeDefined();
        expect(aslCall!.args).toEqual(['PRIVE_EN', 'Form3', 'EN_GENERAL']);
      });

      it('utilise EN_GENERAL par défaut pour LYCEE_BILINGUE section EN (filiere null)', async () => {
        const mock = mockRepo();
        beforeEachTest(mock);
        mock.repo.findAnglophoneSubjectLoadExists = async (templateCode, classLevel) => {
          mock.calls.push({ method: 'findAnglophoneSubjectLoadExists', args: [templateCode, classLevel] });
          return true;
        };
        mock.repo.findAnglophoneSubjectLoads = async (templateCode, classLevel, filiere) => {
          mock.calls.push({ method: 'findAnglophoneSubjectLoads', args: [templateCode, classLevel, filiere] });
          return [
            { subjectName: 'English Language', coefficient: 4, weeklyPeriods: 4 },
            { subjectName: 'French', coefficient: 3, weeklyPeriods: 5 },
          ];
        };

        await assignerMatieresPourClasse(
          mock.repo,
          { name: 'Form1 EN', level: 'Form1' },
          SCHOOL_ID,
          EMPTY_CONFIG,
          false,
          EMPTY_SUBJECT_MAP,
          SUBJECT_COUNT_REF,
          'LYCEE_BILINGUE',
        );

        const aslCall = mock.calls.find(c => c.method === 'findAnglophoneSubjectLoads');
        expect(aslCall).toBeDefined();
        expect(aslCall!.args).toEqual(['LYCEE_BILINGUE', 'Form1', 'EN_GENERAL']);
      });
    });
  });

  describe('parseSerie', () => {
    it('retourne null pour les niveaux 1er cycle', () => {
      expect(parseSerie('6e A', '6e')).toBeNull();
      expect(parseSerie('5e B', '5e')).toBeNull();
      expect(parseSerie('4e C', '4e')).toBeNull();
      expect(parseSerie('3e D', '3e')).toBeNull();
    });

    it('extrait la série pour les niveaux 2e cycle', () => {
      expect(parseSerie('2nde A4-Arabe', '2nde')).toBe('A4');
      expect(parseSerie('1ère C A', '1ère')).toBe('C');
      expect(parseSerie('Tle D A', 'Tle')).toBe('D');
    });

    it('retourne la lettre seule comme série si pas de tiret', () => {
      expect(parseSerie('2nde A', '2nde')).toBe('A');
      expect(parseSerie('Tle C A', 'Tle')).toBe('C');
    });
  });

  describe('Fallback ensureCoefficients', () => {
    function mockRepoWithSubjects(subjects: { name: string; coefficient: number }[]) {
      const base = mockRepo();
      base.repo.findSubjects = async (schoolId) => {
        base.calls.push({ method: 'findSubjects', args: [schoolId] });
        return subjects.map(s => ({ id: `subj-${s.name}`, name: s.name, coefficient: s.coefficient }));
      };
      return base;
    }

    it('crée SubjectCoefficients pour toutes les matières (niveau technique CAP1)', async () => {
      const mock = mockRepoWithSubjects([
        { name: 'Français', coefficient: 2 },
        { name: 'Mathématiques', coefficient: 2 },
        { name: 'Anglais', coefficient: 2 },
      ]);
      beforeEachTest(mock);

      await assignerMatieresPourClasse(
        mock.repo,
        { name: 'CAP1 F1', level: 'CAP1' },
        SCHOOL_ID,
        EMPTY_CONFIG,
        false,
        EMPTY_SUBJECT_MAP,
        SUBJECT_COUNT_REF,
        'LYCEE_TECHNIQUE_FR',
      );

      const createCalls = mock.calls.filter(c => c.method === 'upsertSubjectCoefficient');
      expect(createCalls.length).toBe(3);
      expect(createCalls[0].args[2]).toBe('CAP1');
    });

    it('crée SubjectCoefficients pour niveau primaire (CP)', async () => {
      const mock = mockRepoWithSubjects([
        { name: 'Français', coefficient: 5 },
        { name: 'Mathématiques', coefficient: 5 },
        { name: 'Lecture', coefficient: 3 },
      ]);
      beforeEachTest(mock);

      await assignerMatieresPourClasse(
        mock.repo,
        { name: 'CP A', level: 'CP' },
        SCHOOL_ID,
        EMPTY_CONFIG,
        false,
        EMPTY_SUBJECT_MAP,
        SUBJECT_COUNT_REF,
        'PRIMAIRE_FR',
      );

      const createCalls = mock.calls.filter(c => c.method === 'upsertSubjectCoefficient');
      expect(createCalls.length).toBe(3);
    });

    it('ne duplique pas — ensureCoefficients ne crée rien si des coeffs existent déjà', async () => {
      const mock = mockRepoWithSubjects([
        { name: 'Français', coefficient: 6 },
        { name: 'Mathématiques', coefficient: 4 },
      ]);
      beforeEachTest(mock);
      mock.setHasCoeffs(true);

      const ccBefore = mock.calls.filter(c => c.method === 'upsertSubjectCoefficient').length;

      await assignerMatieresPourClasse(
        mock.repo,
        { name: 'CAP1 F1', level: 'CAP1' },
        SCHOOL_ID,
        EMPTY_CONFIG,
        false,
        EMPTY_SUBJECT_MAP,
        SUBJECT_COUNT_REF,
        'LYCEE_TECHNIQUE_FR',
      );

      const ccAfter = mock.calls.filter(c => c.method === 'upsertSubjectCoefficient').length;
      expect(ccAfter).toBe(ccBefore);
    });
  });
});
