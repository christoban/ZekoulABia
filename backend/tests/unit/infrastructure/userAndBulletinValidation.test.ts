/**
 * Tests unitaires :
 * 1. UserController.myClass — retourne 404 quand l'utilisateur n'est PP d'aucune classe
 * 2. BulletinValidationRepository.listerSessions — filtres classId + status combinés
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { InMemoryClasseRepository } from '../../helpers/repositories/InMemoryClasseRepository';
import { InMemoryBulletinValidationRepository } from '../../helpers/repositories/InMemoryBulletinValidationRepository';
import { UserController } from '@infrastructure/http/controllers/UserController';

// ── Helpers ────────────────────────────────────────────────────────────────

function creerReqRes(user: { userId: string; schoolId: string }) {
  const req = { user } as any;
  let jsonPayload: any = null;
  let statusCode = 200;
  const res = {
    status(code: number) { statusCode = code; return res; },
    json(payload: any) { jsonPayload = payload; },
  } as any;
  const next = (err: any) => { throw err; };
  return { req, res, next, getJson: () => jsonPayload, getStatus: () => statusCode };
}

// ── UserController.myClass ──────────────────────────────────────────────────

describe('UserController.myClass — retourne 404 quand l\'utilisateur n\'est PP d\'aucune classe', () => {
  let classeRepo: InMemoryClasseRepository;
  let controller: UserController;

  beforeEach(() => {
    classeRepo = new InMemoryClasseRepository();
    // Le controller a besoin de beaucoup de dépendances, on crée un stub minimal
    controller = new UserController(
      {} as any, // connecter
      {} as any, // inscrire
      {} as any, // rafraichir
      {} as any, // deconnecter
      {} as any, // modifier
      {} as any, // supprimer
      {} as any, // transferer
      {} as any, // tokenService
      {} as any, // schoolRepository
      {} as any, // designerAP
      {} as any, // importer
      {} as any, // loginEmailOtp
      {} as any, // importRepository
      {} as any, // verifierMfaConnexion
      {} as any, // audit
      {} as any, // userRepository
      {} as any, // mfaUseCase
      {} as any, // politiqueEnvoiSortant
      classeRepo,
      {} as any, // enrollmentRepository
    );
  });

  it('retourne 404 avec message explicite quand l\'utilisateur n\'est PP d\'aucune classe', async () => {
    // classeRepo est vide — findClasseDeProfPrincipal retourne null
    const { req, res, next, getStatus, getJson } = creerReqRes({ userId: 'teacher-999', schoolId: 'school-1' });

    await controller.myClass(req, res, next);

    expect(getStatus()).toBe(404);
    expect(getJson().success).toBe(false);
    expect(getJson().message).toBe("Vous n'êtes titulaire d'aucune classe");
  });
});

// ── BulletinValidationRepository.listerSessions ────────────────────────────

describe('BulletinValidationRepository.listerSessions — filtres classId + status combinés', () => {
  let repo: InMemoryBulletinValidationRepository;

  beforeEach(() => {
    repo = new InMemoryBulletinValidationRepository();
  });

  it('retourne uniquement les sessions correspondant aux deux filtres classId + status simultanément', async () => {
    // Créer des sessions variées
    await repo.creerSession({ schoolId: 's1', classId: 'c1', academicPeriodId: 'p1', submittedById: 'u1' });
    await repo.creerSession({ schoolId: 's1', classId: 'c2', academicPeriodId: 'p1', submittedById: 'u1' });
    const s3 = await repo.creerSession({ schoolId: 's1', classId: 'c1', academicPeriodId: 'p2', submittedById: 'u1' });
    await repo.validerSession(s3.id, 'validator-1');

    // Filtrer par classId=c1 + status=VALIDATED — ne doit retourner que s3
    const result = await repo.listerSessions('s1', { classId: 'c1', status: 'VALIDATED' });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(s3.id);
    expect(result[0].status).toBe('VALIDATED');
  });

  it('retourne toutes les sessions quand aucun filtre n\'est passé', async () => {
    await repo.creerSession({ schoolId: 's1', classId: 'c1', academicPeriodId: 'p1', submittedById: 'u1' });
    await repo.creerSession({ schoolId: 's1', classId: 'c2', academicPeriodId: 'p1', submittedById: 'u1' });

    const result = await repo.listerSessions('s1');

    expect(result).toHaveLength(2);
  });

  it('retourne rien quand le filtre ne correspond à aucune session', async () => {
    await repo.creerSession({ schoolId: 's1', classId: 'c1', academicPeriodId: 'p1', submittedById: 'u1' });

    const result = await repo.listerSessions('s1', { classId: 'c2', status: 'SUBMITTED' });

    expect(result).toHaveLength(0);
  });
});
