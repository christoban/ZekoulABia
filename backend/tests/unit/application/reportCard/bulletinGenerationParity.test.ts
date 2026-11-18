import { describe, it, expect, beforeEach } from 'bun:test';
import PDFDocument from 'pdfkit';
import { GenererBulletinUseCase } from '@application/reportCard/GenererBulletinUseCase';
import { GenererBulletinsInngestUseCase } from '@application/reportCard/GenererBulletinsInngestUseCase';
import { formatAbsenceHoursDisplay } from '@application/reportCard/bulletinSnapshotEnricher';
import { Classe } from '@domain/entities/Classe';
import { School } from '@domain/entities/School';
import { User } from '@domain/entities/User';
import { Note } from '@domain/entities/Note';
import { Presence } from '@domain/entities/Presence';
import type { StudentBulletinSnapshot } from '@domain/types/bulletinSnapshot';
import type { ClassCouncilRepository, ClassCouncilSessionData, ClassCouncilDecisionData } from '@domain/ports/repositories/ClassCouncilRepository';
import type { ClasseCoefficientRepository, ClassSubjectOverrideRecord, SubjectCoefficientRecord } from '@domain/ports/repositories/ClasseCoefficientRepository';
import type { TeachingAssignmentRepository, TeachingAssignmentWithTeacher } from '@domain/ports/repositories/TeachingAssignmentRepository';
import type { DisciplineRepository, DisciplineRecordData, DisciplineSessionData } from '@domain/ports/repositories/DisciplineRepository';
import type { EmailService } from '@domain/ports/services/EmailService';
import { drawBulletinHeader } from '@infrastructure/pdf/report-card/BulletinPdfHelpers';
import { drawHeader } from '@infrastructure/pdf/school-documents/schoolDocumentPdfHelpers';
import { InMemoryNoteRepository } from '../../../helpers/repositories/InMemoryNoteRepository.ts';
import { InMemoryBulletinRepository } from '../../../helpers/repositories/InMemoryBulletinRepository.ts';
import { InMemoryClasseRepository } from '../../../helpers/repositories/InMemoryClasseRepository.ts';
import { InMemoryUserRepository } from '../../../helpers/repositories/InMemoryUserRepository.ts';
import { InMemoryMatiereRepository } from '../../../helpers/repositories/InMemoryMatiereRepository.ts';
import { InMemoryAnneeAcademiqueRepository } from '../../../helpers/repositories/InMemoryAnneeAcademiqueRepository.ts';
import { InMemoryPresenceRepository } from '../../../helpers/repositories/InMemoryPresenceRepository.ts';
import { InMemorySchoolRepository } from '../../../helpers/repositories/InMemorySchoolRepository.ts';
import { InMemorySectionRepository } from '../../../helpers/repositories/InMemorySectionRepository.ts';
import { InMemoryStudentProfileRepository } from '../../../helpers/repositories/InMemoryStudentProfileRepository.ts';
import { InMemoryPdfService } from '../../../helpers/services/InMemoryPdfService.ts';

class StubCouncilRepo implements ClassCouncilRepository {
  sessions = new Map<string, ClassCouncilSessionData>();
  async sessionVerrouilleeExiste(classId: string, academicPeriodId: string): Promise<boolean> {
    return this.sessions.get(`${classId}:${academicPeriodId}`)?.status === 'LOCKED';
  }
  async sessionExistente(classId: string, academicPeriodId: string): Promise<ClassCouncilSessionData | null> {
    return this.sessions.get(`${classId}:${academicPeriodId}`) ?? null;
  }
  async listerSessions(): Promise<ClassCouncilSessionData[]> { return []; }
  async obtenirSession(): Promise<ClassCouncilSessionData | null> { return null; }
  async obtenirConfigAlertes() { return null; }
  async obtenirEnfantsParent(): Promise<string[]> { return []; }
  async creerSession(): Promise<ClassCouncilSessionData> { throw new Error('unused'); }
  async preRemplirDecisions(): Promise<void> {}
  async upsertDecision(): Promise<ClassCouncilDecisionData> { throw new Error('unused'); }
  async upsertDecisionsEnBloc(): Promise<number> { return 0; }
  async verrouillerSession(): Promise<ClassCouncilSessionData> { throw new Error('unused'); }
  async compterNotesNonValidees(): Promise<number> { return 0; }
  async classeExiste(): Promise<{ id: string; name: string } | null> { return null; }
  async compterDecisions(): Promise<number> { return 0; }
  async eleveDansClasse(): Promise<boolean> { return true; }
  async obtenirMoyennesElevesParClasse(): Promise<Map<string, number>> { return new Map(); }
  async elevesDansClasse(): Promise<string[]> { return []; }
  async findClassIdsAvecConseilVerrouille(): Promise<string[]> { return []; }
  async listLockedPeriodIdsForClasse(): Promise<string[]> { return []; }
}

