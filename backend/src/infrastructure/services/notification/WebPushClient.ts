import webpush from "web-push";
import { messageErreur } from '@application/shared/messageErreur';

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:notifications@chri.app";

let vapidConfigured = false;

function ensureVapidConfigured(): void {
  if (vapidConfigured || !isPushConfigured()) return;
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
  vapidConfigured = true;
}

// ─── VÉRIFIER CONFIGURATION PUSH ──────────────────────────────
export const isPushConfigured = () => Boolean(PUBLIC_KEY && PRIVATE_KEY);

// ─── CLÉ PUBLIQUE VAPID (exposée au frontend pour l'abonnement) ─
export const getVapidPublicKey = () => PUBLIC_KEY;

// ─── TYPES ───────────────────────────────────────────────────
export type PushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type SendPushInput = {
  subscription: PushSubscriptionInput;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export type SendPushResult =
  | { status: "sent" }
  | { status: "expired" } // souscription morte (410 Gone / 404) — à supprimer côté appelant
  | { status: "failed"; error: string };

// ─── ENVOYER UNE NOTIFICATION PUSH ────────────────────────────
export const sendPush = async (input: SendPushInput): Promise<SendPushResult> => {
  if (!isPushConfigured()) {
    return { status: "failed", error: "Clés VAPID manquantes" };
  }
  ensureVapidConfigured();

  try {
    await webpush.sendNotification(
      {
        endpoint: input.subscription.endpoint,
        keys: { p256dh: input.subscription.p256dh, auth: input.subscription.auth },
      },
      JSON.stringify({ title: input.title, body: input.body, data: input.data ?? {} }),
    );
    return { status: "sent" };
  } catch (error) {
    // 410 Gone / 404 Not Found = souscription expirée ou révoquée côté navigateur —
    // jamais une erreur à traiter comme un échec transitoire, l'appelant doit la supprimer.
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 410 || statusCode === 404) {
      return { status: "expired" };
    }
    return { status: "failed", error: messageErreur(error) || "Unknown push error" };
  }
};
