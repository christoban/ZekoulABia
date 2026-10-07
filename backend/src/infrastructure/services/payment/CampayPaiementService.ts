/**
 * INFRASTRUCTURE LAYER — Adapter Campay (MTN MoMo + Orange Money Cameroun)
 * Implémente PaiementService.
 * Migré depuis src/services/campay.ts + cache du token ajouté (TTL 55 min).
 */
import type {
  PaiementService,
  InitierPaiementOptions,
  ResultatPaiement,
  DonneeWebhook,
} from '@domain/ports/services/PaiementService';

const BASE_URL = process.env.CAMPAY_BASE_URL ?? 'https://demo.campay.net/api';

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getCampayToken(): Promise<string> {
  if (process.env.CAMPAY_TOKEN) return process.env.CAMPAY_TOKEN;

  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const response = await fetch(`${BASE_URL}/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.CAMPAY_USERNAME,
      password: process.env.CAMPAY_PASSWORD,
    }),
  });

  if (!response.ok) throw new Error("Impossible d'obtenir le token Campay");
  const data = (await response.json()) as { token: string };

  // Tokens Campay durent 60 min — cache 55 min pour éviter l'expiration en vol
  tokenCache = { token: data.token, expiresAt: Date.now() + 55 * 60 * 1000 };
  return data.token;
}

function detecterOperateur(telephone: string): 'MTN' | 'ORANGE' | 'UNKNOWN' {
  const numero = telephone.replace(/\D/g, '');
  const prefixe = parseInt(
    numero.startsWith('237') ? numero.substring(3, 6) : numero.substring(0, 3)
  );

  if (
    (prefixe >= 650 && prefixe <= 654) ||
    (prefixe >= 670 && prefixe <= 679) ||
    (prefixe >= 680 && prefixe <= 689)
  )
    return 'MTN';

  if ((prefixe >= 655 && prefixe <= 659) || (prefixe >= 690 && prefixe <= 699))
    return 'ORANGE';

  return 'UNKNOWN';
}

function normaliserTelephone(telephone: string): string {
  const digits = telephone.replace(/[\s+]/g, '');
  return digits.startsWith('237') ? digits : `237${digits}`;
}

export class CampayPaiementService implements PaiementService {
  async initierPaiement(options: InitierPaiementOptions): Promise<ResultatPaiement> {
    const token = await getCampayToken();
    const telephone = normaliserTelephone(options.telephone);
    const operateur = detecterOperateur(telephone);

    // En environnement de démo / sandbox Campay (demo.campay.net), Campay refuse tout montant > 25 XAF (ER201).
    // On envoie 10 XAF en démo pour permettre aux présentations et tests de réussir sans blocage API,
    // tandis que la base de données ZekoulABia conserve scrupuleusement le montant réel de la facture scolaire.
    const montantEnvoye = (BASE_URL.includes('demo.campay.net') && options.montant > 25)
      ? 10
      : options.montant;

    const response = await fetch(`${BASE_URL}/collect/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${token}`,
      },
      body: JSON.stringify({
        amount: String(montantEnvoye),
        from: telephone,
        description: `[${operateur}] ${options.description}`,
        external_reference: options.referenceInterne,
        redirect_url: `${process.env.CLIENT_URL}/parent/payments`,
      }),
    });

    if (!response.ok) {
      const erreur = await response.text();
      throw new Error(`Campay initierPaiement échoué : ${erreur}`);
    }

    const data = (await response.json()) as {
      reference: string;
      status: string;
    };

    return {
      reference: data.reference,
      statut: data.status === 'SUCCESSFUL' ? 'SUCCESS' : 'PENDING',
    };
  }

  async verifierStatut(campayRef: string): Promise<ResultatPaiement> {
    const token = await getCampayToken();

    const response = await fetch(`${BASE_URL}/transaction/${campayRef}/`, {
      headers: { Authorization: `Token ${token}` },
    });

    if (!response.ok) throw new Error(`Campay verifierStatut échoué : ${campayRef}`);

    const data = (await response.json()) as {
      reference: string;
      status: string;
      operator?: string;
    };

    return {
      reference: data.reference,
      statut: data.status === 'SUCCESSFUL' ? 'SUCCESS' : 'FAILED',
      operateurRef: data.operator,
    };
  }

  async traiterWebhook(donnees: DonneeWebhook): Promise<void> {
    // La logique de traitement est dans TraiterWebhookCampayUseCase.
    // Cet adapter se limite à valider le format Campay.
    if (!donnees.campayRef) {
      throw new Error('Webhook Campay : référence manquante');
    }
  }

  async initierRemboursement(params: {
    campayRef: string;
    montant: number;
    telephone: string;
    motif: string;
  }): Promise<ResultatPaiement> {
    const token = await getCampayToken();
    const telephone = normaliserTelephone(params.telephone);

    const response = await fetch(`${BASE_URL}/transfer/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${token}`,
      },
      body: JSON.stringify({
        amount: String(params.montant),
        to: telephone,
        description: `Remboursement : ${params.motif}`,
        external_reference: params.campayRef,
      }),
    });

    if (!response.ok) throw new Error('Campay initierRemboursement échoué');
    const data = (await response.json()) as { reference: string; status: string };

    return {
      reference: data.reference,
      statut: data.status === 'SUCCESSFUL' ? 'SUCCESS' : 'PENDING',
    };
  }
}