class StubClasseCoeffRepo implements ClasseCoefficientRepository {
  overrides: ClassSubjectOverrideRecord[] = [];
  levelCoefficients: SubjectCoefficientRecord[] = [];
  async findOverride(classId: string, subjectId: string) {
    return this.overrides.find((o) => o.classId === classId && o.subjectId === subjectId) ?? null;
  }
  async findCurriculumConfigsForClass(params: { schoolId: string; classId: string; classLevel?: string | null; serieCode?: string | null }) {
    return {
      overrides: this.overrides.filter((o) => o.schoolId === params.schoolId && o.classId === params.classId),
      levelCoefficients: this.levelCoefficients.filter(
        (c) => c.schoolId === params.schoolId && (!params.classLevel || c.classLevel === params.classLevel),
      ),
    };
  }
  async upsertOverride(): Promise<ClassSubjectOverrideRecord> { throw new Error('unused'); }
  async deleteOverride(): Promise<void> {}
  async upsertCoefficient(): Promise<SubjectCoefficientRecord> { throw new Error('unused'); }
  async deleteCoefficientsForSubject(): Promise<number> { return 0; }
}

class StubTeachingRepo implements TeachingAssignmentRepository {
  rows: TeachingAssignmentWithTeacher[] = [];
  async findByClassSubjectAndSchool(classId: string, subjectId: string, schoolId: string) {
    return this.rows.find((r) => r.classId === classId && r.subjectId === subjectId && r.schoolId === schoolId) ?? null;
  }
  async findUnique(classId: string, subjectId: string) {
    return this.rows.find((r) => r.classId === classId && r.subjectId === subjectId) ?? null;
  }
  async findByClassAndSchool(classId: string, schoolId: string) {
    return this.rows.filter((r) => r.classId === classId && r.schoolId === schoolId);
  }
}

class StubDisciplineRepo implements DisciplineRepository {
  records: DisciplineRecordData[] = [];
  async verifierEleve() { return true; }
  async findRecordsBySchool(schoolId: string) { return this.records.filter((r) => r.schoolId === schoolId); }
  async countRecordsBySchool() { return this.records.length; }
  async trouverRecord() { return null; }
  async leverRecord(): Promise<DisciplineRecordData> { throw new Error('unused'); }
  async findParentEmails(): Promise<string[]> { return []; }
  async creerSession(): Promise<DisciplineSessionData> { throw new Error('unused'); }
  async trouverSession() { return null; }
  async listerSessions(): Promise<DisciplineSessionData[]> { return []; }
  async creerRecord(): Promise<DisciplineRecordData> { throw new Error('unused'); }
  async mettreAJourSession(): Promise<DisciplineSessionData & { disciplineRecord: DisciplineRecordData | null }> { throw new Error('unused'); }
}

const noopEmailService: EmailService = {
  envoyer: async () => {},
  envoyerAvecPDF: async () => {},
};

const SCHOOL_ID = 'school-parity';
const CLASS_ID = 'cls-2nde';
const YEAR_ID = 'yr-2026';

