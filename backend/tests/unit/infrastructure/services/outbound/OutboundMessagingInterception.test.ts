import { afterEach, describe, expect, it, mock } from 'bun:test';
import { sendTransactionalEmail } from '../../../../../src/infrastructure/services/email/EmailService.ts';
import {
  definirOutboundMessagingPolicy,
  PlatformSettingsOutboundMessagingPolicy,
} from '../../../../../src/infrastructure/services/outbound/OutboundMessagingPolicy.ts';
import { masquerDestinataire } from '../../../../../src/infrastructure/services/outbound/SuppressedOutboundMessageRecorder.ts';
import { authorizeMaster } from '../../../../../src/infrastructure/http/middlewares/authMultiTenant.ts';
import type { OutboundMessagingPolicy } from '@domain/ports/services/OutboundMessagingPolicy';
import type { Request, Response } from 'express';

// Restaure le module réel : le test broadcast (tests/integration/http/communicationsBroadcast)
// mocke sendSMS via mock.module, ce qui fuit sur tout le process bun test. Le suffixe ?reel
// contourne le registre de modules (déjà mocké) pour évaluer une copie fraîche et réelle,
// puis réinstalle les implémentations réelles sur le spécificateur canonique — quel que soit
// l'ordre d'exécution des fichiers.
// @ts-expect-error — suffixe ?reel volontairement absent des déclarations : il sert à contourner le registre de modules bun.
const smsServiceReel = await import('../../../../../src/infrastructure/services/sms/SmsService.ts?reel');
mock.module('../../../../../src/infrastructure/services/sms/SmsService.ts', () => ({ ...smsServiceReel }));

const { sendBulkSMS, sendSMS, sendSms } = await import('../../../../../src/infrastructure/services/sms/SmsService.ts');

class PolitiqueDesactivee implements OutboundMessagingPolicy {
  async estActive(): Promise<boolean> {
    return false;
  }
}

class PolitiqueParEcole implements OutboundMessagingPolicy {
  constructor(private readonly ecolesEnModeTest: Set<string>) {}
  async estActive(contexte?: { schoolId?: string | null }): Promise<boolean> {
    if (contexte?.schoolId && this.ecolesEnModeTest.has(contexte.schoolId)) {
      return false;
    }
    return true;
  }
}

const creerReponseFactice = () => {
  const reponse = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      reponse.statusCode = code;
      return reponse;
    },
    json(corps: unknown) {
      reponse.body = corps;
      return reponse;
    },
  };
  return reponse;
};

describe('Interception des envois sortants en mode test', () => {
  afterEach(() => {
    definirOutboundMessagingPolicy(new PlatformSettingsOutboundMessagingPolicy());
  });

  it('sendSMS : rien n\'est envoyé et un succès factice marqué "suppressed" est renvoyé', async () => {
    definirOutboundMessagingPolicy(new PolitiqueDesactivee());
    const resultat = await sendSMS('+237690123456', 'message de test');
    expect(resultat).toEqual({ success: true, msgId: 'suppressed' });
  });

  it('sendSms (variante hexagonale) : renvoie "sent" marqué "suppressed"', async () => {
    definirOutboundMessagingPolicy(new PolitiqueDesactivee());
    const resultat = await sendSms({ to: '+237690123456', message: 'message de test' });
    expect(resultat).toEqual({ status: 'sent', providerMessageId: 'suppressed' });
  });

  it('sendBulkSMS : renvoie un lot entièrement "réussi" sans aucun envoi', async () => {
    definirOutboundMessagingPolicy(new PolitiqueDesactivee());
    const resultat = await sendBulkSMS(['690123456', '677654321'], 'message de test');
    expect(resultat).toEqual({ success: 2, failed: 0 });
  });

  it('sendTransactionalEmail : renvoie "sent" marqué "suppressed" avant tout provider', async () => {
    definirOutboundMessagingPolicy(new PolitiqueDesactivee());
    const resultat = await sendTransactionalEmail({
      recipientEmail: 'eleve-fictif@example.com',
      subject: 'Bulletin disponible',
      html: '<p>Bulletin</p>',
      template: 'bulletin',
      eventType: 'report_card_available',
    });
    expect(resultat).toEqual({ status: 'sent', messageId: 'suppressed' });
  });

  it('les emails de sécurité du compte Master restent exemptés de la suppression', async () => {
    definirOutboundMessagingPolicy(new PolitiqueDesactivee());
    const resendOriginal = process.env.RESEND_API_KEY;
    const smtpHostOriginal = process.env.SMTP_HOST;
    process.env.RESEND_API_KEY = '';
    process.env.SMTP_HOST = '';
    try {
      const resultat = await sendTransactionalEmail({
        recipientEmail: 'superadmin@example.com',
        subject: 'Code de vérification',
        html: '<p>123456</p>',
        template: 'master-login-otp',
        eventType: 'master_login_otp',
      });
      // Exempt (master security) : même avec la politique de suppression désactivée, l'email
      // exempté ne doit PAS être intercepté — il atteint la tentative d'envoi réel (bloquée ici
      // par l'absence de provider en test) : preuve qu'il n'est pas supprimé.
      expect(resultat.status).toBe('failed');
      expect(resultat.error).toContain('Aucun provider email configuré');
    } finally {
      process.env.RESEND_API_KEY = resendOriginal;
      process.env.SMTP_HOST = smtpHostOriginal;
    }
  });

  it('mode test par établissement : supprime uniquement les envois de l’école en mode test', async () => {
    definirOutboundMessagingPolicy(new PolitiqueParEcole(new Set(['ecole-demo'])));
    const smsDemo = await sendSMS('+237690123456', 'message demo', 'ecole-demo');
    expect(smsDemo).toEqual({ success: true, msgId: 'suppressed' });

    const emailDemo = await sendTransactionalEmail({
      recipientEmail: 'prof@demo.cm',
      subject: 'Invitation',
      html: '<p>Bienvenue</p>',
      template: 'invite',
      eventType: 'user_invite',
      metadata: { schoolId: 'ecole-demo' },
    });
    expect(emailDemo).toEqual({ status: 'sent', messageId: 'suppressed' });
  });
});

describe('Masquage des destinataires', () => {
  it('masque une adresse email en conservant le domaine', () => {
    expect(masquerDestinataire('abdel@example.com')).toBe('ab***@example.com');
  });

  it('masque un numéro de téléphone en conservant le début et la fin', () => {
    expect(masquerDestinataire('237690123456')).toBe('237***56');
  });

  it('retourne *** pour une valeur trop courte', () => {
    expect(masquerDestinataire('123')).toBe('***');
  });
});

describe('RBAC des routes de réglages plateforme', () => {
  const middleware = authorizeMaster(['super_admin']);

  it('refuse un platform_admin sur une action réservée au super_admin (403)', () => {
    const requete = { masterUser: { id: 'm1', email: 'pa@x.com', role: 'platform_admin' } } as unknown as Request;
    const reponse = creerReponseFactice();
    const suivant = () => {
      throw new Error('next() ne doit pas être appelé');
    };
    middleware(requete, reponse as unknown as Response, suivant);
    expect(reponse.statusCode).toBe(403);
  });

  it('laisse passer un super_admin', () => {
    const requete = { masterUser: { id: 'm1', email: 'sa@x.com', role: 'super_admin' } } as unknown as Request;
    let appele = false;
    middleware(requete, creerReponseFactice() as unknown as Response, () => {
      appele = true;
    });
    expect(appele).toBe(true);
  });
});
