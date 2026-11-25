import type { PrismaClient } from '@prisma/client';
import type {
  SchoolIdentityKitRecord,
  SchoolIdentityKitRepository,
  UpsertSchoolIdentityKitInput,
} from '@domain/ports/repositories/SchoolIdentityKitRepository';

export class PrismaSchoolIdentityKitRepository implements SchoolIdentityKitRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findBySchoolId(schoolId: string): Promise<SchoolIdentityKitRecord | null> {
    return this.prisma.schoolIdentityKit.findUnique({ where: { schoolId } });
  }

  async upsert(input: UpsertSchoolIdentityKitInput): Promise<SchoolIdentityKitRecord> {
    return this.prisma.schoolIdentityKit.upsert({
      where: { schoolId: input.schoolId },
      update: {
        regionalDelegationFr: input.regionalDelegationFr,
        regionalDelegationEn: input.regionalDelegationEn,
        departmentalDelegationFr: input.departmentalDelegationFr,
        departmentalDelegationEn: input.departmentalDelegationEn,
        mottoFr: input.mottoFr,
        mottoEn: input.mottoEn,
        poBox: input.poBox,
        city: input.city,
        phone: input.phone,
        foundingYear: input.foundingYear,
        authorizationNumber: input.authorizationNumber,
        accentColor: input.accentColor,
        logoAssetKey: input.logoAssetKey,
        coatOfArmsAssetKey: input.coatOfArmsAssetKey,
        stampAssetKey: input.stampAssetKey,
        principalSignatureAssetKey: input.principalSignatureAssetKey,
        censorSignatureAssetKey: input.censorSignatureAssetKey,
        useCoatOfArms: input.useCoatOfArms,
        updatedById: input.updatedById,
      },
      create: {
        schoolId: input.schoolId,
        regionalDelegationFr: input.regionalDelegationFr ?? null,
        regionalDelegationEn: input.regionalDelegationEn ?? null,
        departmentalDelegationFr: input.departmentalDelegationFr ?? null,
        departmentalDelegationEn: input.departmentalDelegationEn ?? null,
        mottoFr: input.mottoFr ?? null,
        mottoEn: input.mottoEn ?? null,
        poBox: input.poBox ?? null,
        city: input.city ?? null,
        phone: input.phone ?? null,
        foundingYear: input.foundingYear ?? null,
        authorizationNumber: input.authorizationNumber ?? null,
        accentColor: input.accentColor ?? null,
        logoAssetKey: input.logoAssetKey ?? null,
        coatOfArmsAssetKey: input.coatOfArmsAssetKey ?? null,
        stampAssetKey: input.stampAssetKey ?? null,
        principalSignatureAssetKey: input.principalSignatureAssetKey ?? null,
        censorSignatureAssetKey: input.censorSignatureAssetKey ?? null,
        useCoatOfArms: input.useCoatOfArms ?? false,
        updatedById: input.updatedById ?? null,
      },
    });
  }
}

