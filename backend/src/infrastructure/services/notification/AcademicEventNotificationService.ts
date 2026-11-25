/**
 * Notification en masse pour un événement académique (ouverture / rappel de clôture) — cible
 * tous les utilisateurs actifs de l'établissement dont le rôle figure dans `targetRoles`,
 * contrairement aux alertes de santé scolaire (PushFirstNotifier) qui ciblent la famille d'UN
 * élève précis. Cloche in-app systématique + push best-effort, pas de SMS ici (événements
 * informatifs, pas d'urgence justifiant le coût d'un SMS).
 */
import type { PrismaClient, UserRole } from '@prisma/client';
import { SocketNotificationService } from './SocketNotificationService.ts';
import { notifierUtilisateurPush } from './PushNotificationService.ts';

export async function notifierEvenementAcademique(
  prisma: PrismaClient,
  schoolId: string,
  targetRoles: string[],
  titre: string,
  corps: string,
): Promise<void> {
  const destinataires = await prisma.user.findMany({
    where: { schoolId, role: { in: targetRoles as UserRole[] }, isActive: true },
    select: { id: true },
  });
  const socketService = new SocketNotificationService();
  for (const d of destinataires) {
    await socketService
      .envoyer({ schoolId, userId: d.id, type: 'ACADEMIC_EVENT', titre, corps, urgency: 'NORMAL' })
      .catch(() => {});
    await notifierUtilisateurPush({ userId: d.id, title: titre, body: corps }).catch(() => {});
  }
}
