export interface AppConfigPort {
  /** Base URL du frontend, sans slash final (ex: https://zekoulabia.chri.app) */
  frontendBaseUrl(): string;
  /** Point d'entrée unique sécurisé Master (ex: https://zekoulabia.chri.app/master-secret-entry) */
  masterEntryUrl(): string;
  /** URL d'accès Master (redirige via masterEntryUrl) */
  masterLoginUrl(): string;
  /** URL d'accès au dashboard Master (redirige via masterEntryUrl) */
  masterDashboardUrl(): string;
}
