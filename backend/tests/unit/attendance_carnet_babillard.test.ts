import { describe, it, expect, beforeEach } from 'bun:test';
import type { Response } from 'express';
import { EnregistrerPresenceUseCase } from '@application/attendance/EnregistrerPresenceUseCase';
import { AttendanceController } from '@infrastructure/http/controllers/AttendanceController';
import { BabillardController } from '@infrastructure/http/controllers/BabillardController';
import { CreerEntreeCarnetUseCase } from '@application/carnetLiaison/CreerEntreeCarnetUseCase';
import { ListerCarnetEleveUseCase } from '@application/carnetLiaison/ListerCarnetEleveUseCase';
import { MarquerEntreeCarnetLueUseCase } from '@application/carnetLiaison/MarquerEntreeCarnetLueUseCase';
import { RepondreEntreeCarnetUseCase } from '@application/carnetLiaison/RepondreEntreeCarnetUseCase';
import { RelancerParentsNonLusCarnetUseCase } from '@application/carnetLiaison/RelancerParentsNonLusCarnetUseCase';
import { CarnetLiaisonController } from '@infrastructure/http/controllers/CarnetLiaisonController';
import { Publication } from '@domain/entities/Publication';
import { User } from '@domain/entities/User';
import type { BabillardContextRepository } from '@domain/ports/repositories/BabillardContextRepository';
import type { SmsNotificationPort } from '@domain/ports/services/SmsNotificationPort';
import type {
  DestinataireLectureItem,
  LecturesDetailResult,
  PublicationRepository,
} from '@domain/ports/repositories/PublicationRepository';
import { InMemoryPresenceRepository } from '../helpers/repositories/InMemoryPresenceRepository.ts';
import { InMemoryUserRepository } from '../helpers/repositories/InMemoryUserRepository.ts';
import { InMemoryParentRepository } from '../helpers/repositories/InMemoryParentRepository.ts';
import { InMemoryMatiereRepository } from '../helpers/repositories/InMemoryMatiereRepository.ts';
import { InMemoryRattachementEnseignantRepository } from '../helpers/repositories/InMemoryRattachementEnseignantRepository.ts';
import { InMemoryNotificationService } from '../helpers/services/InMemoryNotificationService.ts';
import {
  AUDIT_STUB,
  InMemoryCarnetRepo,
  makeReq,
  makeRes,
  noopNext,
} from '../helpers/carnetBabillardTestFixtures.ts';

const SCHOOL_ID = 'school-test-1';

