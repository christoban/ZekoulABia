import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  EnvAppConfig,
  resolveFrontendUrl,
  resolveMasterEntryUrl,
  resolveMasterLoginUrl,
  resolveMasterDashboardUrl,
} from '@infrastructure/config/EnvAppConfig';

describe('EnvAppConfig — Résolution d’URLs 12-Factor App & Sas Master', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.FRONTEND_URL;
    delete process.env.CLIENT_URL;
    delete process.env.APP_URL;
    delete process.env.MASTER_ENTRY_URL;
    delete process.env.MASTER_LOGIN_URL;
    delete process.env.MASTER_SECRET_PATH;
    delete process.env.MASTER_ENTRY_PATH;
    delete process.env.MASTER_LOGIN_PATH;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('fournit les fallbacks de développement local par défaut avec le sas unique /master-secret-entry', () => {
    const config = new EnvAppConfig();
    expect(config.frontendBaseUrl()).toBe('http://localhost:3000');
    // Le login comme le dashboard mènent au sas unique /master-secret-entry
    expect(config.masterEntryUrl()).toBe('http://localhost:3000/master-secret-entry');
    expect(config.masterLoginUrl()).toBe('http://localhost:3000/master-secret-entry');
    expect(config.masterDashboardUrl()).toBe('http://localhost:3000/master-secret-entry');
  });

  it('résout correctement l’URL de production configurée par FRONTEND_URL', () => {
    process.env.FRONTEND_URL = 'https://zekoulabia.chri.app';

    const config = new EnvAppConfig();
    expect(config.frontendBaseUrl()).toBe('https://zekoulabia.chri.app');
    expect(config.masterEntryUrl()).toBe('https://zekoulabia.chri.app/master-secret-entry');
    expect(config.masterLoginUrl()).toBe('https://zekoulabia.chri.app/master-secret-entry');
    expect(config.masterDashboardUrl()).toBe('https://zekoulabia.chri.app/master-secret-entry');
  });

  it('permet de personnaliser le chemin du sas via MASTER_SECRET_PATH (canonique) et les alias', () => {
    process.env.FRONTEND_URL = 'https://zekoulabia.chri.app';
    process.env.MASTER_SECRET_PATH = '/porte-secrete-master';
    process.env.MASTER_ENTRY_PATH = '/alias-ignore';

    const config = new EnvAppConfig();
    expect(config.masterEntryUrl()).toBe('https://zekoulabia.chri.app/porte-secrete-master');
    expect(config.masterLoginUrl()).toBe('https://zekoulabia.chri.app/porte-secrete-master');
    expect(config.masterDashboardUrl()).toBe('https://zekoulabia.chri.app/porte-secrete-master');

    delete process.env.MASTER_SECRET_PATH;
    process.env.MASTER_ENTRY_PATH = '/custom-sas-entry';
    expect(config.masterEntryUrl()).toBe('https://zekoulabia.chri.app/custom-sas-entry');
  });

  it('donne priorité à MASTER_ENTRY_URL ou MASTER_LOGIN_URL si explicitement fournie', () => {
    process.env.FRONTEND_URL = 'https://zekoulabia.chri.app';
    process.env.MASTER_ENTRY_URL = 'https://hub.zekoulabia.chri.app/master-secret-entry';

    const config = new EnvAppConfig();
    expect(config.masterEntryUrl()).toBe('https://hub.zekoulabia.chri.app/master-secret-entry');
    expect(config.masterLoginUrl()).toBe('https://hub.zekoulabia.chri.app/master-secret-entry');
    expect(config.masterDashboardUrl()).toBe('https://hub.zekoulabia.chri.app/master-secret-entry');
  });

  it('les fonctions helpers exportées retournent les mêmes valeurs cohérentes', () => {
    process.env.FRONTEND_URL = 'https://zekoulabia.chri.app';

    expect(resolveFrontendUrl()).toBe('https://zekoulabia.chri.app');
    expect(resolveMasterEntryUrl()).toBe('https://zekoulabia.chri.app/master-secret-entry');
    expect(resolveMasterLoginUrl()).toBe('https://zekoulabia.chri.app/master-secret-entry');
    expect(resolveMasterDashboardUrl()).toBe('https://zekoulabia.chri.app/master-secret-entry');
  });
});
