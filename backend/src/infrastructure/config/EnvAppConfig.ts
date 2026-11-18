import type { AppConfigPort } from '@domain/ports/services/AppConfigPort';

/**
 * Résolution des URLs de la plateforme (12-Factor App).
 *
 * Variables prises en compte pour le frontend :
 * 1. FRONTEND_URL (recommandé en production, ex: https://zekoulabia.chri.app)
 * 2. CLIENT_URL (synonyme historique)
 * 3. APP_URL (standard cloud / conteneurs)
 * 4. Fallback local : http://localhost:3000
 *
 * Point d'entrée unique sécurisé Master (Hub de Contrôle) :
 * L'accès au Master (connexion ou dashboard) passe TOUJOURS par le sas d'aiguillage
 * géré côté Next.js par `frontend/src/proxy.ts` via `MASTER_SECRET_PATH`
 * (ex: /master-secret-entry). Le proxy vérifie le cookie `master_jwt`, pose
 * `master_access=1` si besoin et redirige vers `/master/dashboard` ou `/master/login`.
 *
 * Variables de configuration pour l'entrée Master :
 * 1. MASTER_ENTRY_URL ou MASTER_LOGIN_URL (URL absolue complète prioritaire)
 * 2. MASTER_SECRET_PATH (variable canonique partagée avec frontend/src/proxy.ts,
 *    par défaut : /master-secret-entry) — avec alias MASTER_ENTRY_PATH / MASTER_LOGIN_PATH
 */
export class EnvAppConfig implements AppConfigPort {
  frontendBaseUrl(): string {
    const raw =
      process.env.FRONTEND_URL ||
      process.env.CLIENT_URL ||
      process.env.APP_URL ||
      'http://localhost:3000';
    return raw.trim().replace(/\/+$/, '');
  }

  masterEntryUrl(): string {
    const customUrl = process.env.MASTER_ENTRY_URL || process.env.MASTER_LOGIN_URL;
    if (customUrl?.trim()) {
      return customUrl.trim().replace(/\/+$/, '');
    }
    const path = (
      process.env.MASTER_SECRET_PATH ||
      process.env.MASTER_ENTRY_PATH ||
      process.env.MASTER_LOGIN_PATH ||
      '/master-secret-entry'
    ).trim();
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.frontendBaseUrl()}${cleanPath}`;
  }

  masterLoginUrl(): string {
    return this.masterEntryUrl();
  }

  masterDashboardUrl(): string {
    return this.masterEntryUrl();
  }
}

export const envAppConfig = new EnvAppConfig();

export const resolveFrontendUrl = (): string => envAppConfig.frontendBaseUrl();
export const resolveMasterEntryUrl = (): string => envAppConfig.masterEntryUrl();
export const resolveMasterLoginUrl = (): string => envAppConfig.masterEntryUrl();
export const resolveMasterDashboardUrl = (): string => envAppConfig.masterEntryUrl();
