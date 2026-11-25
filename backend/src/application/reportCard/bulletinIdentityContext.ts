/**
 * APPLICATION LAYER — Construction & cache par lot du contexte d'identité d'école pour le rendu PDF
 */
import type { SchoolAssetStoragePort } from '@domain/ports/services/SchoolAssetStoragePort';
import type { SchoolIdentityKitRecord } from '@domain/ports/repositories/SchoolIdentityKitRepository';
import type { SchoolIdentityRenderContext } from '@domain/ports/services/BulletinRendererPort';

export function cleanOptionalText(val: string | null | undefined): string | null {
  const t = val?.trim();
  return t && t.length > 0 ? t : null;
}

export async function buildSchoolIdentityRenderContext(params: {
  schoolName: string;
  language: 'fr' | 'en';
  fallbackMotto?: string | null;
  fallbackCity?: string | null;
  fallbackPhone?: string | null;
  fallbackLogoUrl?: string | null;
  kit?: SchoolIdentityKitRecord | null;
  schoolAssetStorage?: SchoolAssetStoragePort;
}): Promise<SchoolIdentityRenderContext> {
  const isEn = params.language === 'en';
  const k = params.kit;
  const storage = params.schoolAssetStorage;
  const pick = (fr?: string | null, en?: string | null) =>
    cleanOptionalText(isEn ? (en ?? fr) : (fr ?? en));

  const [logoBuffer, coatOfArmsBuffer, stampBuffer, principalSignatureBuffer, censorSignatureBuffer] = storage
    ? await Promise.all([
        storage.readAssetBuffer(k?.logoAssetKey ?? params.fallbackLogoUrl),
        k?.useCoatOfArms ? storage.readAssetBuffer(k.coatOfArmsAssetKey) : Promise.resolve(null),
        storage.readAssetBuffer(k?.stampAssetKey),
        storage.readAssetBuffer(k?.principalSignatureAssetKey),
        storage.readAssetBuffer(k?.censorSignatureAssetKey),
      ])
    : [null, null, null, null, null];

  return {
    schoolName: params.schoolName,
    schoolMotto: pick(k?.mottoFr, k?.mottoEn) ?? cleanOptionalText(params.fallbackMotto),
    regionalDelegation: pick(k?.regionalDelegationFr, k?.regionalDelegationEn),
    departmentalDelegation: pick(k?.departmentalDelegationFr, k?.departmentalDelegationEn),
    city: cleanOptionalText(k?.city) ?? cleanOptionalText(params.fallbackCity),
    phone: cleanOptionalText(k?.phone) ?? cleanOptionalText(params.fallbackPhone),
    bp: cleanOptionalText(k?.poBox),
    foundingYear: k?.foundingYear ?? null,
    authorizationNumber: cleanOptionalText(k?.authorizationNumber),
    accentColor: cleanOptionalText(k?.accentColor),
    coatOfArmsEnabled: k?.useCoatOfArms ?? false,
    logoUrl: cleanOptionalText(params.fallbackLogoUrl),
    logoBuffer,
    coatOfArmsBuffer,
    stampBuffer,
    principalSignatureBuffer,
    censorSignatureBuffer,
  };
}

export interface BatchSchoolIdentityContextCache {
  getForLanguage(language: 'fr' | 'en'): Promise<SchoolIdentityRenderContext>;
}

/**
 * Cache les Buffers PNG/JPEG et les champs d'identité d'un établissement pendant un lot complet
 * de génération ou scellement de classe afin de ne lire chaque média qu'une seule fois.
 */
export function createBatchSchoolIdentityContextCache(params: {
  schoolName: string;
  fallbackMotto?: string | null;
  fallbackCity?: string | null;
  fallbackPhone?: string | null;
  fallbackLogoUrl?: string | null;
  kit?: SchoolIdentityKitRecord | null;
  schoolAssetStorage?: SchoolAssetStoragePort;
}): BatchSchoolIdentityContextCache {
  let sharedBuffersPromise: Promise<{
    logoBuffer: Buffer | null;
    coatOfArmsBuffer: Buffer | null;
    stampBuffer: Buffer | null;
    principalSignatureBuffer: Buffer | null;
    censorSignatureBuffer: Buffer | null;
  }> | null = null;
  const byLang = new Map<'fr' | 'en', Promise<SchoolIdentityRenderContext>>();

  const loadBuffersOnce = () => {
    if (!sharedBuffersPromise) {
      const storage = params.schoolAssetStorage;
      const k = params.kit;
      sharedBuffersPromise = storage
        ? Promise.all([
            storage.readAssetBuffer(k?.logoAssetKey ?? params.fallbackLogoUrl),
            k?.useCoatOfArms ? storage.readAssetBuffer(k.coatOfArmsAssetKey) : Promise.resolve(null),
            storage.readAssetBuffer(k?.stampAssetKey),
            storage.readAssetBuffer(k?.principalSignatureAssetKey),
            storage.readAssetBuffer(k?.censorSignatureAssetKey),
          ]).then(([logoBuffer, coatOfArmsBuffer, stampBuffer, principalSignatureBuffer, censorSignatureBuffer]) => ({
            logoBuffer,
            coatOfArmsBuffer,
            stampBuffer,
            principalSignatureBuffer,
            censorSignatureBuffer,
          }))
        : Promise.resolve({
            logoBuffer: null,
            coatOfArmsBuffer: null,
            stampBuffer: null,
            principalSignatureBuffer: null,
            censorSignatureBuffer: null,
          });
    }
    return sharedBuffersPromise;
  };

  return {
    getForLanguage(language: 'fr' | 'en') {
      let cached = byLang.get(language);
      if (!cached) {
        const isEn = language === 'en';
        const k = params.kit;
        const pick = (fr?: string | null, en?: string | null) =>
          cleanOptionalText(isEn ? (en ?? fr) : (fr ?? en));
        cached = loadBuffersOnce().then((buffers) => ({
          schoolName: params.schoolName,
          schoolMotto: pick(k?.mottoFr, k?.mottoEn) ?? cleanOptionalText(params.fallbackMotto),
          regionalDelegation: pick(k?.regionalDelegationFr, k?.regionalDelegationEn),
          departmentalDelegation: pick(k?.departmentalDelegationFr, k?.departmentalDelegationEn),
          city: cleanOptionalText(k?.city) ?? cleanOptionalText(params.fallbackCity),
          phone: cleanOptionalText(k?.phone) ?? cleanOptionalText(params.fallbackPhone),
          bp: cleanOptionalText(k?.poBox),
          foundingYear: k?.foundingYear ?? null,
          authorizationNumber: cleanOptionalText(k?.authorizationNumber),
          accentColor: cleanOptionalText(k?.accentColor),
          coatOfArmsEnabled: k?.useCoatOfArms ?? false,
          logoUrl: cleanOptionalText(params.fallbackLogoUrl),
          ...buffers,
        }));
        byLang.set(language, cached);
      }
      return cached;
    },
  };
}

