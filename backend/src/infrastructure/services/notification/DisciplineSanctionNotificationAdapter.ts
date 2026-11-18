import type { PrismaClient } from '@prisma/client';
import { notifierParentsPushDabord } from './PushFirstNotifier';
import { DISCIPLINE_TYPE_LABELS, notifyDisciplineSms } from '../sms/SmsNotificationService';
import { sendTransactionalEmail } from '../email/EmailService';

export type DisciplineSanctionNotifier = (
  schoolId: string,
  studentId: string,
  studentName: string,
  type: string,
  reason: string,
) => Promise<void>;

/**
 * INFRASTRUCTURE — Notifie les parents (Push, SMS de repli, Email) lorsqu'une
 * sanction disciplinaire est enregistrée via le catalogue Copilot Staff.
 */
export function creerDisciplineSanctionNotifier(prisma: PrismaClient): DisciplineSanctionNotifier {
  return async (schoolId, studentId, studentName, type, reason) => {
    const { phonesSansPush } = await notifierParentsPushDabord({
      schoolId,
      studentId,
      type: 'DISCIPLINE_SANCTION',
      titre: 'Sanction disciplinaire',
      corps: `${studentName} a fait l'objet d'une sanction disciplinaire. Motif : ${reason}.`,
    });
    await notifyDisciplineSms({ schoolId, studentId, studentName, type, reason, phones: phonesSansPush });

    const parentLinks = await prisma.parentStudent.findMany({
      where: { studentProfile: { userId: studentId } },
      include: { parentProfile: { include: { user: { select: { email: true } } } } },
    });
    const parentEmails = [
      ...new Set(parentLinks.map((l) => l.parentProfile?.user?.email).filter((e): e is string => Boolean(e))),
    ];
    const typeLabel = DISCIPLINE_TYPE_LABELS[type]?.fr ?? type;
    for (const email of parentEmails) {
      await sendTransactionalEmail({
        recipientEmail: email,
        subject: `Notification disciplinaire — ${studentName}`,
        html: `<p>Bonjour,</p><p><b>${studentName}</b> a fait l'objet d'une sanction disciplinaire.</p><p><b>Type :</b> ${typeLabel}</p><p><b>Motif :</b> ${reason}</p><p>Merci de contacter l'établissement pour plus d'informations.</p>`,
        text: `Sanction disciplinaire pour ${studentName} : ${typeLabel} — ${reason}`,
        template: 'discipline_notification',
        eventType: 'discipline_notification',
        metadata: { schoolId },
      });
    }
  };
}

