import { describe, it, expect } from 'bun:test';
import { PrismaRattachementEnseignantRepository } from '../../../../../src/infrastructure/persistence/prisma/PrismaRattachementEnseignantRepository';

const TEACHER_ID = 'teacher-1';
const CLASS_ID = 'class-3e';
const AUTRE_CLASSE_ID = 'class-5e';
const SUBJECT_ID = 'maths-1';

function creerPrismaFake(options: {
  assignations?: { teacherId: string; classId: string; subjectId: string }[];
  classesAvecPP?: { classId: string; professorPrincipalId: string }[];
} = {}) {
  const assignations = options.assignations ?? [];
  const classesAvecPP = options.classesAvecPP ?? [];
  return {
    teachingAssignment: {
      findFirst: async ({ where }: any) =>
        assignations.some(
          (a) =>
            a.teacherId === where.teacherId &&
            a.classId === where.classId &&
            (where.subjectId === undefined || a.subjectId === where.subjectId)
        )
          ? { id: 'ta-1' }
          : null,
    },
    class: {
      findFirst: async ({ where }: any) =>
        classesAvecPP.some((c) => c.classId === where.id && c.professorPrincipalId === where.professorPrincipalId)
          ? { id: where.id }
          : null,
    },
  } as any;
}

describe('PrismaRattachementEnseignantRepository.estRattacheALaClasse', () => {
  describe('mode strict (autoriserProfesseurPrincipal: false — notes, cahier de texte)', () => {
    it('autorise un enseignant assigné à la bonne classe ET matière', async () => {
      const repo = new PrismaRattachementEnseignantRepository(creerPrismaFake({ assignations: [{ teacherId: TEACHER_ID, classId: CLASS_ID, subjectId: SUBJECT_ID }] }));
      const result = await repo.estRattacheALaClasse(TEACHER_ID, CLASS_ID, SUBJECT_ID, { autoriserProfesseurPrincipal: false });
      expect(result).toBe(true);
    });

    it('refuse un enseignant assigné à la matière mais dans une AUTRE classe (régression du bug corrigé)', async () => {
      const repo = new PrismaRattachementEnseignantRepository(creerPrismaFake({ assignations: [{ teacherId: TEACHER_ID, classId: AUTRE_CLASSE_ID, subjectId: SUBJECT_ID }] }));
      const result = await repo.estRattacheALaClasse(TEACHER_ID, CLASS_ID, SUBJECT_ID, { autoriserProfesseurPrincipal: false });
      expect(result).toBe(false);
    });

    it('refuse un professeur principal de la classe qui ne porte pas la matière (pas de bypass en mode strict)', async () => {
      const repo = new PrismaRattachementEnseignantRepository(creerPrismaFake({ classesAvecPP: [{ classId: CLASS_ID, professorPrincipalId: TEACHER_ID }] }));
      const result = await repo.estRattacheALaClasse(TEACHER_ID, CLASS_ID, SUBJECT_ID, { autoriserProfesseurPrincipal: false });
      expect(result).toBe(false);
    });

    it('refuse un enseignant sans aucune assignation', async () => {
      const repo = new PrismaRattachementEnseignantRepository(creerPrismaFake());
      const result = await repo.estRattacheALaClasse(TEACHER_ID, CLASS_ID, SUBJECT_ID, { autoriserProfesseurPrincipal: false });
      expect(result).toBe(false);
    });
  });

  describe('mode souple (autoriserProfesseurPrincipal: true — présences, rattrapage)', () => {
    it('autorise le professeur principal de la classe, même sans assignation matière', async () => {
      const repo = new PrismaRattachementEnseignantRepository(creerPrismaFake({ classesAvecPP: [{ classId: CLASS_ID, professorPrincipalId: TEACHER_ID }] }));
      const result = await repo.estRattacheALaClasse(TEACHER_ID, CLASS_ID, SUBJECT_ID, { autoriserProfesseurPrincipal: true });
      expect(result).toBe(true);
    });

    it('autorise un enseignant de matière assigné à cette classe, sans être professeur principal', async () => {
      const repo = new PrismaRattachementEnseignantRepository(creerPrismaFake({ assignations: [{ teacherId: TEACHER_ID, classId: CLASS_ID, subjectId: SUBJECT_ID }] }));
      const result = await repo.estRattacheALaClasse(TEACHER_ID, CLASS_ID, SUBJECT_ID, { autoriserProfesseurPrincipal: true });
      expect(result).toBe(true);
    });

    it('refuse un enseignant ni PP ni assigné à cette classe', async () => {
      const repo = new PrismaRattachementEnseignantRepository(creerPrismaFake({
        assignations: [{ teacherId: TEACHER_ID, classId: AUTRE_CLASSE_ID, subjectId: SUBJECT_ID }],
        classesAvecPP: [{ classId: AUTRE_CLASSE_ID, professorPrincipalId: TEACHER_ID }],
      }));
      const result = await repo.estRattacheALaClasse(TEACHER_ID, CLASS_ID, SUBJECT_ID, { autoriserProfesseurPrincipal: true });
      expect(result).toBe(false);
    });

    it('fonctionne sans subjectId précisé (rattrapage sans matière) — PP suffit', async () => {
      const repo = new PrismaRattachementEnseignantRepository(creerPrismaFake({ classesAvecPP: [{ classId: CLASS_ID, professorPrincipalId: TEACHER_ID }] }));
      const result = await repo.estRattacheALaClasse(TEACHER_ID, CLASS_ID, undefined, { autoriserProfesseurPrincipal: true });
      expect(result).toBe(true);
    });
  });
});