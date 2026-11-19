/**
 * DOMAIN LAYER — Port Repository : Kit d'identité officielle par établissement.
 */

export interface SchoolIdentityKitRecord {
  id: string;
  schoolId: string;
  regionalDelegationFr: string | null;
  regionalDelegationEn: string | null;
  departmentalDelegationFr: string | null;
  departmentalDelegationEn: string | null;
  mottoFr: string | null;
  mottoEn: string | null;
  poBox: string | null;
  city: string | null;
  phone: string | null;
  foundingYear: number | null;
  authorizationNumber: string | null;
  accentColor: string | null;
  logoAssetKey: string | null;
  coatOfArmsAssetKey: string | null;
  stampAssetKey: string | null;
  principalSignatureAssetKey: string | null;
  censorSignatureAssetKey: string | null;
  useCoatOfArms: boolean;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertSchoolIdentityKitInput {
  schoolId: string;
  regionalDelegationFr?: string | null;
  regionalDelegationEn?: string | null;
  departmentalDelegationFr?: string | null;
  departmentalDelegationEn?: string | null;
  mottoFr?: string | null;
  mottoEn?: string | null;
  poBox?: string | null;
  city?: string | null;
  phone?: string | null;
  foundingYear?: number | null;
  authorizationNumber?: string | null;
  accentColor?: string | null;
  logoAssetKey?: string | null;
  coatOfArmsAssetKey?: string | null;
  stampAssetKey?: string | null;
  principalSignatureAssetKey?: string | null;
  censorSignatureAssetKey?: string | null;
  useCoatOfArms?: boolean;
  updatedById?: string | null;
}

export interface SchoolIdentityKitRepository {
  findBySchoolId(schoolId: string): Promise<SchoolIdentityKitRecord | null>;
  upsert(input: UpsertSchoolIdentityKitInput): Promise<SchoolIdentityKitRecord>;
}

