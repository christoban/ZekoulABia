import { describe, it, expect } from 'bun:test';

import { CreerActionSuiviEleveUseCase, PERMISSIONS_CONSEILLER } from '@application/suivi/CreerActionSuiviEleveUseCase';
import type { AppelantSuivi } from '@application/suivi/CreerActionSuiviEleveUseCase';
import type { StudentFollowUpRepository, FollowUpActionDetail, CreerFollowUpData, FollowUpActionType, InterviewMode } from '@domain/ports/repositories/StudentFollowUpRepository';
import type { SuiviRBACRepository } from '@domain/ports/repositories/SuiviRBACRepository';

class FakeStudentFollowUpRepository implements StudentFollowUpRepository {
  created: CreerFollowUpData[] = [];
  findByIdCalls: { id: string; schoolId: string }[] = [];
  closeCalls: { id: string; closedById: string; closingNote: string }[] = [];
  reassignCalls: { id: string; assignedToId: string }[] = [];
  listOpenCalls: { schoolId: string; options: { assignedToId?: string } }[] = [];
  listForStudentCalls: { studentProfileId: string; schoolId: string }[] = [];
  listConseillersDisponiblesCalls: { schoolId: string }[] = [];
  createConvocationCalls: { schoolId: string; studentId: string; content: string }[] = [];

  async create(data: CreerFollowUpData): Promise<FollowUpActionDetail> {
    this.created.push(data);
    return {
      id: 'action-1',
      schoolId: data.schoolId,
      studentProfileId: data.studentProfileId,
      studentId: 'student-user-1',
      studentName: 'Jean Dupont',
      classId: 'class-1',
      className: '3e A',
      classProfessorPrincipalId: null,
      triggeringRecommendationId: data.triggeringRecommendationId ?? null,
      subjectId: data.subjectId ?? null,
      subjectName: null,
      type: data.type,
      status: 'OUVERT',
      createdById: data.createdById,
      createdByName: 'Utilisateur test',
      assignedToId: data.assignedToId ?? null,
      assignedToName: null,
      targetDate: data.targetDate ?? null,
      interviewMode: data.interviewMode ?? null,
      note: data.note ?? null,
      createdAt: new Date(),
      closedAt: null,
      closedById: null,
      closedByName: null,
      closingNote: null,
    };
  }

  async findById(id: string, schoolId: string): Promise<FollowUpActionDetail | null> {
    this.findByIdCalls.push({ id, schoolId });
    return null;
  }

  async close(id: string, closedById: string, closingNote: string): Promise<FollowUpActionDetail> {
    this.closeCalls.push({ id, closedById, closingNote });
    return {
      id,
      schoolId: 'school-1',
      studentProfileId: 'profile-1',
      studentId: 'student-user-1',
      studentName: 'Jean Dupont',
      classId: 'class-1',
      className: '3e A',
      classProfessorPrincipalId: null,
      triggeringRecommendationId: null,
      subjectId: null,
      subjectName: null,
      type: 'OBSERVATION',
      status: 'CLOS',
      createdById: 'user-1',
      createdByName: 'Utilisateur test',
      assignedToId: 'user-1',
      assignedToName: 'Utilisateur test',
      targetDate: null,
      interviewMode: null,
      note: 'test',
      createdAt: new Date(),
      closedAt: new Date(),
      closedById,
      closedByName: 'Utilisateur test',
      closingNote,
    };
  }

  async reassign(id: string, assignedToId: string): Promise<FollowUpActionDetail> {
    this.reassignCalls.push({ id, assignedToId });
    return {
      id,
      schoolId: 'school-1',
      studentProfileId: 'profile-1',
      studentId: 'student-user-1',
      studentName: 'Jean Dupont',
      classId: 'class-1',
      className: '3e A',
      classProfessorPrincipalId: null,
      triggeringRecommendationId: null,
      subjectId: null,
      subjectName: null,
      type: 'OBSERVATION',
      status: 'OUVERT',
      createdById: 'user-1',
      createdByName: 'Utilisateur test',
      assignedToId,
      assignedToName: 'Utilisateur test',
      targetDate: null,
      interviewMode: null,
      note: 'test',
      createdAt: new Date(),
      closedAt: null,
      closedById: null,
      closedByName: null,
      closingNote: null,
    };
  }

  async listOpen(schoolId: string, options: { assignedToId?: string }): Promise<FollowUpActionDetail[]> {
    this.listOpenCalls.push({ schoolId, options });
    return [];
  }

