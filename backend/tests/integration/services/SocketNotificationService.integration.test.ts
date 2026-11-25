/**
 * Test d'intégration — SocketNotificationService, touché par le retrait du cast
 * `(prisma as any)` sur 4 sites : la table de conversion DomainNotificationType→NotificationType
 * (colonne enum), `metadata` (colonne JSON), le filtre `role` (enum UserRole) et le
 * `createMany` de envoyerAuRole. Vérifie sur la vraie base que les deux écritures (`envoyer`
 * et `envoyerAuRole`) fonctionnent toujours une fois les casts remplacés par un typage précis.
 *
 * Le service utilise en interne le client Prisma singleton (`@infrastructure/persistence/
 * prisma/prisma.client`), pas `prismaTest` — mais les deux pointent la même base tant que
 * DATABASE_URL (chargé via --env-file .env.test) cible zekoulabia_test, donc les assertions
 * via prismaTest sont valides. `getIO()` renvoie null en test (aucun serveur socket.io démarré
 * ici) — le service dégrade proprement (persiste en base, saute juste l'émission live).
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { SocketNotificationService } from '../../../src/infrastructure/services/notification/SocketNotificationService.ts';
import { prismaTest } from '../../helpers/prismaTestClient.ts';
import { creerEcoleTest, creerUtilisateurTest, nettoyerEcole } from '../../helpers/dbFixtures.ts';

let schoolId: string;
let userId: string;
const service = new SocketNotificationService();

beforeAll(async () => {
  const school = await creerEcoleTest(prismaTest, 'socketNotif');
  schoolId = school.id;
  const user = await creerUtilisateurTest(prismaTest, schoolId, { role: 'TEACHER' });
  userId = user.id;
});

afterAll(async () => {
  await prismaTest.notification.deleteMany({ where: { schoolId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

describe('SocketNotificationService — écritures Notification (enum type, JSON metadata, enum role) sans cast', () => {
  it("envoyer() persiste avec le NotificationType Prisma converti et le metadata JSON", async () => {
    await service.envoyer({
      schoolId, userId,
      type: 'PAYMENT_REMINDER',
      titre: 'Rappel de paiement',
      corps: 'Solde restant : 15 000 XAF',
      canal: 'IN_APP',
      metadata: { invoiceId: 'inv-123', amount: 15000 },
    });

    const notif = await prismaTest.notification.findFirst({ where: { schoolId, userId, title: 'Rappel de paiement' } });
    expect(notif).not.toBeNull();
    expect(notif?.type).toBe('FINANCIAL');
    expect(notif?.metadata).toEqual({ invoiceId: 'inv-123', amount: 15000 });
    expect(notif?.channel).toBe('IN_APP');
  });

  it("envoyerAuRole() persiste une Notification par destinataire du rôle, avec l'enum role filtré correctement", async () => {
    const autreTeacher = await creerUtilisateurTest(prismaTest, schoolId, { role: 'TEACHER', suffix: 'socket-role-2' });
    const parent = await creerUtilisateurTest(prismaTest, schoolId, { role: 'PARENT', suffix: 'socket-role-parent' });

    await service.envoyerAuRole({
      schoolId,
      role: 'TEACHER',
      type: 'ACADEMIC_EVENT',
      titre: 'Réunion pédagogique',
      corps: 'Réunion vendredi à 15h',
      canal: 'IN_APP',
    });

    const notifsTeachers = await prismaTest.notification.findMany({ where: { schoolId, title: 'Réunion pédagogique' } });
    const destinataires = notifsTeachers.map(n => n.userId).sort();
    expect(destinataires).toEqual([userId, autreTeacher.id].sort());
    expect(notifsTeachers.every(n => n.type === 'ACADEMIC')).toBe(true);

    const notifParent = await prismaTest.notification.findFirst({ where: { schoolId, userId: parent.id, title: 'Réunion pédagogique' } });
    expect(notifParent).toBeNull();
  });
});
