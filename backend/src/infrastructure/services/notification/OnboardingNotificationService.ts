/**
 * Service de notifications du module Onboarding Auto-Service Élèves, factorisé pour être
 * appelé depuis plusieurs contrôleurs : EleveOnboardingController et EntranceExamController.
 * Fire-and-forget, jamais throw — les envois ponctuels sont déclenchés par une action utilisateur.
 */
import type { PrismaClient } from '@prisma/client';
import type { CredentialsNotificationPort } from '@domain/ports/services/CredentialsNotificationPort';
import { sendTransactionalEmail } from '../email/EmailService.ts';
import {
  notifyOnboardingLinkSms,
} from '../sms/SmsNotificationService.ts';
import {
  buildOnboardingLinkTemplate,
} from '../email/templates/emailTemplates';
import { resolveFrontendUrl } from '../../config/EnvAppConfig.ts';

function frontendUrl(): string {
  return resolveFrontendUrl();
}

/**
 * Envoi fire-and-forget du lien créé (email si contactEmail, SMS si contactTelephone), pour
 * le contact élève ET, si distinct (LES_DEUX avec deux coordonnées séparées), le contact parent.
 */
export async function notifierOnboardingLienCree(
  prisma: PrismaClient,
  schoolId: string,
  nomProvisoire: string,
  result: {
    token: string;
    tokenExpiresAt: Date;
    contactEmail: string | null;
    contactTelephone: string | null;
    parentContactEmail?: string | null;
    parentContactTelephone?: string | null;
  },
): Promise<void> {
  try {
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true },
    });
    await notifierOnboardingLienCreeAvecEcole(schoolId, school?.name ?? null, nomProvisoire, result);
  } catch (err: unknown) {
    console.error('[Onboarding] Échec notification lien créé:', err instanceof Error ? err.message : String(err));
  }
}

/** Variante sans Prisma (controller hexagonal) — schoolName résolu en amont via SchoolRepository. */
export async function notifierOnboardingLienCreeAvecEcole(
  schoolId: string,
  schoolName: string | null,
  nomProvisoire: string,
  result: {
    token: string;
    tokenExpiresAt: Date;
    contactEmail: string | null;
    contactTelephone: string | null;
    parentContactEmail?: string | null;
    parentContactTelephone?: string | null;
  },
): Promise<void> {
  try {
    const schoolNameResolved = schoolName ?? 'votre établissement';
    const formUrl = `${frontendUrl()}/eleve-onboarding/${result.token}`;
    const expiryDays = Math.max(
      1,
      Math.round(
        (result.tokenExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
      ),
    );

    const destinataires = [
      { email: result.contactEmail, phone: result.contactTelephone },
      { email: result.parentContactEmail ?? null, phone: result.parentContactTelephone ?? null },
    ];

    for (const dest of destinataires) {
      if (dest.email) {
        const tpl = buildOnboardingLinkTemplate({ nomProvisoire, schoolName: schoolNameResolved, formUrl, expiryDays });
        await sendTransactionalEmail({
          recipientEmail: dest.email,
          subject: tpl.subject,
          template: 'user_invite',
          eventType: 'user_invite',
          html: tpl.html,
          text: tpl.text,
          metadata: { schoolId },
        }).catch((err: unknown) =>
          console.error('[Email] Échec envoi lien onboarding:', err instanceof Error ? err.message : String(err)),
        );
      }
      if (dest.phone) {
        void notifyOnboardingLinkSms({ schoolId, nomProvisoire, schoolName: schoolNameResolved, phone: dest.phone, expiryDays, formUrl });
      }
    }
  } catch (err: unknown) {
    console.error('[Onboarding] Échec notification lien créé:', err instanceof Error ? err.message : String(err));
  }
}

/** Envoi fire-and-forget des identifiants temporaires pour chaque compte nouvellement créé. */
export async function notifierOnboardingValidation(
  prisma: PrismaClient,
  schoolId: string,
  result: {
    comptesCrees: {
      role: 'STUDENT' | 'PARENT';
      temporaryPassword: string | null;
      contactEmail: string | null;
      contactTelephone: string | null;
      compteExistant: boolean;
      accessMode?: 'FULL_ACCESS' | 'SMS_ONLY';
      dispositifOS?: string | null;
    }[];
  },
  credentialsNotifier: CredentialsNotificationPort,
): Promise<void> {
  try {
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, subdomain: true },
    });
    await notifierOnboardingValidationAvecEcole(schoolId, school?.name ?? null, school?.subdomain ?? null, result, credentialsNotifier);
  } catch (err: unknown) {
    console.error('[Onboarding] Échec notification validation:', err instanceof Error ? err.message : String(err));
  }
}

/** Variante sans Prisma (controller hexagonal) — schoolName/subdomain résolus en amont via SchoolRepository. */
export async function notifierOnboardingValidationAvecEcole(
  schoolId: string,
  schoolName: string | null,
  _subdomain: string | null,
  result: {
    comptesCrees: {
      role: 'STUDENT' | 'PARENT';
      temporaryPassword: string | null;
      contactEmail: string | null;
      contactTelephone: string | null;
      compteExistant: boolean;
      accessMode?: 'FULL_ACCESS' | 'SMS_ONLY';
      dispositifOS?: string | null;
    }[];
  },
  credentialsNotifier: CredentialsNotificationPort,
): Promise<void> {
  try {
    const schoolNameResolved = schoolName ?? 'votre établissement';

    for (const compte of result.comptesCrees) {
      if (compte.compteExistant) continue;

      if (!compte.temporaryPassword) continue;
      const roleLabel = compte.role === 'PARENT' ? 'Parent' : 'Élève';
      const loginIdentifier = compte.contactEmail ?? compte.contactTelephone ?? '';
      try {
        await credentialsNotifier.sendCredentials({
          schoolId,
          email: compte.contactEmail,
          phone: compte.contactTelephone,
          os: compte.dispositifOS,
          temporaryPassword: compte.temporaryPassword,
          roleLabel,
          loginIdentifier,
          schoolName: schoolNameResolved,
        });
      } catch (error) {
        console.error('[Credentials] Échec envoi onboarding:', error instanceof Error ? error.message : String(error));
      }
    }
  } catch (err: unknown) {
    console.error('[Onboarding] Échec notification validation:', err instanceof Error ? err.message : String(err));
  }
}