  async listForStudent(studentProfileId: string, schoolId: string): Promise<FollowUpActionDetail[]> {
    this.listForStudentCalls.push({ studentProfileId, schoolId });
    return [];
  }

  async listConseillersDisponibles(schoolId: string): Promise<{ id: string; name: string }[]> {
    this.listConseillersDisponiblesCalls.push({ schoolId });
    return [];
  }

  async createConvocation(data: { schoolId: string; studentId: string; content: string }): Promise<void> {
    this.createConvocationCalls.push(data);
  }
}

class FakeSuiviRBACRepository implements SuiviRBACRepository {
  profile: { id: string; classId: string | null } | null = {
    id: 'profile-1',
    classId: 'class-1',
  };

  verifierEnseignantClasseCalls: { teacherId: string; classId: string }[] = [];
  verifierProfPrincipalCalls: { classId: string; userId: string }[] = [];
  verifierDestinataireConseillerCalls: { userId: string; schoolId: string }[] = [];
  verifierCasEscaladeCalls: { studentProfileId: string; userId: string }[] = [];
  verifierEnseignantMatiereCalls: { teacherId: string; classId: string; subjectId: string }[] = [];

  enseignantClasse = false;
  profPrincipal = false;
  destinataireConseiller = false;
  casEscalade = false;
  enseignantMatiere = false;

  async trouverProfileEleve(userId: string, schoolId: string): Promise<{ id: string; classId: string | null } | null> {
    return this.profile;
  }

  async verifierEnseignantClasse(teacherId: string, classId: string): Promise<boolean> {
    this.verifierEnseignantClasseCalls.push({ teacherId, classId });
    return this.enseignantClasse;
  }

  async verifierProfPrincipal(classId: string, userId: string): Promise<boolean> {
    this.verifierProfPrincipalCalls.push({ classId, userId });
    return this.profPrincipal;
  }

  async verifierDestinataireConseiller(userId: string, schoolId: string): Promise<boolean> {
    this.verifierDestinataireConseillerCalls.push({ userId, schoolId });
    return this.destinataireConseiller;
  }

  async verifierCasEscalade(studentProfileId: string, userId: string): Promise<boolean> {
    this.verifierCasEscaladeCalls.push({ studentProfileId, userId });
    return this.casEscalade;
  }

  async verifierEnseignantMatiere(teacherId: string, classId: string, subjectId: string): Promise<boolean> {
    this.verifierEnseignantMatiereCalls.push({ teacherId, classId, subjectId });
    return this.enseignantMatiere;
  }
}

function appelant(overrides: Partial<AppelantSuivi> = {}): AppelantSuivi {
  return {
    userId: 'user-1',
    schoolId: 'school-1',
    role: 'TEACHER',
    permissions: [],
    ...overrides,
  };
}

function creerContexte() {
  const repo = new FakeStudentFollowUpRepository();
  const rbac = new FakeSuiviRBACRepository();
  const useCase = new CreerActionSuiviEleveUseCase(repo, rbac);
  return { repo, rbac, useCase };
}

