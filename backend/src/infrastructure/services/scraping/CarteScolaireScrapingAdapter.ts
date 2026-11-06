/**
 * INFRASTRUCTURE — Adapter scraping cartescolaire.cm
 *
 * Scraping avec :
 * - Cache en mémoire (TTL configurable)
 * - Rate limiting (1 requête/500ms)
 * - Circuit breaker (5 erreurs → pause 30min)
 * - User-Agent navigateur standard
 * - Fallback gracieux en cas d'échec
 *
 * URL et structure HTML VÉRIFIÉES par inspection directe du site réel (DevTools, 2026-07-11) —
 * contrairement à une version précédente entièrement devinée. Confirmé :
 *   1. Page formulaire : GET /minesec (contient le token CSRF + liste des établissements)
 *   2. Recherche      : GET /get-matricule?_token=...&student_name=...&school_code=...
 *      → page HTML complète générée côté serveur (pas de JS requis), avec la structure
 *      exacte parsée ci-dessous (.profile-info .title/.subtitle, .class-info, .gender, etc.)
 *   3. Le site utilise un cookie de session Laravel — la recherche échoue silencieusement
 *      sans cookie valide (vérifié : rejouer l'URL seule, sans cookie, ne renvoie rien).
 *
 * Flux paiement VÉRIFIÉ également (DevTools, 2026-07-11) :
 *   1. Page formulaire : GET /verify-payment (même page/token que la recherche matricule)
 *   2. Résultat        : GET /get-payment?_token=...&matricule=...&ac_year=AAAA-AAAA
 *      → même conteneur .result-list .result-item que /get-matricule, mais sous-arbre différent :
 *      .profile-info .title (type de frais, ex. "FRAIS DE SCOLARITÉ"), .top-right-result-item
 *      .class-info (classe + date de paiement), .payment-detail .payment (montant),
 *      .bottom-right-result-item .actual-matricule (matricule, pour confirmation croisée).
 *      Absence de .result-item = aucun paiement trouvé pour cette année (le libellé du site est
 *      "Vérifiez si vous avez payé" — un résultat vide se lit donc comme "non payé").
 *   L'opérateur de paiement (MTN/Orange) n'est affiché qu'en logo image (pas de texte fiable) —
 *   non extrait, resterait une supposition non confirmée.
 */
import * as cheerio from 'cheerio';
import { parseDateFR } from '../../../shared/date/parseDateFR.ts';
import type { CarteScolaireService, RechercheMatriculeResult, CarteScolairePaymentStatus } from '@domain/ports/services/CarteScolaireService';
import { messageErreur } from '@application/shared/messageErreur';

const BASE_URL = 'https://cartescolaire.cm';
const FORM_URL = `${BASE_URL}/minesec`;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

interface SessionContext {
  cookie: string;
  token: string;
}

export class CarteScolaireScrapingAdapter implements CarteScolaireService {
  private cache = new Map<string, CacheEntry<unknown>>();
  private errorCount = 0;
  private circuitOpenUntil = 0;
  private lastRequestTime = 0;

  constructor(
    private readonly matriculeCacheTtlMs = 4 * 60 * 60 * 1000, // 4h
    private readonly paymentCacheTtlMs = 30 * 60 * 1000, // 30min
  ) {}

  private isCircuitOpen(): boolean {
    return Date.now() < this.circuitOpenUntil;
  }

  private recordError(): void {
    this.errorCount++;
    if (this.errorCount >= 5) {
      this.circuitOpenUntil = Date.now() + 30 * 60 * 1000; // 30min
      console.warn('[CarteScolaire] Circuit breaker ouvert — pause 30min');
    }
  }

  private recordSuccess(): void {
    this.errorCount = 0;
  }

