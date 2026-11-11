/**
 * Email types extracted from legacy models
 * Now used only for type checking with Prisma
 */

export type EmailEventType =
  | "report_card_available"
  | "report_card_sent"
  | "payment_reminder"
  | "grade_reminder_48h"
  | "grade_reminder_72h"
  | "school_invite"
  | "master_login_otp"
  | "master_password_change_otp"
  | "master_team_invite"
  | "master_team_password_reset"
  | "group_login_otp"
  | "user_login_otp"
  | "contact_request"
  | "school_approved"
  | "school_pending_notification"
  | "demo_request"
  | "user_import"
  | "user_invite"
  | "password_reset"
  | "payment_receipt"
  | "discipline_notification"
  | "absence_alert"
  | "anonymat_team_invite"
  | "ai_security_suspicious_pattern";

export type EmailStatus = "sent" | "failed";

/**
 * Types d'événements pour lesquels le destinataire a déjà un compte actif — migrés vers
 * push-d'abord (avec repli email automatique si aucune souscription active) dans le cadre
 * de PLAN_NOTIFICATIONS_PUSH.md Phase B. Les types absents de cette liste (invitations,
 * sécurité OTP/reset, formulaires marketing) restent exclusivement email — voir §13.2 du
 * plan pour la justification de chaque exclusion, notamment les 3 événements de sécurité
 * qui ne doivent JAMAIS y être ajoutés même par erreur de copier-coller.
 */
export const PUSH_MIGRATED_EVENT_TYPES: ReadonlySet<EmailEventType> = new Set([
  "report_card_available",
  "payment_reminder",
  "payment_receipt",
  "grade_reminder_48h",
  "grade_reminder_72h",
  "absence_alert",
  "discipline_notification",
]);