describe('Étape 2 — Parité Sync/Inngest, Snapshot v2, Régénération, ANNUAL 6 séquences, Devise vide', () => {
  let noteRepo: InMemoryNoteRepository;
  let classeRepo: InMemoryClasseRepository;
  let userRepo: InMemoryUserRepository;
  let matiereRepo: InMemoryMatiereRepository;
  let anneeRepo: InMemoryAnneeAcademiqueRepository;
  let presenceRepo: InMemoryPresenceRepository;
  let schoolRepo: InMemorySchoolRepository;
  let sectionRepo: InMemorySectionRepository;
  let studentProfileRepo: InMemoryStudentProfileRepository;
  let councilRepo: StubCouncilRepo;
  let classeCoeffRepo: StubClasseCoeffRepo;
  let teachingRepo: StubTeachingRepo;
  let disciplineRepo: StubDisciplineRepo;

  beforeEach(() => {
    noteRepo = new InMemoryNoteRepository();
    classeRepo = new InMemoryClasseRepository();
    userRepo = new InMemoryUserRepository();
    matiereRepo = new InMemoryMatiereRepository();
    anneeRepo = new InMemoryAnneeAcademiqueRepository();
    presenceRepo = new InMemoryPresenceRepository();
    schoolRepo = new InMemorySchoolRepository();
    sectionRepo = new InMemorySectionRepository();
    studentProfileRepo = new InMemoryStudentProfileRepository();
    councilRepo = new StubCouncilRepo();
    classeCoeffRepo = new StubClasseCoeffRepo();
    teachingRepo = new StubTeachingRepo();
    disciplineRepo = new StubDisciplineRepo();

    schoolRepo.ajouter(School.reconstituer({
      id: SCHOOL_ID, name: 'Lycée de Garoua', subdomain: 'garoua', status: 'ACTIVE', plan: 'PREMIUM',
      subsystem: 'FRANCOPHONE', educationType: 'GENERAL', ownership: 'PUBLIC', saturdaySchedule: false,
      createdAt: new Date(), updatedAt: new Date(),
    }));
    sectionRepo.set({ id: 'sec-fr', schoolId: SCHOOL_ID, code: 'FR' });
    classeRepo.ajouter(Classe.reconstituer({
      id: CLASS_ID, schoolId: SCHOOL_ID, academicYearId: YEAR_ID, name: '2nde', serie: 'C',
      level: '2nde', sectionId: 'sec-fr', professorPrincipalId: 'prof-pp', capacity: 60, status: 'ACTIVE', createdAt: new Date(),
    }));
    userRepo.ajouter(User.reconstituer({
      id: 'prof-pp', schoolId: SCHOOL_ID, role: 'TEACHER', email: 'pp@garoua.cm', firstName: 'Ahmadou', lastName: 'Bello',
      isActive: true, refreshTokenVersion: 0, createdAt: new Date(), updatedAt: new Date(),
    }));
    anneeRepo.ajouterAnnee({
      id: YEAR_ID, schoolId: SCHOOL_ID, name: '2025-2026',
      startDate: new Date('2025-09-01'), endDate: new Date('2026-07-01'), isCurrent: true, status: 'ACTIVE',
    });

    // Élèves & profils identité + LV2
    userRepo.ajouter(User.reconstituer({
      id: 'eleve-1', schoolId: SCHOOL_ID, role: 'STUDENT', email: 'e1@garoua.cm', firstName: 'Amina', lastName: 'Oumarou',
      isActive: true, refreshTokenVersion: 0, createdAt: new Date(), updatedAt: new Date(),
    }));
    userRepo.ajouter(User.reconstituer({
      id: 'eleve-2', schoolId: SCHOOL_ID, role: 'STUDENT', email: 'e2@garoua.cm', firstName: 'Jean', lastName: 'Kouam',
      isActive: true, refreshTokenVersion: 0, createdAt: new Date(), updatedAt: new Date(),
    }));
    userRepo.definirClasseEleve('eleve-1', CLASS_ID);
    userRepo.definirClasseEleve('eleve-2', CLASS_ID);
    studentProfileRepo.set({
      studentId: 'eleve-1', lv2SubjectId: 'sub-esp', alevelSubjectIds: [],
      matricule: 'GAR-26-001', dateOfBirth: new Date('2010-03-14'), placeOfBirth: 'Garoua', gender: 'F', isRepeater: false, photoUrl: 'photos/amina.png',
    });
    studentProfileRepo.set({
      studentId: 'eleve-2', lv2SubjectId: 'sub-all', alevelSubjectIds: [],
      matricule: 'GAR-26-002', dateOfBirth: new Date('2009-11-02'), placeOfBirth: 'Douala', gender: 'M', isRepeater: true, photoUrl: null,
    });

    // Matières + groupes curriculum + enseignants
    matiereRepo.ajouter({ id: 'sub-math', schoolId: SCHOOL_ID, name: 'Mathématiques', coefficient: 4, hoursPerWeek: 5, subjectType: 'THEORETICAL' });
    matiereRepo.ajouter({ id: 'sub-phys', schoolId: SCHOOL_ID, name: 'Physique', coefficient: 3, hoursPerWeek: 4, subjectType: 'THEORETICAL' });
    matiereRepo.ajouter({ id: 'sub-esp', schoolId: SCHOOL_ID, name: 'Espagnol', coefficient: 2, hoursPerWeek: 2, subjectType: 'THEORETICAL', groupKey: 'LITT', groupLabel: 'Littératures & Langues', groupOrder: 2 });
    matiereRepo.ajouter({ id: 'sub-all', schoolId: SCHOOL_ID, name: 'Allemand', coefficient: 2, hoursPerWeek: 2, subjectType: 'THEORETICAL', groupKey: 'LITT', groupLabel: 'Littératures & Langues', groupOrder: 2 });
    matiereRepo.setLV2SubjectIds(['sub-esp', 'sub-all']);

    classeCoeffRepo.overrides.push({
      id: 'ov-math', schoolId: SCHOOL_ID, classId: CLASS_ID, subjectId: 'sub-math',
      coefficient: 5, groupKey: 'SCI', groupLabel: 'Sciences & Techniques', groupOrder: 1,
    });
    classeCoeffRepo.levelCoefficients.push({
      id: 'lc-phys', schoolId: SCHOOL_ID, subjectId: 'sub-phys', classLevel: '2nde', serieCode: 'C',
      coefficient: 4, groupKey: 'SCI', groupLabel: 'Sciences & Techniques', groupOrder: 1,
    });

    teachingRepo.rows.push(
      { id: 'ta-1', schoolId: SCHOOL_ID, classId: CLASS_ID, subjectId: 'sub-math', teacherId: 't-1', academicYearId: YEAR_ID, teacherName: 'Mme Ngono' },
      { id: 'ta-2', schoolId: SCHOOL_ID, classId: CLASS_ID, subjectId: 'sub-phys', teacherId: 't-2', academicYearId: YEAR_ID, teacherName: 'M. Kamga' },
      { id: 'ta-3', schoolId: SCHOOL_ID, classId: CLASS_ID, subjectId: 'sub-esp', teacherId: 't-3', academicYearId: YEAR_ID, teacherName: 'M. Biya' },
    );

    noteRepo.setNonValidees([]);
  });

  function setupTrimesterNotes(periodId = 'per-t1') {
    anneeRepo.ajouterPeriode({ id: periodId, academicYearId: YEAR_ID, name: 'Trimestre 1', type: 'TRIMESTER', orderIndex: 1, startDate: new Date('2025-09-01'), endDate: new Date('2025-12-15'), isCurrent: true });
    anneeRepo.ajouterSequence({ id: 'seq-1', academicPeriodId: periodId, schoolId: SCHOOL_ID, name: 'SÉQ 1', type: 'DS', orderIndex: 1, isCurrent: false });
    anneeRepo.ajouterSequence({ id: 'seq-2', academicPeriodId: periodId, schoolId: SCHOOL_ID, name: 'SÉQ 2', type: 'DS', orderIndex: 2, isCurrent: true });

    const addGrade = (studentId: string, subjectId: string, seqId: string, score: number, coef: number) =>
      noteRepo.ajouter(Note.reconstituer({
        id: `${studentId}-${subjectId}-${seqId}`, schoolId: SCHOOL_ID, studentId, subjectId, classId: CLASS_ID,
        academicYearId: YEAR_ID, sequenceId: seqId, recordedById: 'teacher-1',
        sequenceScore: score, coefficient: coef, maxValue: 20, sequenceAverage: score,
        validationStatus: 'LOCKED', isAbsentGrade: false, isOfflineSync: false, createdAt: new Date(),
      }));

    // eleve-1 : Math(5)=16, Phys(4)=14, Esp(2)=15 + note parasite Allemand(2)=02 à filtrer!
    addGrade('eleve-1', 'sub-math', 'seq-1', 15, 5);
    addGrade('eleve-1', 'sub-math', 'seq-2', 17, 5);
    addGrade('eleve-1', 'sub-phys', 'seq-1', 14, 4);
    addGrade('eleve-1', 'sub-esp', 'seq-1', 15, 2);
    addGrade('eleve-1', 'sub-all', 'seq-1', 2, 2);

    // eleve-2 : Math(5)=10, Phys(4)=12, All(2)=11
    addGrade('eleve-2', 'sub-math', 'seq-1', 10, 5);
    addGrade('eleve-2', 'sub-phys', 'seq-1', 12, 4);
    addGrade('eleve-2', 'sub-all', 'seq-1', 11, 2);

    // Conduite & sanctions + conseil LOCKED
    presenceRepo.ajouter(Presence.reconstituer({
      id: 'pres-1', schoolId: SCHOOL_ID, studentId: 'eleve-1', classId: CLASS_ID, academicPeriodId: periodId,
      subjectId: 'sub-math', date: new Date('2025-10-05'), status: 'ABSENT', period: 'MORNING', isOfflineSync: false, createdAt: new Date(),
    }));
    presenceRepo.ajouter(Presence.reconstituer({
      id: 'pres-2', schoolId: SCHOOL_ID, studentId: 'eleve-1', classId: CLASS_ID, academicPeriodId: periodId,
      date: new Date('2025-10-06'), status: 'ABSENT_JUSTIFIED', period: 'AFTERNOON', isOfflineSync: false, createdAt: new Date(),
    }));
    presenceRepo.ajouter(Presence.reconstituer({
      id: 'pres-3', schoolId: SCHOOL_ID, studentId: 'eleve-1', classId: CLASS_ID, academicPeriodId: periodId,
      date: new Date('2025-10-07'), status: 'LATE', period: 'MORNING', isOfflineSync: false, createdAt: new Date(),
    }));
    disciplineRepo.records.push({
      id: 'disc-1', schoolId: SCHOOL_ID, studentId: 'eleve-1', type: 'WARNING_WRITTEN',
      reason: 'Bavardage répété', decidedById: 'prof-pp', startDate: null, endDate: null, createdAt: new Date('2025-10-10'),
    });
    councilRepo.sessions.set(`${CLASS_ID}:${periodId}`, {
      id: 'cc-1', schoolId: SCHOOL_ID, classId: CLASS_ID, academicPeriodId: periodId, presidedById: 'prof-pp',
      status: 'LOCKED', createdAt: new Date(), validatedAt: new Date(),
      decisions: [
        { id: 'dec-1', sessionId: 'cc-1', studentId: 'eleve-1', decision: 'PASS', observations: 'Félicitations et Tableau d’honneur', createdAt: new Date() },
        { id: 'dec-2', sessionId: 'cc-1', studentId: 'eleve-2', decision: 'DELIBERATION', observations: null, createdAt: new Date() },
      ],
    });
  }

  it('produit exactement le même snapshot v2 entre GenererBulletinUseCase (sync) et GenererBulletinsInngestUseCase', async () => {
    setupTrimesterNotes('per-t1');
    const bulletinRepoSync = new InMemoryBulletinRepository();
    const bulletinRepoInngest = new InMemoryBulletinRepository();

    const syncUseCase = new GenererBulletinUseCase(
      noteRepo, bulletinRepoSync, classeRepo, userRepo, matiereRepo, anneeRepo,
      presenceRepo, new InMemoryPdfService(), councilRepo, schoolRepo, sectionRepo, studentProfileRepo,
      classeCoeffRepo, teachingRepo, disciplineRepo,
    );
    const inngestUseCase = new GenererBulletinsInngestUseCase(
      anneeRepo, userRepo, noteRepo, presenceRepo, bulletinRepoInngest, schoolRepo, matiereRepo,
      noopEmailService, classeRepo, councilRepo, sectionRepo, studentProfileRepo,
      classeCoeffRepo, teachingRepo, disciplineRepo,
    );

    const resSync = await syncUseCase.execute({
      schoolId: SCHOOL_ID, classId: CLASS_ID, academicPeriodId: 'per-t1', academicYearId: YEAR_ID,
      template: 'FR_SECONDARY', nomEtablissement: 'Lycée de Garoua', demandeurId: 'admin-1', demandeurRole: 'ADMIN',
    });
    const resInngest = await inngestUseCase.generer({
      yearId: YEAR_ID, periodId: 'per-t1', classId: CLASS_ID, template: 'FR_SECONDARY',
    });

    expect(resSync.bulletinsGeneres).toBe(2);
    expect(resInngest.generated).toBe(2);

    const b1Sync = (await bulletinRepoSync.findByEleveEtPeriode('eleve-1', 'per-t1'))!.toObject();
    const b1Ing = (await bulletinRepoInngest.findByEleveEtPeriode('eleve-1', 'per-t1'))!.toObject();
    // Moyenne eleve-1 : (16×5 + 14×4 + 15×2) / 11 = (80 + 56 + 30)/11 = 166/11 = 15.09 ; Allemand filtré !
    expect(b1Sync.generalAverage).toBe(15.09);
    expect(b1Ing.generalAverage).toBe(b1Sync.generalAverage);
    expect(b1Ing.rank).toBe(b1Sync.rank);
    expect(b1Ing.mention).toBe(b1Sync.mention);
    expect(b1Sync.computationVersion).toBe(2);
    expect(b1Ing.computationVersion).toBe(2);
    expect(b1Sync.lignesMatiere.map((l) => l.subjectId)).not.toContain('sub-all');
    expect(b1Ing.lignesMatiere.map((l) => l.subjectId)).not.toContain('sub-all');

    for (let i = 0; i < b1Sync.lignesMatiere.length; i++) {
      const ls = b1Sync.lignesMatiere[i]!;
      const li = b1Ing.lignesMatiere[i]!;
      expect(ls.weightedScore).toBeDefined();
      expect(li.weightedScore).toBe(ls.weightedScore);
      expect(li.subjectRank).toBe(ls.subjectRank);
      expect(li.groupKey).toBe(ls.groupKey);
      expect(li.groupLabel).toBe(ls.groupLabel);
      expect(li.teacherName).toBe(ls.teacherName);
    }

    const snapSync = b1Sync.snapshotData as StudentBulletinSnapshot;
    const snapIng = b1Ing.snapshotData as StudentBulletinSnapshot;
    expect(snapSync.mainTeacherName).toBe('Ahmadou Bello');
    expect(snapIng.mainTeacherName).toBe('Ahmadou Bello');
    expect(snapSync.studentIdentity?.matricule).toBe('GAR-26-001');
    expect(snapIng.studentIdentity?.matricule).toBe('GAR-26-001');
    expect(snapSync.conduct?.justifiedAbsenceHours).toBeNull();
    expect(snapSync.conduct?.unjustifiedAbsenceHours).toBeNull();
    expect(snapSync.conduct?.totalAbsenceHours).toBeNull();
    expect(snapSync.conduct?.totalAbsenceDays).toBe(2);
    expect(snapSync.conduct?.lateCount).toBe(1);
    expect(snapSync.conduct?.warningsCount).toBe(1);
    expect(snapIng.conduct).toEqual(snapSync.conduct);
    expect(snapSync.councilDecision?.decision).toBe('PASS');
    expect(snapIng.councilDecision).toEqual(snapSync.councilDecision);
    expect(snapIng.classProfile).toEqual(snapSync.classProfile);
    expect(b1Sync.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(b1Ing.contentHash).toBe(b1Sync.contentHash);
  });

  it('applique la régénération contrôlée (ADMIN + motif obligatoire -> archive REVOKED)', async () => {
    setupTrimesterNotes('per-t1');
    const bulletinRepo = new InMemoryBulletinRepository();
    const useCase = new GenererBulletinUseCase(
      noteRepo, bulletinRepo, classeRepo, userRepo, matiereRepo, anneeRepo,
      presenceRepo, new InMemoryPdfService(), councilRepo, schoolRepo, sectionRepo, studentProfileRepo,
      classeCoeffRepo, teachingRepo, disciplineRepo,
    );

    await useCase.execute({
      schoolId: SCHOOL_ID, classId: CLASS_ID, academicPeriodId: 'per-t1', academicYearId: YEAR_ID,
      template: 'FR_SECONDARY', nomEtablissement: 'Lycée de Garoua', demandeurId: 'admin-1', demandeurRole: 'ADMIN',
    });

    await expect(useCase.execute({
      schoolId: SCHOOL_ID, classId: CLASS_ID, academicPeriodId: 'per-t1', academicYearId: YEAR_ID,
      template: 'FR_SECONDARY', nomEtablissement: 'Lycée de Garoua', demandeurId: 'staff-1', demandeurRole: 'STAFF',
      forceRegenerate: true, motifRegeneration: 'Correction note',
    })).rejects.toThrow('Seul un administrateur');

    await expect(useCase.execute({
      schoolId: SCHOOL_ID, classId: CLASS_ID, academicPeriodId: 'per-t1', academicYearId: YEAR_ID,
      template: 'FR_SECONDARY', nomEtablissement: 'Lycée de Garoua', demandeurId: 'admin-1', demandeurRole: 'ADMIN',
      forceRegenerate: true, motifRegeneration: '   ',
    })).rejects.toThrow('motif obligatoire');

    const oldBulletin = (await bulletinRepo.findByEleveEtPeriode('eleve-1', 'per-t1'))!;
    noteRepo.ajouter(Note.reconstituer({
      id: 'eleve-1-sub-math-seq-2', schoolId: SCHOOL_ID, studentId: 'eleve-1', subjectId: 'sub-math', classId: CLASS_ID,
      academicYearId: YEAR_ID, sequenceId: 'seq-2', recordedById: 'teacher-1',
      sequenceScore: 19, coefficient: 5, maxValue: 20, sequenceAverage: 19,
      validationStatus: 'LOCKED', isAbsentGrade: false, isOfflineSync: false, createdAt: new Date(),
    }));

    const regenRes = await useCase.execute({
      schoolId: SCHOOL_ID, classId: CLASS_ID, academicPeriodId: 'per-t1', academicYearId: YEAR_ID,
      template: 'FR_SECONDARY', nomEtablissement: 'Lycée de Garoua', demandeurId: 'admin-1', demandeurRole: 'ADMIN',
      forceRegenerate: true, motifRegeneration: 'Correction erreur de saisie Math SÉQ 2',
    });
    expect(regenRes.bulletinsGeneres).toBe(2);

    const revocations = await bulletinRepo.findRevocationsByStudent(SCHOOL_ID, 'eleve-1');
    expect(revocations).toHaveLength(1);
    expect(revocations[0]!.originalReportCardId).toBe(oldBulletin.id);
    expect(revocations[0]!.revokedById).toBe('admin-1');
    expect(revocations[0]!.revocationReason).toBe('Correction erreur de saisie Math SÉQ 2');
    expect(revocations[0]!.generalAverage).toBe(15.09);

    const current = (await bulletinRepo.findByEleveEtPeriode('eleve-1', 'per-t1'))!;
    expect(current.id).not.toBe(oldBulletin.id);
    expect(current.generalAverage).toBe(15.55); // Math 17*5 + Phys 14*4 + Esp 15*2 = 171 / 11 = 15.55
    expect(current.computationVersion).toBe(2);
  });

  it('charge les 6 séquences de l\'année pour le template ANNUAL et verrouille toutes les périodes', async () => {
    const tIds = ['per-t1', 'per-t2', 'per-t3'] as const;
    const seqScores = [10, 12, 14, 16, 18, 20];
    tIds.forEach((pid, pIdx) => {
      anneeRepo.ajouterPeriode({
        id: pid, academicYearId: YEAR_ID, name: `Trimestre ${pIdx + 1}`, type: 'TRIMESTER',
        orderIndex: pIdx + 1, startDate: new Date(2025, 8 + pIdx * 3, 1), endDate: new Date(2025, 10 + pIdx * 3, 1), isCurrent: pIdx === 2,
      });
      for (let s = 0; s < 2; s++) {
        const globalSeq = pIdx * 2 + s + 1;
        const seqId = `seq-${globalSeq}`;
        anneeRepo.ajouterSequence({
          id: seqId, academicPeriodId: pid, schoolId: SCHOOL_ID, name: `SÉQ ${globalSeq}`, type: 'DS', orderIndex: s + 1, isCurrent: globalSeq === 6,
        });
        noteRepo.ajouter(Note.reconstituer({
          id: `n-${seqId}`, schoolId: SCHOOL_ID, studentId: 'eleve-1', subjectId: 'sub-math', classId: CLASS_ID,
          academicYearId: YEAR_ID, sequenceId: seqId, recordedById: 't-1',
          sequenceScore: seqScores[globalSeq - 1]!, coefficient: 5, maxValue: 20, sequenceAverage: seqScores[globalSeq - 1]!,
          validationStatus: 'LOCKED', isAbsentGrade: false, isOfflineSync: false, createdAt: new Date(),
        }));
      }
    });

    councilRepo.sessions.set(`${CLASS_ID}:per-t3`, {
      id: 'cc-ann', schoolId: SCHOOL_ID, classId: CLASS_ID, academicPeriodId: 'per-t3', presidedById: 'prof-pp',
      status: 'LOCKED', createdAt: new Date(), validatedAt: new Date(), decisions: [],
    });

    const bulletinRepo = new InMemoryBulletinRepository();
    const useCase = new GenererBulletinUseCase(
      noteRepo, bulletinRepo, classeRepo, userRepo, matiereRepo, anneeRepo,
      presenceRepo, new InMemoryPdfService(), councilRepo, schoolRepo, sectionRepo, studentProfileRepo,
      classeCoeffRepo, teachingRepo, disciplineRepo,
    );

    await useCase.execute({
      schoolId: SCHOOL_ID, classId: CLASS_ID, academicPeriodId: 'per-t3', academicYearId: YEAR_ID,
      template: 'ANNUAL', nomEtablissement: 'Lycée de Garoua', demandeurId: 'admin-1', demandeurRole: 'ADMIN',
    });

    const annual = (await bulletinRepo.findByEleveEtPeriode('eleve-1', 'per-t3'))!.toObject();
    const line = annual.lignesMatiere[0]!;
    expect(line.seq1Score).toBe(10);
    expect(line.seq2Score).toBe(12);
    expect(line.seq3Score).toBe(14);
    expect(line.seq4Score).toBe(16);
    expect(line.seq5Score).toBe(18);
    expect(line.seq6Score).toBe(20);
    expect(annual.generalAverage).toBe(15);
    const snap = annual.snapshotData as StudentBulletinSnapshot;
    expect(snap.sequenceAverages).toHaveLength(6);
    expect(snap.termAverages).toEqual({ trim1: 11, trim2: 15, trim3: 19 });
  });

  it('gère une devise vide ou blanche sans aucune ligne ni guillemets vides dans les en-têtes PDF', () => {
    const capturedTexts: string[] = [];
    const origText = PDFDocument.prototype.text;
    PDFDocument.prototype.text = function patchedText(
      this: PDFKit.PDFDocument,
      text?: string,
      ...rest: unknown[]
    ) {
      if (typeof text === 'string') capturedTexts.push(text);
      return (origText as (...args: unknown[]) => PDFKit.PDFDocument).call(this, text, ...rest);
    } as typeof PDFDocument.prototype.text;

    try {
      for (const motto of ['', '   ']) {
        const doc1 = new PDFDocument({ size: 'A4', margin: 40 });
        drawBulletinHeader(doc1, {
          schoolName: 'Lycée de Garoua', schoolMotto: motto,
          studentName: 'Amina Oumarou', className: '2nde C', periodName: 'Trimestre 1',
          yearName: '2025-2026', template: 'FR_SECONDARY',
        });
        const doc2 = new PDFDocument({ size: 'A4', margin: 40 });
        drawHeader(doc2, { name: 'Lycée de Garoua', motto }, 'CERTIFICAT');
      }
      expect(capturedTexts.some((t) => t.trim() === '' || t.trim() === '""')).toBe(false);
    } finally {
      PDFDocument.prototype.text = origText;
    }
  });

  it('ne fabrique aucune heure d’absence estimée (stocke null et affiche « — »)', async () => {
    setupTrimesterNotes('per-t1');
    const bulletinRepo = new InMemoryBulletinRepository();
    const useCase = new GenererBulletinUseCase(
      noteRepo, bulletinRepo, classeRepo, userRepo, matiereRepo, anneeRepo,
      presenceRepo, new InMemoryPdfService(), councilRepo, schoolRepo, sectionRepo, studentProfileRepo,
      classeCoeffRepo, teachingRepo, disciplineRepo,
    );

    await useCase.execute({
      schoolId: SCHOOL_ID, classId: CLASS_ID, academicPeriodId: 'per-t1', academicYearId: YEAR_ID,
      template: 'FR_SECONDARY', nomEtablissement: 'Lycée de Garoua', demandeurId: 'admin-1', demandeurRole: 'ADMIN',
    });

    const bulletin = (await bulletinRepo.findByEleveEtPeriode('eleve-1', 'per-t1'))!.toObject();
    const snap = bulletin.snapshotData as StudentBulletinSnapshot;
    expect(snap.conduct?.justifiedAbsenceHours).toBeNull();
    expect(snap.conduct?.unjustifiedAbsenceHours).toBeNull();
    expect(snap.conduct?.totalAbsenceHours).toBeNull();
    expect(snap.conduct?.totalAbsenceDays).toBe(2);
    expect(formatAbsenceHoursDisplay(snap.conduct?.justifiedAbsenceHours)).toBe('—');
    expect(formatAbsenceHoursDisplay(snap.conduct?.unjustifiedAbsenceHours)).toBe('—');
    expect(formatAbsenceHoursDisplay(6)).toBe('6 h');

    const drawnTexts: string[] = [];
    const origText = PDFDocument.prototype.text;
    PDFDocument.prototype.text = function patched(this: PDFKit.PDFDocument, text?: string, ...rest: unknown[]) {
      if (typeof text === 'string') drawnTexts.push(text);
      return (origText as (...args: unknown[]) => PDFKit.PDFDocument).call(this, text, ...rest);
    } as typeof PDFDocument.prototype.text;
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      drawBulletinHeader(doc, {
        schoolName: 'Lycée de Garoua', studentName: 'Amina Oumarou', className: '2nde C',
        periodName: 'Trimestre 1', yearName: '2025-2026', absenceCount: 2, snapshot: snap, template: 'FR_SECONDARY',
      });
      expect(drawnTexts.some((t) => t.includes('Heures : —'))).toBe(true);
    } finally {
      PDFDocument.prototype.text = origText;
    }
  });
});