  private async rateLimitedFetch(url: string, extraHeaders?: Record<string, string>): Promise<Response> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < 500) {
      await new Promise(r => setTimeout(r, 500 - elapsed));
    }
    this.lastRequestTime = Date.now();

    return fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.5',
        ...extraHeaders,
      },
      signal: AbortSignal.timeout(15000), // 15s timeout
    });
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private setCache<T>(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  /** Extrait toutes les valeurs Set-Cookie d'une réponse, sous forme d'un header Cookie réutilisable. */
  private extractCookieHeader(res: Response): string {
    // Garde défensive conservée : getSetCookie() est bien déclarée par lib.dom.d.ts, mais tous
    // les runtimes fetch (versions d'undici notamment) ne l'implémentent pas forcément.
    const raw: string[] = typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : [res.headers.get('set-cookie')].filter((v): v is string => !!v);

    return raw
      .map(c => c.split(';')[0]) // ne garder que "nom=valeur", retirer Path/HttpOnly/etc.
      .filter(Boolean)
      .join('; ');
  }

  /**
   * Charge la page de recherche pour obtenir un cookie de session frais + un jeton CSRF valide.
   * Requis avant toute recherche — le site rejette silencieusement une recherche sans session active.
   */
  private async chargerFormulaire(): Promise<SessionContext | null> {
    try {
      const res = await this.rateLimitedFetch(FORM_URL);
      if (!res.ok) return null;

      const cookie = this.extractCookieHeader(res);
      const html = await res.text();
      const $ = cheerio.load(html);

      // Le jeton CSRF Laravel apparaît généralement soit en input caché du formulaire,
      // soit en meta tag — on essaie les deux emplacements usuels.
      const token = $('input[name="_token"]').attr('value')
        ?? $('meta[name="csrf-token"]').attr('content')
        ?? '';

      if (!cookie || !token) return null;
      return { cookie, token };
    } catch (err) {
      console.error('[CarteScolaire] chargerFormulaire échoué:', messageErreur(err));
      return null;
    }
  }

  async rechercherMatricule(studentName: string, schoolCode: string): Promise<RechercheMatriculeResult> {
    const cacheKey = `matricule:${schoolCode}:${studentName}`;
    const cached = this.getFromCache<RechercheMatriculeResult>(cacheKey);
    if (cached) return cached;

    const notFound: RechercheMatriculeResult = { trouve: false, verified: false };
    if (this.isCircuitOpen()) return notFound;

    try {
      const session = await this.chargerFormulaire();
      if (!session) {
        this.recordError();
        return notFound;
      }

      const url = `${BASE_URL}/get-matricule?_token=${encodeURIComponent(session.token)}`
        + `&student_name=${encodeURIComponent(studentName)}`
        + `&school_code=${encodeURIComponent(schoolCode)}`;

      const res = await this.rateLimitedFetch(url, { Cookie: session.cookie });
      if (!res.ok) {
        this.recordError();
        return notFound;
      }

      const html = await res.text();
      const result = this.parseResultatRecherche(html);
      this.recordSuccess();

      if (result.trouve) this.setCache(cacheKey, result, this.matriculeCacheTtlMs);
      return result;
    } catch (err) {
      this.recordError();
      console.error(`[CarteScolaire] rechercherMatricule échoué pour "${studentName}":`, messageErreur(err));
      return notFound;
    }
  }

  /**
   * Parse la page de résultats — structure confirmée par inspection directe (DevTools) :
   *   .result-list .result-item
   *     .profile-info .title      → établissement
   *     .profile-info .subtitle   → nom complet
   *     .class-info .student-class → classe
   *     .class-info .student-year  → date de naissance (AAAA-MM-JJ)
   *     .gender p                  → sexe ("F" ou "M")
   *     .bottom-right-result-item .actual-matricule → matricule
   * Si plusieurs résultats (homonymes) : on ne peut pas trancher automatiquement — on renvoie
   * le premier avec verified:true mais on ne l'applique jamais sans confirmation admin de toute
   * façon (cf. VerifierMatriculeUseCase), donc l'ambiguïté est acceptable ici.
   */
  private parseResultatRecherche(html: string): RechercheMatriculeResult {
    const $ = cheerio.load(html);
    const items = $('.result-list .result-item');

    if (items.length === 0) {
      // Page reconnue (formulaire chargé, requête aboutie) mais aucun résultat — vérification
      // réussie, juste rien trouvé. Distinct d'un échec réseau/parsing (verified:false).
      return { trouve: false, verified: true };
    }

    const first = items.first();
    const etablissement = first.find('.profile-info .title').text().trim() || undefined;
    const nomComplet = first.find('.profile-info .subtitle').text().trim() || undefined;
    const classe = first.find('.class-info .student-class').text().trim() || undefined;
    const dateOfBirth = first.find('.class-info .student-year').text().trim() || undefined;
    const genderRaw = first.find('.gender p').text().trim().toUpperCase();
    const gender: 'M' | 'F' | undefined = genderRaw === 'F' ? 'F' : genderRaw === 'M' ? 'M' : undefined;
    const matricule = first.find('.bottom-right-result-item .actual-matricule').text().trim() || undefined;

    if (!matricule) {
      // Bloc résultat présent mais matricule introuvable dedans — la structure a probablement
      // changé côté site. Ne pas prétendre avoir trouvé quelque chose de fiable.
      return { trouve: false, verified: false };
    }

    return { trouve: true, verified: true, matricule, nomComplet, classe, dateOfBirth, gender, etablissement };
  }

  // ── Vérification paiement — flux confirmé (voir en-tête du fichier) ──

  async checkPaiementStatus(matricule: string, anneeScolaire: string): Promise<CarteScolairePaymentStatus> {
    const cacheKey = `paiement:${matricule}:${anneeScolaire}`;
    const cached = this.getFromCache<CarteScolairePaymentStatus>(cacheKey);
    if (cached) return cached;

    const defaultResult: CarteScolairePaymentStatus = {
      matricule,
      anneeScolaire,
      paye: false,
      verified: false,
    };

    if (this.isCircuitOpen()) return defaultResult;

    try {
      const session = await this.chargerFormulaire();
      if (!session) {
        this.recordError();
        return defaultResult;
      }

      const url = `${BASE_URL}/get-payment?_token=${encodeURIComponent(session.token)}`
        + `&matricule=${encodeURIComponent(matricule)}`
        + `&ac_year=${encodeURIComponent(anneeScolaire)}`;
      const res = await this.rateLimitedFetch(url, { Cookie: session.cookie });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const html = await res.text();
      const status = this.parsePaymentHtml(html, matricule, anneeScolaire);
      this.setCache(cacheKey, status, this.paymentCacheTtlMs);
      this.recordSuccess();
      return status;
    } catch (err) {
      this.recordError();
      console.error(`[CarteScolaire] checkPaiementStatus échoué pour ${matricule}:`, messageErreur(err));
      return defaultResult;
    }
  }

  /**
   * Parse la page de résultat paiement — même conteneur .result-list .result-item que
   * /get-matricule, structure interne confirmée par inspection directe (DevTools) :
   *   .profile-info .title            → type de frais ("FRAIS DE SCOLARITÉ")
   *   .top-right-result-item .class-info .student-class → classe
   *   .top-right-result-item .class-info .student-year  → date de paiement (AAAA-MM-JJ)
   *   .payment-detail .payment .student-class → montant (ex. "10000 XAF")
   *   .bottom-right-result-item .actual-matricule → matricule (confirmation croisée)
   * Absence de .result-item : aucun paiement trouvé pour cette année scolaire (verified:true,
   * paye:false) — distinct d'un échec réseau/parsing (verified:false).
   */
  private parsePaymentHtml(html: string, matricule: string, anneeScolaire: string): CarteScolairePaymentStatus {
    const $ = cheerio.load(html);
    const item = $('.result-list .result-item').first();

    if (item.length === 0) {
      return { matricule, anneeScolaire, verified: true, paye: false };
    }

    const typeFrais = item.find('.profile-info .title').text().trim() || undefined;
    const datePaiementRaw = item.find('.class-info .student-year').text().trim();
    const montantRaw = item.find('.payment-detail .payment .student-class').text().trim();
    const montantMatch = montantRaw.match(/(\d[\d\s]*)/);
    const montant = montantMatch ? parseInt(montantMatch[1].replace(/\s/g, ''), 10) : undefined;
    const datePaiement = parseDateFR(datePaiementRaw) ?? undefined;

    return {
      matricule,
      anneeScolaire,
      verified: true,
      paye: true,
      montant,
      typeFrais,
      datePaiement,
    };
  }

  /** Invalider le cache (utile après une mise à jour manuelle) */
  invalidateCache(matricule?: string): void {
    if (matricule) {
      for (const key of this.cache.keys()) {
        if (key.includes(matricule)) this.cache.delete(key);
      }
    } else {
      this.cache.clear();
    }
  }
}
