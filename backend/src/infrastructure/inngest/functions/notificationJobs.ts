import { inngest } from "../client/index.ts";
import { prisma } from "../../../config/prisma.ts";
import { getParentContacts } from "../../services/sms/SmsNotificationService.ts";
import { sendSMS } from "../../services/sms/SmsService.ts";

/**
 * Job Inngest : escalation SMS pour les notifications URGENT.
 *
 * Quand une notification URGENT est envoyée et que l'utilisateur n'a PAS de push actif,
 * on planifie cet job. Si après DELAI_ESCALADE le champ deliveredAt est toujours null,
 * on déclenche un SMS au parent (ou au destinataire lui-même si pas de parent).
 *
 * Annulé si deliveredAt est renseigné avant l'échéance (push reçu entre-temps).
 */
const DELAI_ESCALADE_MS = 15 * 60 * 1000; // 15 minutes

export const escaladerNotificationUrgente = inngest.createFunction(
  {
    id: "Escalader-Notification-Urgente",
    triggers: [{ event: "notification/escalade-urgent" }],
  },
  async ({ event, step }) => {
    const { notificationId, userId, schoolId } = event.data as {
      notificationId: string;
      userId: string;
      schoolId: string;
    };

    // Attendre la fenêtre d'escalade
    await step.sleep("attente-escalade", DELAI_ESCALADE_MS);

    // Vérifier si le push a été livré entre-temps
    const delivered = await step.run("verifier-deliveredAt", async () => {
      const notif = await prisma.notification.findUnique({
        where: { id: notificationId },
        select: { deliveredAt: true },
      });
      return notif?.deliveredAt !== null && notif?.deliveredAt !== undefined;
    });

    if (delivered) {
      return { escalade: false, raison: "push livré avant échéance" };
    }

    // Push non livré → envoyer SMS
    const smsSent = await step.run("envoyer-sms-escalade", async () => {
      const contacts = await getParentContacts(userId);
      if (contacts.length === 0) return false;

      // Récupérer le titre/body de la notification originale
      const notif = await prisma.notification.findUnique({
        where: { id: notificationId },
        select: { title: true, body: true },
      });
      if (!notif) return false;

      for (const contact of contacts) {
        if (contact.phone) {
          await sendSMS(contact.phone, `${notif.title} — ${notif.body}`);
        }
      }
      return true;
    });

    return { escalade: true, smsSent };
  }
);