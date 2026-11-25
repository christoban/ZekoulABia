/**
 * DOMAIN LAYER — Port Service SMS
 * Implémenté par TechSoft Web Agency API (Cameroun).
 */
export interface EnvoiSmsOptions {
  destinataire: string; // Numéro au format +237XXXXXXXXX
  contenu: string;      // Max 160 caractères pour 1 SMS
  schoolId: string;     // Pour le logging
}

export interface SmsService {
  envoyer(options: EnvoiSmsOptions): Promise<void>;
  envoyerEnMasse(options: EnvoiSmsOptions[]): Promise<{
    envoyes: number;
    echoues: number;
  }>;
}
