import { describe, expect, test } from 'bun:test';
import type { EmailService, EnvoiEmailOptions } from '../../../../src/domain/ports/services/EmailService';
import { CredentialsNotificationService } from '../../../../src/infrastructure/services/notification/CredentialsNotificationService';

class FakeEmailService implements EmailService {
  dernierEnvoi: EnvoiEmailOptions | null = null;

  async envoyer(options: EnvoiEmailOptions): Promise<void> {
    this.dernierEnvoi = options;
  }

  async envoyerAvecPDF(): Promise<void> {}
}

const params = {
  schoolId: 'school-1',
  email: 'parent@test.cm',
  phone: '690000000',
  temporaryPassword: 'Ab2!xyz9',
  roleLabel: 'Parent',
  loginIdentifier: 'parent@test.cm',
};

describe('CredentialsNotificationService', () => {
  test('privilégie email pour Android/iOS ou OS inconnu', async () => {
    const email = new FakeEmailService();
    const service = new CredentialsNotificationService(email);

    expect(await service.sendCredentials({ ...params, os: 'ANDROID' })).toBe('EMAIL');
    expect(email.dernierEnvoi?.destinataire).toBe(params.email);
    expect(email.dernierEnvoi?.contenuTexte).toContain(params.temporaryPassword);
    expect(await service.sendCredentials({ ...params, os: null })).toBe('EMAIL');
  });

  test('retourne activation physique sans email ni téléphone', async () => {
    const service = new CredentialsNotificationService(new FakeEmailService());

    expect(await service.sendCredentials({ ...params, email: null, phone: null })).toBe('PHYSICAL');
  });
});