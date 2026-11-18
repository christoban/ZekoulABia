import axios from "axios";
import { resolveFrontendUrl } from '../../config/EnvAppConfig.ts';

const CAMPAY_BASE_URL = process.env.CAMPAY_BASE_URL || "https://demo.campay.net/api";
const CAMPAY_USERNAME = process.env.CAMPAY_USERNAME || "";
const CAMPAY_PASSWORD = process.env.CAMPAY_PASSWORD || "";
const CAMPAY_TOKEN = process.env.CAMPAY_TOKEN || "";

export const getCampayToken = async (): Promise<string> => {
  if (CAMPAY_TOKEN) return CAMPAY_TOKEN;

  const response = await axios.post(`${CAMPAY_BASE_URL}/token/`, {
    username: CAMPAY_USERNAME,
    password: CAMPAY_PASSWORD,
  });
  return response.data.token;
};

export const initiatePayment = async (params: {
  amount: number;
  from: string;
  description: string;
  externalReference: string;
  redirectUrl?: string;
}) => {
  const token = await getCampayToken();

  const response = await axios.post(
    `${CAMPAY_BASE_URL}/collect/`,
    {
      amount: String(params.amount),
      from: params.from,
      description: params.description,
      external_reference: params.externalReference,
      redirect_url: params.redirectUrl || `${resolveFrontendUrl()}/parent/payments`,
    },
    {
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data as {
    reference: string;
    ussd_code?: string;
    operator: string;
    status: string;
  };
};

export const checkPaymentStatus = async (reference: string) => {
  const token = await getCampayToken();

  const response = await axios.get(`${CAMPAY_BASE_URL}/transaction/${reference}/`, {
    headers: { Authorization: `Token ${token}` },
  });

  return response.data as {
    reference: string;
    status: string;
    amount: number;
    operator: string;
    phone_number: string;
  };
};

export const detectOperator = (phone: string): "MTN" | "ORANGE" | "UNKNOWN" => {
  const normalized = phone.replace(/\s+/g, "").replace(/^\+/, "");
  const digits = normalized.startsWith("237") ? normalized.slice(3) : normalized;
  const prefix3 = digits.slice(0, 3);

  const mtnPrefixes = [
    "650", "651", "652", "653", "654",
    "670", "671", "672", "673", "674", "675", "676", "677", "678", "679",
    "680", "681", "682", "683", "684", "685", "686", "687", "688", "689",
  ];

  const orangePrefixes = [
    "655", "656", "657", "658", "659",
    "690", "691", "692", "693", "694", "695", "696", "697", "698", "699",
  ];

  if (mtnPrefixes.includes(prefix3)) return "MTN";
  if (orangePrefixes.includes(prefix3)) return "ORANGE";
  return "UNKNOWN";
};