describe('CreerActionSuiviEleveUseCase', () => {
  describe('Groupe A — Préconditions', () => {
    it('A1: Élève inexistant → erreur et aucune création', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.profile = null;

      await expect(useCase.execute({
        appelant: appelant(),
        studentId: 'student-1',
        type: 'OBSERVATION',
        note: 'test',
      })).rejects.toThrow('Élève introuvable');

      expect(repo.created).toHaveLength(0);
    });

    it('A2: Élève sans classe → erreur et aucune création', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.profile = { id: 'profile-1', classId: null };

      await expect(useCase.execute({
        appelant: appelant(),
        studentId: 'student-1',
        type: 'OBSERVATION',
        note: 'test',
      })).rejects.toThrow("Cet élève n'est inscrit dans aucune classe");

      expect(repo.created).toHaveLength(0);
    });
  });

  describe('Groupe B — OBSERVATION', () => {
    it('B1: Professeur principal autorisé → création réussie', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.profPrincipal = true;

      const result = await useCase.execute({
        appelant: appelant({ role: 'TEACHER' }),
        studentId: 'student-1',
        type: 'OBSERVATION',
        note: 'Élève en difficulté en classe',
      });

      expect(result).toBeDefined();
      expect(repo.created).toHaveLength(1);
      const created = repo.created[0];
      expect(created.type).toBe('OBSERVATION');
      expect(created.createdById).toBe('user-1');
      expect(created.assignedToId).toBe('user-1');
      expect(created.note).toBe('Élève en difficulté en classe');
      expect(created.schoolId).toBe('school-1');
      expect(created.studentProfileId).toBe('profile-1');
    });

    it('B2: Enseignant de matière autorisé avec subjectId → création avec subjectId', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.profPrincipal = false;
      rbac.enseignantClasse = true;
      rbac.enseignantMatiere = true;

      const result = await useCase.execute({
        appelant: appelant({ role: 'TEACHER' }),
        studentId: 'student-1',
        type: 'OBSERVATION',
        subjectId: 'maths-1',
        note: 'Difficultés en maths',
      });

      expect(result).toBeDefined();
      expect(repo.created).toHaveLength(1);
      expect(repo.created[0].subjectId).toBe('maths-1');
    });

    it('B3: Enseignant de matière sans subjectId → erreur', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.profPrincipal = false;
      rbac.enseignantClasse = true;
      rbac.enseignantMatiere = false;

      await expect(useCase.execute({
        appelant: appelant({ role: 'TEACHER' }),
        studentId: 'student-1',
        type: 'OBSERVATION',
        note: 'test',
      })).rejects.toThrow('Précisez la matière concernée par votre observation');

      expect(repo.created).toHaveLength(0);
    });

    it('B4: Mauvaise matière → erreur', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.profPrincipal = false;
      rbac.enseignantClasse = true;
      rbac.enseignantMatiere = false;

      await expect(useCase.execute({
        appelant: appelant({ role: 'TEACHER' }),
        studentId: 'student-1',
        type: 'OBSERVATION',
        subjectId: 'maths-1',
        note: 'test',
      })).rejects.toThrow('Vous n\'enseignez pas cette matière dans la classe de cet élève');

      expect(repo.created).toHaveLength(0);
    });

    it('B5: Observation sans texte → erreur', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.profPrincipal = true;

      await expect(useCase.execute({
        appelant: appelant({ role: 'TEACHER' }),
        studentId: 'student-1',
        type: 'OBSERVATION',
        note: '',
      })).rejects.toThrow('Une observation nécessite un texte');

      expect(repo.created).toHaveLength(0);
    });

    it('B5b: Observation avec espaces seulement → erreur', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.profPrincipal = true;

      await expect(useCase.execute({
        appelant: appelant({ role: 'TEACHER' }),
        studentId: 'student-1',
        type: 'OBSERVATION',
        note: '   ',
      })).rejects.toThrow('Une observation nécessite un texte');

      expect(repo.created).toHaveLength(0);
    });

    it('B6: Conseiller avec cas escaladé → création réussie', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.casEscalade = true;

      const result = await useCase.execute({
        appelant: appelant({ role: 'STAFF', permissions: ['MANAGE_PEDAGOGICAL_BRIEF'] }),
        studentId: 'student-1',
        type: 'OBSERVATION',
        note: 'Suivi cas escaladé',
      });

      expect(result).toBeDefined();
      expect(repo.created).toHaveLength(1);
    });

    it('B7: Conseiller sans cas escaladé → refus', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.casEscalade = false;

      await expect(useCase.execute({
        appelant: appelant({ role: 'STAFF', permissions: ['MANAGE_PEDAGOGICAL_BRIEF'] }),
        studentId: 'student-1',
        type: 'OBSERVATION',
        note: 'test',
      })).rejects.toThrow('Vous n\'êtes pas autorisé à créer une action de suivi pour cet élève');

      expect(repo.created).toHaveLength(0);
    });

    it('B8: Utilisateur sans capacité → refus', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.profPrincipal = false;
      rbac.enseignantClasse = false;

      await expect(useCase.execute({
        appelant: appelant({ role: 'STAFF', permissions: [] }),
        studentId: 'student-1',
        type: 'OBSERVATION',
        note: 'test',
      })).rejects.toThrow('Vous n\'êtes pas autorisé à créer une action de suivi pour cet élève');

      expect(repo.created).toHaveLength(0);
    });
  });

  describe('Groupe C — SIGNALEMENT_CONSEILLER', () => {
    it('C1: PP autorisé avec destinataire valide → création avec assignedToId', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.profPrincipal = true;
      rbac.destinataireConseiller = true;

      const result = await useCase.execute({
        appelant: appelant({ role: 'TEACHER' }),
        studentId: 'student-1',
        type: 'SIGNALEMENT_CONSEILLER',
        assignedToId: 'conseiller-1',
        note: 'Signalement cas élève',
      });

      expect(result).toBeDefined();
      expect(repo.created).toHaveLength(1);
      expect(repo.created[0].assignedToId).toBe('conseiller-1');
    });

    it('C2: Non-PP interdit → erreur', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.profPrincipal = false;

      await expect(useCase.execute({
        appelant: appelant({ role: 'TEACHER' }),
        studentId: 'student-1',
        type: 'SIGNALEMENT_CONSEILLER',
        assignedToId: 'conseiller-1',
      })).rejects.toThrow('Seul le professeur principal peut signaler un cas au conseiller pédagogique');

      expect(repo.created).toHaveLength(0);
    });

    it('C3: Destinataire absent → erreur', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.profPrincipal = true;

      await expect(useCase.execute({
        appelant: appelant({ role: 'TEACHER' }),
        studentId: 'student-1',
        type: 'SIGNALEMENT_CONSEILLER',
      })).rejects.toThrow('Un signalement au conseiller doit désigner un destinataire précis');

      expect(repo.created).toHaveLength(0);
    });

    it('C4: Destinataire invalide → erreur et aucune création', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.profPrincipal = true;
      rbac.destinataireConseiller = false;

      await expect(useCase.execute({
        appelant: appelant({ role: 'TEACHER' }),
        studentId: 'student-1',
        type: 'SIGNALEMENT_CONSEILLER',
        assignedToId: 'conseiller-1',
      })).rejects.toThrow('Le destinataire choisi n\'est pas un conseiller pédagogique valide de votre établissement');

      expect(repo.created).toHaveLength(0);
    });
  });

  describe('Groupe D — ENTRETIEN_PARENT', () => {
    it('D1: PP avec DATE_PROPOSEE et date → création réussie', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.profPrincipal = true;
      const targetDate = new Date('2026-01-15T10:00:00Z');

      const result = await useCase.execute({
        appelant: appelant({ role: 'TEACHER' }),
        studentId: 'student-1',
        type: 'ENTRETIEN_PARENT',
        interviewMode: 'DATE_PROPOSEE',
        targetDate,
        note: 'Entretien demandé',
      });

      expect(result).toBeDefined();
      expect(repo.created).toHaveLength(1);
      expect(repo.created[0].interviewMode).toBe('DATE_PROPOSEE');
      expect(repo.created[0].targetDate).toEqual(targetDate);
    });

    it('D2: PP avec DEMANDE_DISPONIBILITE sans date → succès (cas valide)', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.profPrincipal = true;

      const result = await useCase.execute({
        appelant: appelant({ role: 'TEACHER' }),
        studentId: 'student-1',
        type: 'ENTRETIEN_PARENT',
        interviewMode: 'DEMANDE_DISPONIBILITE',
        note: 'Demande dispo',
      });

      expect(result).toBeDefined();
      expect(repo.created).toHaveLength(1);
      expect(repo.created[0].interviewMode).toBe('DEMANDE_DISPONIBILITE');
      expect(repo.created[0].targetDate).toBeUndefined();
    });

    it('D3: Mode absent → erreur', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.profPrincipal = true;

      await expect(useCase.execute({
        appelant: appelant({ role: 'TEACHER' }),
        studentId: 'student-1',
        type: 'ENTRETIEN_PARENT',
        targetDate: new Date(),
      })).rejects.toThrow('Précisez si vous proposez une date ou si vous demandez la disponibilité du parent');

      expect(repo.created).toHaveLength(0);
    });

    it('D4: DATE_PROPOSEE sans date → erreur', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.profPrincipal = true;

      await expect(useCase.execute({
        appelant: appelant({ role: 'TEACHER' }),
        studentId: 'student-1',
        type: 'ENTRETIEN_PARENT',
        interviewMode: 'DATE_PROPOSEE',
      })).rejects.toThrow('Un entretien parent nécessite une date cible');

      expect(repo.created).toHaveLength(0);
    });

    it('D5: Conseiller avec cas escaladé → création réussie', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.profPrincipal = false;
      rbac.casEscalade = true;

      const result = await useCase.execute({
        appelant: appelant({ role: 'STAFF', permissions: ['MANAGE_ORIENTATION'] }),
        studentId: 'student-1',
        type: 'ENTRETIEN_PARENT',
        interviewMode: 'DATE_PROPOSEE',
        targetDate: new Date('2026-01-15T10:00:00Z'),
        note: 'Entretien conseiller',
      });

      expect(result).toBeDefined();
      expect(repo.created).toHaveLength(1);
    });

    it('D6: Conseiller sans cas escaladé → refus', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.profPrincipal = false;
      rbac.casEscalade = false;

      await expect(useCase.execute({
        appelant: appelant({ role: 'STAFF', permissions: ['MANAGE_ORIENTATION'] }),
        studentId: 'student-1',
        type: 'ENTRETIEN_PARENT',
        interviewMode: 'DATE_PROPOSEE',
        targetDate: new Date(),
      })).rejects.toThrow('Programmer un entretien parent relève du professeur principal, ou du conseiller pédagogique une fois le cas signalé');

      expect(repo.created).toHaveLength(0);
    });

    it('D7: Enseignant ordinaire (ni PP ni conseiller escaladé) → refus', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.profPrincipal = false;
      rbac.enseignantClasse = true;
      rbac.casEscalade = false;

      await expect(useCase.execute({
        appelant: appelant({ role: 'TEACHER' }),
        studentId: 'student-1',
        type: 'ENTRETIEN_PARENT',
        interviewMode: 'DATE_PROPOSEE',
        targetDate: new Date(),
      })).rejects.toThrow('Programmer un entretien parent relève du professeur principal, ou du conseiller pédagogique une fois le cas signalé');

      expect(repo.created).toHaveLength(0);
    });
  });

  describe('Groupe E — CONVOCATION_ELEVE', () => {
    it('E1: Conseiller avec cas escaladé et date → création réussie', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.casEscalade = true;
      const targetDate = new Date('2026-01-20T14:00:00Z');

      const result = await useCase.execute({
        appelant: appelant({ role: 'STAFF', permissions: ['MANAGE_ORIENTATION'] }),
        studentId: 'student-1',
        type: 'CONVOCATION_ELEVE',
        targetDate,
        note: 'Convocation élève',
      });

      expect(result).toBeDefined();
      expect(repo.created).toHaveLength(1);
      expect(repo.created[0].targetDate).toEqual(targetDate);
    });

    it('E2: Conseiller sans cas escaladé → refus', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.casEscalade = false;

      await expect(useCase.execute({
        appelant: appelant({ role: 'STAFF', permissions: ['MANAGE_ORIENTATION'] }),
        studentId: 'student-1',
        type: 'CONVOCATION_ELEVE',
        targetDate: new Date(),
      })).rejects.toThrow('Convoquer l\'élève est exclusif au conseiller pédagogique, une fois le cas signalé');

      expect(repo.created).toHaveLength(0);
    });

    it('E3: Cas escaladé mais date absente → erreur', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.casEscalade = true;

      await expect(useCase.execute({
        appelant: appelant({ role: 'STAFF', permissions: ['MANAGE_ORIENTATION'] }),
        studentId: 'student-1',
        type: 'CONVOCATION_ELEVE',
      })).rejects.toThrow('Une convocation nécessite une date cible');

      expect(repo.created).toHaveLength(0);
    });

    it('E4: Professeur principal (même avec cas escaladé=false) → refus', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.profPrincipal = true;
      rbac.casEscalade = false;

      await expect(useCase.execute({
        appelant: appelant({ role: 'TEACHER' }),
        studentId: 'student-1',
        type: 'CONVOCATION_ELEVE',
        targetDate: new Date(),
      })).rejects.toThrow('Convoquer l\'élève est exclusif au conseiller pédagogique, une fois le cas signalé');

      expect(repo.created).toHaveLength(0);
    });
  });

  describe('Défense sur assignedToId', () => {
    it('Pour OBSERVATION, assignedToId fourni est ignoré et remplacé par createdById', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.profPrincipal = true;

      await useCase.execute({
        appelant: appelant({ role: 'TEACHER', userId: 'teacher-1' }),
        studentId: 'student-1',
        type: 'OBSERVATION',
        assignedToId: 'autre-utilisateur',
        note: 'Test',
      });

      expect(repo.created).toHaveLength(1);
      expect(repo.created[0].assignedToId).toBe('teacher-1');
    });

    it('Pour ENTRETIEN_PARENT, assignedToId fourni est ignoré', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.profPrincipal = true;

      await useCase.execute({
        appelant: appelant({ role: 'TEACHER', userId: 'teacher-1' }),
        studentId: 'student-1',
        type: 'ENTRETIEN_PARENT',
        interviewMode: 'DATE_PROPOSEE',
        targetDate: new Date(),
        assignedToId: 'autre-utilisateur',
      });

      expect(repo.created).toHaveLength(1);
      expect(repo.created[0].assignedToId).toBe('teacher-1');
    });

    it('Pour CONVOCATION_ELEVE, assignedToId fourni est ignoré', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.casEscalade = true;

      await useCase.execute({
        appelant: appelant({ role: 'STAFF', permissions: ['MANAGE_ORIENTATION'], userId: 'conseiller-1' }),
        studentId: 'student-1',
        type: 'CONVOCATION_ELEVE',
        targetDate: new Date(),
        assignedToId: 'autre-utilisateur',
      });

      expect(repo.created).toHaveLength(1);
      expect(repo.created[0].assignedToId).toBe('conseiller-1');
    });
  });

  describe('Payload complet — plusieurs champs simultanément', () => {
    it('Observation avec triggeringRecommendationId, subjectId, targetDate, note', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.profPrincipal = false;
      rbac.enseignantClasse = true;
      rbac.enseignantMatiere = true;
      const targetDate = new Date('2026-01-10T08:00:00Z');

      await useCase.execute({
        appelant: appelant({ role: 'TEACHER', userId: 'teacher-1' }),
        studentId: 'student-1',
        type: 'OBSERVATION',
        triggeringRecommendationId: 'reco-1',
        subjectId: 'maths-1',
        targetDate,
        note: 'Observation détaillée',
      });

      expect(repo.created).toHaveLength(1);
      const c = repo.created[0];
      expect(c.triggeringRecommendationId).toBe('reco-1');
      expect(c.subjectId).toBe('maths-1');
      expect(c.targetDate).toEqual(targetDate);
      expect(c.note).toBe('Observation détaillée');
      expect(c.type).toBe('OBSERVATION');
    });

    it('ENTRETIEN_PARENT avec interviewMode, targetDate, note', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.profPrincipal = true;
      const targetDate = new Date('2026-02-01T16:00:00Z');

      await useCase.execute({
        appelant: appelant({ role: 'TEACHER', userId: 'teacher-1' }),
        studentId: 'student-1',
        type: 'ENTRETIEN_PARENT',
        interviewMode: 'DATE_PROPOSEE',
        targetDate,
        note: 'Entretien parents demandé',
      });

      expect(repo.created).toHaveLength(1);
      const c = repo.created[0];
      expect(c.interviewMode).toBe('DATE_PROPOSEE');
      expect(c.targetDate).toEqual(targetDate);
      expect(c.note).toBe('Entretien parents demandé');
      expect(c.type).toBe('ENTRETIEN_PARENT');
    });

    it('SIGNALEMENT_CONSEILLER avec assignedToId, note', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.profPrincipal = true;
      rbac.destinataireConseiller = true;

      await useCase.execute({
        appelant: appelant({ role: 'TEACHER', userId: 'teacher-1' }),
        studentId: 'student-1',
        type: 'SIGNALEMENT_CONSEILLER',
        assignedToId: 'conseiller-1',
        note: 'Signalement au conseiller',
      });

      expect(repo.created).toHaveLength(1);
      const c = repo.created[0];
      expect(c.assignedToId).toBe('conseiller-1');
      expect(c.note).toBe('Signalement au conseiller');
      expect(c.type).toBe('SIGNALEMENT_CONSEILLER');
    });

    it('CONVOCATION_ELEVE avec targetDate, note', async () => {
      const { repo, rbac, useCase } = creerContexte();
      rbac.casEscalade = true;
      const targetDate = new Date('2026-03-01T09:00:00Z');

      await useCase.execute({
        appelant: appelant({ role: 'STAFF', permissions: ['MANAGE_ORIENTATION'], userId: 'conseiller-1' }),
        studentId: 'student-1',
        type: 'CONVOCATION_ELEVE',
        targetDate,
        note: 'Convocation élève pour entretien',
      });

      expect(repo.created).toHaveLength(1);
      const c = repo.created[0];
      expect(c.targetDate).toEqual(targetDate);
      expect(c.note).toBe('Convocation élève pour entretien');
      expect(c.type).toBe('CONVOCATION_ELEVE');
    });
  });
});