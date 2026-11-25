import { describe, it, expect, beforeEach } from 'bun:test';
import { GenererBulletinUseCase } from '@application/reportCard/GenererBulletinUseCase';
import type { GenererBulletinCommande } from '@application/reportCard/GenererBulletinUseCase';
import { Note } from '@domain/entities/Note';
import { Bulletin } from '@domain/entities/Bulletin';
import { Classe } from '@domain/entities/Classe';
import { User } from '@domain/entities/User';
import { School } from '@domain/entities/School';
import { BulletinBloqueError } from '@domain/errors/BulletinBloqueError';
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
import type { ClassCouncilRepository, ClassCouncilSessionData, ClassCouncilDecisionData } from '@domain/ports/repositories/ClassCouncilRepository';
import type { CouncilDecision } from '@prisma/client';

class InMemoryClassCouncilRepository implements ClassCouncilRepository {
  private locked = true;
  setLocked(v: boolean) { this.locked = v; }
  async sessionVerrouilleeExiste(_classId: string, _periodId: string): Promise<boolean> {
    return this.locked;
  }
  async listerSessions(): Promise<ClassCouncilSessionData[]> { return []; }
  async obtenirSession(): Promise<ClassCouncilSessionData | null> { return null; }
  async obtenirConfigAlertes() { return null; }
  async obtenirEnfantsParent(): Promise<string[]> { return []; }
  async creerSession(): Promise<ClassCouncilSessionData> { throw new Error('not implemented'); }
  async preRemplirDecisions(): Promise<void> {}
  async upsertDecision(): Promise<ClassCouncilDecisionData> { throw new Error('not implemented'); }
  async upsertDecisionsEnBloc(): Promise<number> { return 0; }
  async verrouillerSession(): Promise<ClassCouncilSessionData> { throw new Error('not implemented'); }
  async publierBulletins(): Promise<{ id: string; studentId: string; student: { firstName: string; lastName: string } }[]> { return []; }
  async compterNotesNonValidees(): Promise<number> { return 0; }
  async classeExiste(): Promise<{ id: string; name: string } | null> { return null; }
  async sessionExistente(): Promise<ClassCouncilSessionData | null> { return null; }
  async compterDecisions(): Promise<number> { return 0; }
  async eleveDansClasse(): Promise<boolean> { return false; }
  async obtenirMoyennesElevesParClasse(): Promise<Map<string, number>> { return new Map(); }
  async elevesDansClasse(): Promise<string[]> { return []; }
  async findClassIdsAvecConseilVerrouille(): Promise<string[]> { return []; }
  async listLockedPeriodIdsForClasse(): Promise<string[]> { return []; }
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SCHOOL_ID = 'school-1';
const CLASS_ID = 'class-3e';
const YEAR_ID = 'year-2026';
const PERIOD_ID = 'period-t1';
const STUDENT_ID = 'eleve-1';
const SUBJECT_ID = 'maths-1';

function commandeBase(): GenererBulletinCommande {
  return {
    schoolId: SCHOOL_ID,
    classId: CLASS_ID,
    academicPeriodId: PERIOD_ID,
    academicYearId: YEAR_ID,
    template: 'FR_SECONDARY',
    nomEtablissement: 'Lycée de Bastos',
    demandeurId: 'admin-1',
  };
}

function creerClasse() {
  return Classe.reconstituer({
    id: CLASS_ID,
    schoolId: SCHOOL_ID,
    academicYearId: 'annee-1',
    name: '3e',
    serie: 'C',
    capacity: 40,
    status: 'ACTIVE',
    createdAt: new Date(),
  });
}

function creerEcole() {
  return School.reconstituer({
    id: SCHOOL_ID,
    name: 'Lycée de Bastos',
    subdomain: 'lycee-bastos',
    status: 'ACTIVE',
    plan: 'STANDARD',
    subsystem: 'FRANCOPHONE',
    educationType: 'GENERAL',
    ownership: 'PRIVATE_SECULAR',
    saturdaySchedule: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function creerEleve() {
  return User.reconstituer({
    id: STUDENT_ID,
    schoolId: SCHOOL_ID,
    role: 'STUDENT',
    email: 'eleve@ecole.cm',
    firstName: 'Lionel',
    lastName: 'Mamba',
    isActive: true,
    refreshTokenVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

const MATIERE = {
  id: SUBJECT_ID,
  schoolId: SCHOOL_ID,
  name: 'Mathématiques',
  coefficient: 4,
  hoursPerWeek: 5,
  subjectType: 'THEORETICAL' as const,
};

const PERIODE = {
  id: PERIOD_ID,
  academicYearId: YEAR_ID,
  name: 'Trimestre 1',
  type: 'TRIMESTER' as const,
  orderIndex: 1,
  startDate: new Date('2025-09-01'),
  endDate: new Date('2025-12-15'),
  isCurrent: false,
};

const ANNEE = {
  id: YEAR_ID,
  schoolId: SCHOOL_ID,
  name: '2025-2026',
  startDate: new Date('2025-09-01'),
  endDate: new Date('2026-07-31'),
  isCurrent: true,
  status: 'ACTIVE' as const,
};

const SEQUENCE = {
  id: 'seq-1',
  academicPeriodId: PERIOD_ID,
  schoolId: SCHOOL_ID,
  name: 'Séquence 1',
  type: 'DS' as const,
  orderIndex: 1,
  isCurrent: true,
};

function creerNoteVerrouillee(): Note {
  return Note.reconstituer({
    id: 'note-1',
    schoolId: SCHOOL_ID,
    studentId: STUDENT_ID,
    subjectId: SUBJECT_ID,
    classId: CLASS_ID,
    academicYearId: YEAR_ID,
    sequenceId: 'seq-1',
    recordedById: 'teacher-1',
    sequenceScore: 14,
    coefficient: 4,
    maxValue: 20,
    sequenceAverage: 14,
    validationStatus: 'LOCKED',
    isAbsentGrade: false,
    isOfflineSync: false,
    createdAt: new Date(),
  });
}

function creerBulletinDejaGenere(): Bulletin {
  return Bulletin.reconstituer({
    id: 'bulletin-existant',
    schoolId: SCHOOL_ID,
    studentId: STUDENT_ID,
    academicYearId: YEAR_ID,
    academicPeriodId: PERIOD_ID,
    template: 'FR_SECONDARY',
    validationStatus: 'GENERATED',
    isGenerated: true,
    absenceCount: 0,
    lignesMatiere: [],
    pdfUrl: 'bulletins/existant.pdf',
    createdAt: new Date(),
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GenererBulletinUseCase', () => {
  let noteRepo: InMemoryNoteRepository;
  let bulletinRepo: InMemoryBulletinRepository;
  let classeRepo: InMemoryClasseRepository;
  let userRepo: InMemoryUserRepository;
  let matiereRepo: InMemoryMatiereRepository;
  let anneeRepo: InMemoryAnneeAcademiqueRepository;
  let presenceRepo: InMemoryPresenceRepository;
  let pdfService: InMemoryPdfService;
  let classCouncilRepo: InMemoryClassCouncilRepository;
  let schoolRepo: InMemorySchoolRepository;
  let sectionRepo: InMemorySectionRepository;
  let studentProfileRepo: InMemoryStudentProfileRepository;
  let useCase: GenererBulletinUseCase;

  beforeEach(() => {
    noteRepo = new InMemoryNoteRepository();
    bulletinRepo = new InMemoryBulletinRepository();
    classeRepo = new InMemoryClasseRepository();
    userRepo = new InMemoryUserRepository();
    matiereRepo = new InMemoryMatiereRepository();
    anneeRepo = new InMemoryAnneeAcademiqueRepository();
    presenceRepo = new InMemoryPresenceRepository();
    pdfService = new InMemoryPdfService();
    classCouncilRepo = new InMemoryClassCouncilRepository();
    schoolRepo = new InMemorySchoolRepository();
    sectionRepo = new InMemorySectionRepository();
    studentProfileRepo = new InMemoryStudentProfileRepository();

    useCase = new GenererBulletinUseCase(
      noteRepo, bulletinRepo, classeRepo,
      userRepo, matiereRepo, anneeRepo,
      presenceRepo, pdfService, classCouncilRepo,
      schoolRepo, sectionRepo, studentProfileRepo,
    );

    // Setup de base commun
    classeRepo.ajouter(creerClasse());
    schoolRepo.ajouter(creerEcole());
    matiereRepo.ajouter(MATIERE);
    anneeRepo.ajouterAnnee(ANNEE);
    anneeRepo.ajouterPeriode(PERIODE);
    anneeRepo.ajouterSequence(SEQUENCE);
    noteRepo.setNonValidees([]); // par défaut : toutes validées
  });

  describe('Loi 4 — notes non validées', () => {
    it('lance BulletinBloqueError si au moins une note n\'est pas validée', async () => {
      noteRepo.setNonValidees([
        { matiereNom: 'Mathématiques', enseignantNom: 'Dupont', statut: 'DRAFT' },
      ]);

      await expect(useCase.execute(commandeBase())).rejects.toThrow(BulletinBloqueError);
    });

    it('le message d\'erreur mentionne la classe et la matière bloquante', async () => {
      noteRepo.setNonValidees([
        { matiereNom: 'Français', enseignantNom: 'Martin', statut: 'DRAFT' },
      ]);

      await expect(useCase.execute(commandeBase())).rejects.toThrow('Français');
    });
  });

  describe('Erreurs — configuration manquante', () => {
    it('rejette si la classe est introuvable', async () => {
      await expect(
        useCase.execute({ ...commandeBase(), classId: 'classe-inexistante' })
      ).rejects.toThrow('Classe introuvable');
    });

    it('rejette si la période académique est introuvable', async () => {
      userRepo.ajouter(creerEleve()); // nécessaire pour passer le early-return "Aucun élève"

      await expect(
        useCase.execute({ ...commandeBase(), academicPeriodId: 'periode-inexistante' })
      ).rejects.toThrow('Période académique introuvable');
    });

    it('rejette si l\'année académique est introuvable', async () => {
      userRepo.ajouter(creerEleve()); // nécessaire pour passer le early-return "Aucun élève"

      await expect(
        useCase.execute({ ...commandeBase(), academicYearId: 'annee-inexistante' })
      ).rejects.toThrow('Année académique introuvable');
    });
  });

  describe('Cas — aucun élève', () => {
    it('retourne 0 bulletins générés si la classe n\'a pas d\'élèves', async () => {
      // userRepo vide — aucun STUDENT

      const resultat = await useCase.execute(commandeBase());

      expect(resultat.bulletinsGeneres).toBe(0);
      expect(resultat.bulletinsIgnores).toBe(0);
      expect(resultat.message).toContain('Aucun élève');
    });
  });

  describe('Cas nominal — génération d\'un bulletin', () => {
    it('génère un bulletin pour un élève avec une note validée', async () => {
      userRepo.ajouter(creerEleve());
      noteRepo.ajouter(creerNoteVerrouillee());

      const resultat = await useCase.execute(commandeBase());

      expect(resultat.bulletinsGeneres).toBe(1);
      expect(resultat.bulletinsIgnores).toBe(0);
    });

    it('appelle le service PDF pour chaque élève', async () => {
      userRepo.ajouter(creerEleve());
      noteRepo.ajouter(creerNoteVerrouillee());

      await useCase.execute(commandeBase());

      expect(pdfService.appels).toHaveLength(1);
      expect(pdfService.appels[0].nomEleve).toBe('Lionel Mamba');
      expect(pdfService.appels[0].nomClasse).toBe('3e C');
    });

    it('persiste le bulletin dans le dépôt', async () => {
      userRepo.ajouter(creerEleve());
      noteRepo.ajouter(creerNoteVerrouillee());

      await useCase.execute(commandeBase());

      expect(bulletinRepo.compter()).toBe(1);
    });

    it('le message final contient le bon compte', async () => {
      userRepo.ajouter(creerEleve());
      noteRepo.ajouter(creerNoteVerrouillee());

      const resultat = await useCase.execute(commandeBase());

      expect(resultat.message).toContain('1 bulletin(s) généré(s)');
    });
  });

  describe('Cas — bulletin déjà généré', () => {
    it('ignore un bulletin déjà généré et l\'inclut dans bulletinsIgnores', async () => {
      userRepo.ajouter(creerEleve());
      noteRepo.ajouter(creerNoteVerrouillee());
      bulletinRepo.ajouter(creerBulletinDejaGenere());

      const resultat = await useCase.execute(commandeBase());

      expect(resultat.bulletinsGeneres).toBe(0);
      expect(resultat.bulletinsIgnores).toBe(1);
    });
  });
});