describe('Appel numérique, Babillard & Carnet de liaison', () => {
  let presenceRepo: InMemoryPresenceRepository;
  let userRepo: InMemoryUserRepository;
  let parentRepo: InMemoryParentRepository;
  let matiereRepo: InMemoryMatiereRepository;
  let rattachementRepo: InMemoryRattachementEnseignantRepository;
  let notifService: InMemoryNotificationService;

  beforeEach(async () => {
    presenceRepo = new InMemoryPresenceRepository();
    userRepo = new InMemoryUserRepository();
    parentRepo = new InMemoryParentRepository();
    matiereRepo = new InMemoryMatiereRepository();
    rattachementRepo = new InMemoryRattachementEnseignantRepository();
    notifService = new InMemoryNotificationService();

    const teacher = User.reconstituer({
      id: 'teacher-1',
      schoolId: SCHOOL_ID,
      role: 'TEACHER',
      email: 'teacher1@ecole.cm',
      firstName: 'Paul',
      lastName: 'Mbarga',
      isActive: true,
      refreshTokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await userRepo.save(teacher);
    rattachementRepo.ajouterAssignation('teacher-1', 'class-cm2', 'math-1');
    parentRepo.definirRelation('parent-1', ['eleve-1', 'eleve-2'], SCHOOL_ID);
  });

  it('enregistre PRESENT/ABSENT/LATE avec arrivedAt, lateNote et détecte clockSkewWarning > 900s', async () => {
    const useCase = new EnregistrerPresenceUseCase(
      presenceRepo,
      userRepo,
      notifService,
      rattachementRepo,
    );
    const pastClientTime = new Date(Date.now() - 40 * 60 * 1000); // -40 min => > 900s
    const arrivedAt = new Date('2026-10-10T07:45:00.000Z');

    const res = await useCase.execute({
      schoolId: SCHOOL_ID,
      classId: 'class-cm2',
      academicPeriodId: 'period-1',
      subjectId: 'math-1',
      teacherId: 'teacher-1',
      recordedById: 'teacher-1',
      date: new Date(Date.now() - 86_400_000),
      period: 'MORNING',
      isOfflineSync: true,
      clientRecordedAt: pastClientTime,
      presences: [
        { studentId: 'eleve-1', statut: 'PRESENT' },
        { studentId: 'eleve-2', statut: 'ABSENT' },
        { studentId: 'eleve-3', statut: 'LATE', arrivedAt, lateNote: 'Bus en panne' },
      ],
    });

    expect(res.enregistrees).toBe(3);
    expect(res.absents).toEqual(['eleve-2']);
    expect(res.retards).toEqual(['eleve-3']);
    expect(res.clockSkewWarning).toBe(true);
    expect(Math.abs(res.maxClockSkewSeconds ?? 0)).toBeGreaterThan(900);

    const lateRecord = await presenceRepo.findById(res.createdOrUpdatedIds![2]);
    expect(lateRecord?.lateNote).toBe('Bus en panne');
    expect(lateRecord?.arrivedAt?.toISOString()).toBe(arrivedAt.toISOString());
  });

  it('trace la correction post-validation et sécurise la justification parentale + validation admin', async () => {
    const useCase = new EnregistrerPresenceUseCase(presenceRepo, userRepo, notifService, rattachementRepo);
    const created = await useCase.execute({
      schoolId: SCHOOL_ID,
      classId: 'class-cm2',
      academicPeriodId: 'period-1',
      subjectId: 'math-1',
      teacherId: 'teacher-1',
      recordedById: 'teacher-1',
      date: new Date(Date.now() - 86_400_000),
      period: 'MORNING',
      presences: [{ studentId: 'eleve-1', statut: 'ABSENT' }],
    });
    const attendanceId = created.createdOrUpdatedIds![0];

    const ctrl = new AttendanceController(
      useCase,
      presenceRepo,
      userRepo,
      parentRepo,
      matiereRepo,
      AUDIT_STUB,
      rattachementRepo,
    );

    // 1. Correction par un enseignant non rattaché refusée (403)
    const intruderRes = makeRes();
    await ctrl.corrigerStatut(
      makeReq(
        { userId: 'teacher-intruder', schoolId: SCHOOL_ID, role: 'TEACHER', permissions: [], tokenType: 'access' },
        { status: 'LATE', lateNote: 'Retard confirmé' },
        { id: attendanceId },
      ),
      intruderRes as unknown as Response,
      noopNext,
    );
    expect(intruderRes.statusCode).toBe(403);

    // 2. Correction ABSENT -> ABSENT (avant soumission parentale) puis LATE avec previousStatus
    const lateCorrectRes = makeRes();
    await ctrl.corrigerStatut(
      makeReq(
        { userId: 'teacher-1', schoolId: SCHOOL_ID, role: 'TEACHER', permissions: [], tokenType: 'access' },
        { status: 'LATE', arrivedAt: '2026-10-10T07:40:00Z', lateNote: 'Arrivé au portail' },
        { id: attendanceId },
      ),
      lateCorrectRes as unknown as Response,
      noopNext,
    );
    expect(lateCorrectRes.statusCode).toBe(200);
    const updated = await presenceRepo.findById(attendanceId);
    expect(updated?.toObject().previousStatus).toBe('ABSENT');
    expect(updated?.status).toBe('LATE');

    // 3. Justification parentale refusée pour un parent tiers (403), acceptée pour parent légitime -> PENDING
    const forbiddenParentRes = makeRes();
    await ctrl.soumettreJustificationParent(
      makeReq(
        { userId: 'parent-other', schoolId: SCHOOL_ID, role: 'PARENT', permissions: [], tokenType: 'access' },
        { justification: 'Rendez-vous médical' },
        { id: attendanceId },
      ),
      forbiddenParentRes as unknown as Response,
      noopNext,
    );
    expect(forbiddenParentRes.statusCode).toBe(403);

    const parentRes = makeRes();
    await ctrl.soumettreJustificationParent(
      makeReq(
        { userId: 'parent-1', schoolId: SCHOOL_ID, role: 'PARENT', permissions: [], tokenType: 'access' },
        { justification: 'Consultation pédiatrique' },
        { id: attendanceId },
      ),
      parentRes as unknown as Response,
      noopNext,
    );
    expect(parentRes.statusCode).toBe(200);
    expect((await presenceRepo.findById(attendanceId))?.toObject().justificationStatus).toBe('PENDING');

    // Repasser en ABSENT puis valider par l'administration
    await presenceRepo.correctStatus(SCHOOL_ID, attendanceId, { status: 'ABSENT', updatedById: 'admin-1' });
    const approveRes = makeRes();
    await ctrl.justifierAbsence(
      makeReq(
        { userId: 'admin-1', schoolId: SCHOOL_ID, role: 'ADMIN', permissions: [], tokenType: 'access' },
        { justification: 'Certificat médical vérifié', approve: true },
        { id: attendanceId },
      ),
      approveRes as unknown as Response,
      noopNext,
    );
    expect(approveRes.statusCode).toBe(200);
    expect((await presenceRepo.findById(attendanceId))?.status).toBe('ABSENT_JUSTIFIED');
  });

  it('Babillard : expose vus/nonVus + relance Push/SMS sans aucune confirmation Oui/Non', async () => {
    const pub = new Publication({
      id: 'pub-1',
      tenantId: SCHOOL_ID,
      type: 'ANNONCE',
      titre: 'Réunion rentrée',
      corps: '<p>Présence souhaitée</p>',
      corpsFormat: 'HTML_SAFE',
      categorie: 'COMMUNIQUE',
      priorite: 'IMPORTANTE',
      audience: { roles: ['PARENT'] },
      epinglee: false,
      statut: 'PUBLIEE',
      publieeLe: new Date(),
      dureeVisibilite: 'J7',
      auteurId: 'teacher-author',
      piecesJointes: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const vus: DestinataireLectureItem[] = [
      { userId: 'parent-1', firstName: 'Aline', lastName: 'Nkomo', role: 'PARENT', phone: '+237670000001', accessMode: 'SMARTPHONE', readAt: new Date() },
    ];
    const nonVus: DestinataireLectureItem[] = [
      { userId: 'parent-2', firstName: 'Jean', lastName: 'Fouda', role: 'PARENT', phone: '+237690000002', accessMode: 'FEATURE_PHONE', readAt: null },
    ];
    const detailsStub: LecturesDetailResult = { lecturesCount: 1, destinatairesEligiblesCount: 2, vus, nonVus };
    const smsPayloads: { phones: string[]; message: string }[] = [];

    const repoStub: PublicationRepository = {
      trouverParId: async (id) => (id === 'pub-1' ? pub : null),
      listerDestinatairesLecture: async () => detailsStub,
      enregistrerAudit: async () => {},
    } as unknown as PublicationRepository;

    const ctxRepoStub: BabillardContextRepository = {
      chargerUtilisateurContexte: async (u) => ({
        userId: u.userId,
        schoolId: u.schoolId,
        role: u.role,
        permissions: u.permissions ?? [],
        enfantClassIds: [],
        enfantNiveauIds: [],
        classeEnseigneeIds: [],
        niveauEnseigneIds: [],
      }),
    } as unknown as BabillardContextRepository;

    const smsStub = {
      notifyGenericAlertSms: async (opts: { schoolId: string; phones: string[]; message: string }) => {
        smsPayloads.push({ phones: opts.phones, message: opts.message });
      },
    } as unknown as SmsNotificationPort;

    const ctrl = new BabillardController(
      repoStub,
      ctxRepoStub,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      notifService,
      smsStub,
    );

    // Enseignant tiers non auteur => 403
    const deniedRes = makeRes();
    await ctrl.lecturesDetails(
      makeReq({ userId: 'other-teacher', schoolId: SCHOOL_ID, role: 'TEACHER', permissions: [], tokenType: 'access' }, {}, { id: 'pub-1' }),
      deniedRes as unknown as Response,
      noopNext,
    );
    expect(deniedRes.statusCode).toBe(403);

    // Auteur => obtient vus & nonVus
    const detailsRes = makeRes();
    await ctrl.lecturesDetails(
      makeReq({ userId: 'teacher-author', schoolId: SCHOOL_ID, role: 'TEACHER', permissions: [], tokenType: 'access' }, {}, { id: 'pub-1' }),
      detailsRes as unknown as Response,
      noopNext,
    );
    expect(detailsRes.statusCode).toBe(200);
    const payload = detailsRes.body as { data: { vus: DestinataireLectureItem[]; nonVus: DestinataireLectureItem[] } };
    expect(payload.data.vus).toHaveLength(1);
    expect(payload.data.nonVus).toHaveLength(1);

    // Relance non-lus => Push + SMS envoyés au parent non-lu uniquement
    const remindRes = makeRes();
    await ctrl.relancerNonLus(
      makeReq({ userId: 'admin-1', schoolId: SCHOOL_ID, role: 'ADMIN', permissions: [], tokenType: 'access' }, {}, { id: 'pub-1' }),
      remindRes as unknown as Response,
      noopNext,
    );
    expect(remindRes.statusCode).toBe(200);
    expect(notifService.appels.some((n) => n.userId === 'parent-2')).toBe(true);
    expect(smsPayloads[0]?.phones).toEqual(['+237690000002']);

    // Règle métier validée : aucune confirmation Oui/Non sur BabillardController
    expect('repondre' in ctrl).toBe(false);
    expect('confirmer' in ctrl).toBe(false);
  });

  it('Carnet de liaison : anti-doublon, RBAC multi-enfants, accusé lecture, Oui/Non et relance parents', async () => {
    const carnetRepo = new InMemoryCarnetRepo();
    carnetRepo.parentMap.set('eleve-1', [
      { userId: 'parent-1', firstName: 'Aline', lastName: 'Nkomo', phone: '+237670000001', accessMode: 'SMARTPHONE' },
    ]);
    const smsCalls: string[][] = [];
    const smsStub = {
      notifyGenericAlertSms: async (opts: { phones: string[] }) => {
        smsCalls.push(opts.phones);
      },
    } as unknown as SmsNotificationPort;

    const creerUseCase = new CreerEntreeCarnetUseCase(carnetRepo, parentRepo, userRepo, notifService, smsStub);
    const listerUseCase = new ListerCarnetEleveUseCase(carnetRepo, parentRepo);
    const marquerLueUseCase = new MarquerEntreeCarnetLueUseCase(carnetRepo, parentRepo);
    const repondreUseCase = new RepondreEntreeCarnetUseCase(carnetRepo, parentRepo, notifService, presenceRepo);
    const relancerUseCase = new RelancerParentsNonLusCarnetUseCase(carnetRepo, notifService, smsStub);
    const carnetCtrl = new CarnetLiaisonController(
      creerUseCase,
      listerUseCase,
      marquerLueUseCase,
      repondreUseCase,
      relancerUseCase,
      AUDIT_STUB,
    );

    // Création avec clientRecordedAt en retard + anti-doublon sur attendanceId
    const res1 = await creerUseCase.execute({
      schoolId: SCHOOL_ID,
      authorId: 'teacher-1',
      authorRole: 'TEACHER',
      studentId: 'eleve-1',
      category: 'AUTHORIZATION',
      title: 'Sortie musée',
      content: 'Autorisez-vous la sortie ?',
      requiresConfirmation: true,
      attendanceId: 'att-uniq-1',
      clientRecordedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    });
    expect(res1.clockSkewWarning).toBe(true);
    expect(res1.entries).toHaveLength(1);

    await creerUseCase.execute({
      schoolId: SCHOOL_ID,
      authorId: 'teacher-1',
      authorRole: 'TEACHER',
      studentId: 'eleve-1',
      category: 'ABSENCE',
      title: 'Doublon absence',
      content: 'Ignoré',
      attendanceId: 'att-uniq-1',
    });
    expect(carnetRepo.entries).toHaveLength(1);

    // Parent non lié refusé en lecture => 403
    const badParentRes = makeRes();
    await carnetCtrl.listerParEleve(
      makeReq({ userId: 'parent-other', schoolId: SCHOOL_ID, role: 'PARENT', permissions: [], tokenType: 'access' }, {}, { studentId: 'eleve-1' }),
      badParentRes as unknown as Response,
      noopNext,
    );
    expect(badParentRes.statusCode).toBe(403);

    // Entrée pour un second enfant (eleve-2) du même parent -> boîte unifiée
    await creerUseCase.execute({
      schoolId: SCHOOL_ID,
      authorId: 'teacher-1',
      authorRole: 'TEACHER',
      studentId: 'eleve-2',
      category: 'INFO',
      title: 'Cahier à signer',
      content: 'Merci de vérifier',
    });
    const inboxAll = await listerUseCase.listerBoiteUnifieeParent({ parentUserId: 'parent-1', schoolId: SCHOOL_ID });
    expect(inboxAll.items).toHaveLength(2);
    const inboxFiltered = await listerUseCase.listerBoiteUnifieeParent({
      parentUserId: 'parent-1',
      schoolId: SCHOOL_ID,
      studentId: 'eleve-2',
    });
    expect(inboxFiltered.items).toHaveLength(1);

    // Relance avant réponse (parent-1 n'a pas encore confirmé)
    const remind = await relancerUseCase.execute({ entryId: res1.entries[0].id, schoolId: SCHOOL_ID, role: 'TEACHER' });
    expect(remind.notifiedCount).toBe(1);
    expect(smsCalls[0]).toEqual(['+237670000001']);

    // Accusé de lecture & confirmation Oui
    await marquerLueUseCase.execute({ entryId: res1.entries[0].id, schoolId: SCHOOL_ID, userId: 'parent-1', role: 'PARENT' });
    const rep = await repondreUseCase.execute({
      entryId: res1.entries[0].id,
      schoolId: SCHOOL_ID,
      authorId: 'parent-1',
      authorRole: 'PARENT',
      confirmed: true,
      replyText: 'Accord donné',
    });
    expect(rep.response.confirmed).toBe(true);
    expect(carnetRepo.entries[0].readReceipts.some((r) => r.userId === 'parent-1')).toBe(true);
    expect(carnetRepo.entries[0].readReceipts).toHaveLength(2);
  });
});
