import axios from "axios";
import { messageErreur } from '@application/shared/messageErreur';

const BASE_URL = process.env.TECHSOFT_BASE_URL || "https://app.techsoft-sms.com/api/http";
const API_KEY = process.env.TECHSOFT_API_KEY || "";
const SENDER_ID = process.env.TECHSOFT_SENDER_ID || "TechSoft";

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[\s+]/g, "");
  return digits.startsWith("237") ? digits : `237${digits}`;
}

// ─── ENVOYER UN SMS ──────────────────────────────────────────
export const sendSMS = async (to: string, message: string): Promise<{ success: boolean; msgId?: string; error?: string }> => {
  try {
    const response = await axios.post(`${BASE_URL}/sms/send`, {
      api_token: API_KEY,
      recipient: normalizePhone(to),
      sender_id: SENDER_ID,
      type: "plain",
      message,
    }, {
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
    });

    const data = response.data;
    if (data.status === "success") {
      const uid = Array.isArray(data.data) ? data.data[0]?.uid : data.data?.uid;
      return { success: true, msgId: uid };
    }
    return { success: false, error: data.message || "Erreur inconnue" };
  } catch (error) {
    return { success: false, error: messageErreur(error) };
  }
};

// ─── ENVOYER SMS EN MASSE (max 100 numéros par lot) ──────────
export const sendBulkSMS = async (numbers: string[], message: string): Promise<{ success: number; failed: number }> => {
  const chunks: string[][] = [];
  for (let i = 0; i < numbers.length; i += 100) {
    chunks.push(numbers.slice(i, i + 100));
  }

  let success = 0;
  let failed = 0;

  for (const chunk of chunks) {
    const recipient = chunk.map(normalizePhone).join(",");

    try {
      const response = await axios.post(`${BASE_URL}/sms/send`, {
        api_token: API_KEY,
        recipient,
        sender_id: SENDER_ID,
        type: "plain",
        message,
      }, {
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
      });

      const data = response.data;
      if (data.status === "success") {
        const sent = Array.isArray(data.data) ? data.data.length : 1;
        success += sent;
      } else {
        failed += chunk.length;
      }
    } catch {
      failed += chunk.length;
    }
  }

  return { success, failed };
};

// ─── TYPES ───────────────────────────────────────────────────────────────────
type SendSmsInput = {
  to: string;
  message: string;
};

type SendSmsResult = {
  status: "sent" | "failed";
  providerMessageId?: string;
  error?: string;
};

// ─── VÉRIFIER CONFIGURATION SMS ──────────────────────────────
export const isSmsConfigured = () => Boolean(API_KEY);

// ─── ENVOYER SMS (API secondaire compatible hexagonal) ───────
export const sendSms = async (input: SendSmsInput): Promise<SendSmsResult> => {
  if (!isSmsConfigured()) {
    return { status: "failed", error: "SMS API key is missing" };
  }

  try {
    const response = await axios.post(`${BASE_URL}/sms/send`, {
      api_token: API_KEY,
      recipient: normalizePhone(input.to),
      sender_id: SENDER_ID,
      type: "plain",
      message: input.message,
    }, {
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
    });

    const data = response.data;

    if (data.status === "success") {
      const uid = Array.isArray(data.data) ? data.data[0]?.uid : data.data?.uid;
      return { status: "sent", providerMessageId: uid ? String(uid) : undefined };
    }

    return {
      status: "failed",
      error: data.message || "Echec d'envoi TechSoft",
    };
  } catch (error) {
    return { status: "failed", error: messageErreur(error) || "Unknown SMS error" };
  }
};

// ─── STATUT DE LIVRAISON SMS ─────────────────────────────────
export const getSmsDeliveryStatus = async (providerMessageId: string) => {
  if (!isSmsConfigured()) {
    return { status: "failed", error: "SMS API key is missing" };
  }

  try {
    // GET /sms/{uid} — api_token envoyé dans le corps JSON selon la doc TechSoft
    const response = await axios.get(`${BASE_URL}/sms/${providerMessageId}`, {
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      data: { api_token: API_KEY },
    });

    const data = response.data;

    if (data.status === "success") {
      return {
        status: "ok",
        providerStatus: data.data?.status || data.data?.delivery_status,
        raw: data,
      };
    }

    return {
      status: "failed",
      error: data.message || "Erreur récupération statut",
      raw: data,
    };
  } catch (error) {
    return {
      status: "failed",
      error: messageErreur(error) || "Unknown SMS status error",
    };
  }
};
